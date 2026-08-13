# Universal Book — Project Context

> Read automatically by Claude Code. Keep it accurate; a stale entry here causes
> worse decisions than a missing one.
>
> Last verified against the codebase: 13 August 2026.

---

## 1. What this is

An AI-powered social publishing marketplace, built for Dr. Levin Kuhlmann
(Monash University) by Nuruzzaman Faruqui. **Live in production.**

Five products in one app: a social feed (Twitter-like), a book marketplace
(Udemy-like), connections and chat (LinkedIn-like), group communities, and AI
book writing with a collaborative editor.

Three ways to create a book: **AI Author** ($5 in credits, Claude writes it),
**Self Author** (rich-text editor, free), **Import** (`.docx`/`.txt`/`.pdf`, free).

---

## 2. Stack

**Frontend** — Next.js 14 App Router, TypeScript, Tailwind, lucide-react.

**Backend** — NestJS, Prisma 7 (PrismaPg adapter), PostgreSQL on Cloud SQL,
Anthropic SDK, Stripe, bcryptjs, nodemailer/Resend.

**Infra** — Cloud Run, GCP project `universal-book-365`, region `us-central1`,
Namecheap DNS.

**No Firebase.** Auth and realtime are self-hosted — see §4. Anything you read
elsewhere referring to Firebase Auth, Firebase RTDB, `FirebaseGuard`, or
`onAuthStateChanged` is describing the pre-August architecture and is wrong.

**Keys and models** are managed in **Admin → API Management**, stored in the
`Setting` table and read at runtime through `RuntimeConfigService`. Database
values override environment variables; blank falls back to env.

### Layout
```
~/universal-book/
├── apps/api/                     # NestJS
│   ├── src/
│   │   ├── admin/                # CRUD, platform settings, revenue, featuring
│   │   ├── ai/                   # Claude service
│   │   ├── auth/                 # JWT issuer, guards, DTOs
│   │   ├── email/                # SMTP or Resend, console fallback
│   │   ├── author-groups/  books/  groups/  marketplace/
│   │   ├── payments/             # Stripe, credits, affiliates
│   │   ├── social/  users/
│   │   ├── prisma.module.ts      # @Global — one client for the process
│   │   └── prisma.service.ts     # extends PrismaClient
│   ├── prisma/schema.prisma
│   └── prisma.config.ts          # reads DATABASE_URL from env
└── apps/web/src/
    ├── app/  components/
    └── lib/  auth.ts · realtime.ts · config.ts · api.ts
```

---

## 3. Environments

| | Production | Development |
|---|---|---|
| Frontend | universal-book.com | dev.universal-book.com |
| API | api.universal-book.com | `universal-book-api-dev-…run.app` |
| GitHub | `NuruzzamanFaruqui/universal-book` | `NuruzzamanFaruqui/universal-book-dev` |
| Remote | `origin` | `dev` |

> **The dev services are running the old Firebase build** and have not been
> redeployed since the auth rewrite. Dev and production are currently different
> applications. Redeploy dev before students use it.

> **The GitHub PAT in both remote URLs is revoked** — `git push` fails on both
> remotes. Re-auth with `gh auth login` or SSH before pushing.

---

## 4. Auth and realtime

**Auth is a JWT issuer in the API.** 15-minute access tokens, 30-day rotating
refresh tokens with reuse detection, bcrypt at cost 12.

- Client: `getToken()` from `lib/auth.ts` returns a valid bearer token and
  refreshes transparently. Subscribe to sign-in changes with `onAuthChange()`.
- Storage: `ub_token` (access), `ub_refresh` (refresh).
- Server: `JwtAuthGuard` / `OptionalJwtAuthGuard`, both injecting the shared
  `PrismaService`.
- `JWT_SECRET` is mandatory — the API refuses to boot in production without it.

**Realtime is polling**, because Cloud Run scales to zero and cannot hold a
connection open. `lib/realtime.ts` provides subscriptions that pause on hidden
tabs and back off on failure; intervals live in `lib/config.ts` (chat 3s,
conversations 10s, presence 20s, editor 4s, heartbeat 30s).

Because every subscription returns an unsubscribe function, swapping to SSE
later means rewriting `realtime.ts` alone.

**Presence** is a `lastSeenAt` heartbeat; online = within 75s.

**Collaborative editing** is last-writer-wins on the whole chapter body, client
debounced by 1.2s, and a poll never overwrites a focused editor. Editing
requires book ownership or author-group membership.

---

## 5. Business model

Pay-per-use credits; no subscriptions.

- 1 credit = $1 USD
- AI generation = $5, **charged before generation and not refunded on failure**
- Purchase by credits or Stripe Checkout
- Platform 30% / author 70%; affiliate takes 10% of the author's share
- Top-ups: $5 / $10 / $25 / $50

