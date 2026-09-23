# 📚 Universal Book

> **AI-Powered Social Publishing Marketplace**  
> Supervised by Dr. Levin Kuhlmann (Monash University) · March 2026

## 💻 Run it on your own computer

New to the project? **[RUN-LOCALLY.md](RUN-LOCALLY.md)** walks through it from
nothing installed to a working site, assuming no prior experience.

The short version, once Node.js 20, Docker Desktop and VS Code are installed:

```bash
npm run setup   # once — database, packages, demo accounts
npm run dev     # every time — http://localhost:3000
```

Sign in as `author@local.test` / `Password123!`.

## 🌐 Live URLs

| Service | URL |
|---|---|
| **Frontend** | https://universal-book.com |
| **API** | https://api.universal-book.com |
| **Admin Panel** | https://universal-book.com/universalbook-admin |

## 🌟 What is Universal Book?

An AI-powered publishing platform combining:
- 🐦 **Social Feed** — Twitter/X-like writer posts and audience building
- 📚 **Marketplace** — Udemy-like book browsing and purchasing by genre
- 🤖 **AI Writing** — Claude AI generates complete books from a topic
- ✍️ **Collaborative Editor** — Google Docs-like real-time co-editing
- 🤝 **Connections** — LinkedIn-style professional networking
- 👥 **Communities** — Facebook Groups-like genre communities

## 💼 Business Model

- Writers use Claude AI to generate books (~$0.53/book platform fee)
- Writers set their own price → readers pay to access chapters
- Platform takes **30%** · Writers earn **70%**
- Free plan: 1 book/month · Paid plans: unlimited

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Native JWT auth** (`lib/auth.ts`) — no Firebase
- **contentEditable** rich text editor (NOT Tiptap — incompatible with Next.js 14)
- **lucide-react** icons

### Backend
- **NestJS** (Node.js + TypeScript)
- **Prisma 7** + PrismaPg adapter + **PostgreSQL** (Google Cloud SQL)
- **Own JWT issuer** (access + rotating refresh tokens) with bcrypt password hashing
- **Resend** for transactional email (password reset)
- **Anthropic SDK** (Claude AI) + **Stripe** payments

### Infrastructure
- **Google Cloud Run** (serverless containers, scales to zero)
- **Domain:** universal-book.com (Namecheap) with Google Cloud SSL

## 📁 Project Structure
```
universal-book/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── admin/          # Admin CRUD + settings
│   │   │   ├── ai/             # Claude API service
│   │   │   ├── auth/           # JWT issuer + guards
│   │   │   ├── author-groups/  # Co-writing groups
│   │   │   ├── books/          # Book CRUD + AI generation
│   │   │   ├── groups/         # User communities
│   │   │   ├── marketplace/    # Publishing marketplace
│   │   │   ├── payments/       # Stripe checkout + webhooks
│   │   │   ├── social/         # Posts, connections, DMs
│   │   │   └── users/          # User management
│   │   └── prisma/schema.prisma
│   └── web/                    # Next.js Frontend
│       └── src/
│           ├── app/            # Pages (App Router)
│           ├── components/     # Shared components
│           └── lib/            # auth.ts, realtime.ts, config.ts, api.ts
```

## 📖 Book Creation — 3 Modes

### 🤖 AI Author (5-Step Wizard)
1. Enter topic, genre, tone, audience, language, chapter count (1–30)
2. AI generates 6 title options → pick one or write custom
3. AI generates 3 complete outlines → pick one
4. AI generates 3 synopsis options → pick one
5. Chapters auto-generated with progress bar → redirects to editor

### ✍️ Self Author
Set up book details → name chapters → write in rich text editor

### 📤 Import Book
Upload `.docx`, `.txt`, or `.pdf` → auto-detects chapters → edit and publish

## 🚢 Deployment

### Deploy Backend
```bash
cd ~/universal-book/apps/api
npm run build
gcloud run deploy universal-book-api \
  --source . --region us-central1 \
  --platform managed --allow-unauthenticated
```

### Deploy Frontend
```bash
cd ~/universal-book/apps/web
gcloud run deploy universal-book-web \
  --source . --region us-central1 \
  --platform managed --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_API_URL=https://api.universal-book.com"
```

### Database
```bash
cd ~/universal-book/apps/api
npx prisma db push      # Push schema changes
npx prisma generate     # Regenerate Prisma client
```

### Save to GitHub
```bash
cd ~/universal-book
git add .
git commit -m "your message"
git push
```

## ⚙️ Infrastructure

| Service | Detail |
|---|---|
| GCP Project | universal-book-365 |
| Region | us-central1 |
| Database | PostgreSQL @ 34.70.84.122:5432 |
| Auth | Self-hosted JWT (Postgres-backed) |
| Real-time | Polling endpoints on the API |

## 🔐 Admin Panel

URL: `/universalbook-admin` (not publicly linked)

| Role | Permissions |
|---|---|
| **Super Admin** | Full access — Stripe, AI settings, manage admins |
| **Admin** | Manage users & books |
| **Manager** | View only |
| **Moderator** | View books only |

## ⚠️ Critical Architecture Notes

1. **Do NOT install Tiptap** — incompatible with Next.js 14. Use `contentEditable` instead.
2. **No persistent connections** — Cloud Run scales to zero, so real-time is polling against the API (`lib/realtime.ts`). Cadences live in `lib/config.ts`.
3. **MessagingWidget must use `dynamic` import with `ssr: false`** in `layout.tsx`.
4. **The API origin lives in `lib/config.ts`** — one constant, inlined at build time. Do not re-hardcode it per page.
5. **Use `getToken()` from `lib/auth.ts`** — it refreshes expired tokens automatically. Subscribe to sign-in changes with `onAuthChange()`.
6. **Backend 404 on `/`** is normal — NestJS has no root route.

## 💳 Stripe Setup

1. Go to `/universalbook-admin/settings`
2. Enter Stripe keys (Publishable, Secret, Webhook Secret, Price IDs)
3. Register webhook: `https://api.universal-book.com/api/payments/webhook`

## 🔮 Roadmap

- [ ] Profile photo upload
- [ ] Book cover page generation
- [ ] PDF/EPUB export
- [ ] Complete Stripe purchase flow (unlock chapters)
- [x] ~~Firebase security rules~~ — Firebase removed entirely, see `MIGRATION-FIREBASE-REMOVAL.md`
- [ ] Email notifications beyond password reset
- [ ] Mobile app (React Native)

## 👥 Team

| Name | Role | Email |
|---|---|---|
| **Dr. Levin Kuhlmann** | Supervisor (Monash University) | levin.kuhlmann@monash.edu |
| **Nuruzzaman Faruqui** | Lead Developer | faruqui.swe@diu.edu.bd |

---

*Built with ❤️ using Claude AI by Anthropic · © 2026 Universal Book*
