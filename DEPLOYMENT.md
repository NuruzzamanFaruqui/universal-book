# Deployment

Two Cloud Run services backed by one Cloud SQL Postgres instance. Both scale to
zero. No third-party auth or realtime service is involved.

| Service | Purpose |
|---|---|
| `universal-book-api` | NestJS API, `https://api.universal-book.com` |
| `universal-book-web` | Next.js frontend, `https://universal-book.com` |

---

## Architecture

**Auth** is self-hosted. Every account has a password — `passwordHash` is
required, so there is no such thing as an account that cannot be signed into. `POST /api/auth/login` returns a short-lived access JWT
(15 min) plus an opaque refresh token (30 days, rotating, reuse-detected). The
client's `getToken()` in `lib/auth.ts` refreshes transparently; nothing else
needs to think about expiry. Passwords are bcrypt, cost 12.

**Live data is polled**, not pushed, because Cloud Run scales to zero and a
process that isn't running can't hold a socket open. `lib/realtime.ts` wraps
this: each `subscribe*` call returns an unsubscribe function, polls pause on a
hidden tab, and consecutive failures back off to 30s. Intervals are in
`lib/config.ts` — chat 3s, conversation list 10s, presence 20s, editor 4s,
heartbeat 30s.

Because the subscription shape is uniform, swapping the transport for SSE later
means rewriting `realtime.ts` alone and touching no call sites.

**Presence** is a `lastSeenAt` heartbeat. Anyone whose last beat is inside
`PRESENCE_WINDOW_MS` (75s) counts as online. A time window is more robust than
an explicit disconnect signal, which never arrives when a client drops off the
network.

**Collaborative editing** is last-writer-wins on the whole chapter body. Clients
debounce writes by 1.2s, and a poll never overwrites a document that currently
has focus. Editing requires book ownership or membership of an author group
linked to that book.

---

## Environment variables

Full list in `apps/api/.env.example`. Only one is mandatory:

```bash
JWT_SECRET=$(openssl rand -base64 48)   # API refuses to boot in production without it
```

Plus `DATABASE_URL`, `APP_URL`, and `NODE_ENV=production`.

Email is optional and only affects "forgot password". Set either `SMTP_HOST`
(+ `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) to use a mailbox you already own,
or `RESEND_API_KEY`. With neither, the app runs normally and reset emails go to
the container log instead of being sent.

> On Cloud Run, GCP blocks outbound port 25 and usually 465/587 as well, so SMTP
> generally needs a Serverless VPC connector with Cloud NAT. Resend uses plain
> HTTPS and avoids that.

---

## Deploying

Schema first — the API queries columns that must already exist:

```bash
cd ~/universal-book/apps/api
npx prisma generate
npx prisma db push
```

Then the services:

```bash
cd ~/universal-book/apps/api && npm run build && gcloud run deploy universal-book-api \
  --source . --region us-central1 --platform managed --allow-unauthenticated

cd ~/universal-book/apps/web && gcloud run deploy universal-book-web \
  --source . --region us-central1 --platform managed --allow-unauthenticated
```

Rollback is a traffic switch:

```bash
gcloud run services update-traffic universal-book-api --to-revisions=PREVIOUS=100
```

---

## Smoke test

```bash
curl -X POST https://api.universal-book.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"testpass123","name":"You"}'

TOKEN=$(curl -s -X POST https://api.universal-book.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"testpass123"}' | jq -r .accessToken)

curl https://api.universal-book.com/api/auth/me -H "Authorization: Bearer $TOKEN"
```

In the browser:

- Sign in, hard-refresh — session survives
- Two browsers, same chat — messages land within ~3s
- Two browsers, same chapter — edits land within ~4s, and typing is never
  overwritten mid-keystroke
- Sign out in one tab — the other tab's nav updates without a reload

---

## Known gaps

Open findings from the code audit, none introduced by the auth work:

- **C1** — `apps/api/prisma.config.ts` contains the production database password
  as a literal and is committed. The Dockerfile's `COPY . .` bakes it into the
  image.
- **H2** — `GET /api/groups/:id/messages` has no auth guard and ignores
  `isPublic`.
- **H3** — `GET /api/admin/settings` returns Stripe and Anthropic keys unmasked.
- **H4–H7** — the purchase path has no transaction, credit balances are
  read-modify-write, the Stripe webhook is not idempotent, and `publishBook`
  accepts a negative price.
- No automated tests. The `.spec.ts` files are unmodified scaffolding.