$10 book via affiliate: platform $3.00, affiliate $0.70, author $6.30.

**Authors cannot withdraw.** Earnings credit an internal balance spendable only
inside the platform. There is no Stripe Connect and no payout path — the "70% to
authors" promise does not currently complete. Largest functional gap in the
product.

Stripe is on sandbox keys. Webhook: `/api/payments/webhook`.

---

## 6. Architecture rules

1. **The editor is Tiptap 3** (`components/editor/ManuscriptEditor.tsx`). The
   old "Tiptap is permanently incompatible with Next.js 14" rule was wrong — the
   packages had been installed without their `dist/` output, almost certainly a
   partial install on a full Cloud Shell disk. It needs `immediatelyRender: false`
   on `useEditor` and no `transpilePackages` entry.
2. **No persistent connections.** Cloud Run scales to zero. Poll via
   `lib/realtime.ts`.
3. **The API origin lives in `lib/config.ts`** — one constant, inlined at build
   time. Do not re-hardcode it per page; it was previously duplicated in 35 files.
4. **Use `getToken()`**, never read `ub_token` directly — it may be expired.
5. **`NEXT_PUBLIC_*` must be set at deploy time** via `--set-env-vars`.
6. **`npm run build` before deploying; `npx prisma generate` after schema changes.**
7. **A 404 at the API root is normal.**

### Environment quirks
- `nvm install 20 && nvm use 20` every Cloud Shell session
- `gcloud config set project universal-book-365` if the project property is lost
- Domain mappings need `gcloud beta run domain-mappings create`
- Prisma 7's adapter cannot be initialised from `node -e`; use `psql` for direct
  DB work
- Cloud Shell home is 4.8 GB and fills constantly — `rm -rf apps/web/.next`

---

## 7. Open issues

### Security — act on these
- **The database password is in git history** (commit `11c53ab` onward, public
  repo). `prisma.config.ts` no longer contains it, but history is unchanged.
  **Rotate the Cloud SQL password.**
- **H2** — `GET /api/groups/:id/messages` and `/api/groups/:id` have no auth
  guard and ignore `isPublic`. Private group chat is public.
- **H3** — `GET /api/admin/settings` returns Stripe and Anthropic keys unmasked.
- Chapter HTML renders via `dangerouslySetInnerHTML` with no sanitising, and
  chapter content can come from an uploaded manuscript.

### Payments — correctness
- **H4** `_completePurchase` is ~10 writes with no `$transaction`
- **H5** credit balances are read-modify-write → double-spendable
- **H6** the Stripe webhook is not idempotent; retries double-credit
- **H7** `publishBook` accepts a negative price, which mints credits

`PrismaService` now extends `PrismaClient`, so `$transaction` is available.

### Other
- AI model defaults to `claude-sonnet-4-20250514`, superseded by the Claude 5
  family. Override it in Admin → API Management without a deploy.
- No automated tests. The 19 `.spec.ts` files are unmodified scaffolding.
- `TeamMember` has no table; the admin team page is `useState` only.
- `books/[id]/page.tsx` is `'use client'`, so no per-book SEO metadata is
  possible without a server-component wrapper.

---

## 8. Not built

The seven student features, none of which have been started except where noted:

| Feature | Student | Note |
|---|---|---|
| Profile photo upload | Madison Hem | `profilePhoto` is read everywhere, written nowhere. No upload endpoint. |
| Connect button on profiles | Sandy Seng | Backend complete; the profile page never calls it. |
| Book cover generation | Rohan Kannan | `coverUrl` exists, never set. |
| PDF export | Shehara Hewawasam | The export page produces `.txt` and `.html` only. |
| Reading progress | Luka Boskovic | No model. |
| Email notifications | Ankush | `EmailService` exists with one caller (password reset). Needs triggers. |
| Recommendations | Dan Nguyen | Nothing. |

Also absent: EPUB, table of contents, cover page design, SEO, Stripe Connect.

---

## 9. Working preferences

- **One step at a time.** Implement → deploy → verify → next.
- **Full file replacements, not diffs.**
- New files via heredoc: `cat > path << 'EOF'`
- Explicit commands, one per message, with a short note on what it does
- Cloud Shell; files opened with `cloudshell edit`

---

## 10. Team

| Person | Role | Contact |
|---|---|---|
| Nuruzzaman Faruqui | Lead developer, super admin | faruqui.swe@diu.edu.bd |
| Dr. Levin Kuhlmann | Supervisor, super admin | levin.kuhlmann@monash.edu |

Seven Monash students contribute via `universal-book-dev`, tracked in ClickUp
workspace `9018805815`. Admin panel at `/universalbook-admin`, restricted to the
two emails above, enforced server-side in `admin.controller.ts`.
