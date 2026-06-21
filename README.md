# Relay — a multi-business CRM

A customer relationship manager built with **Next.js (App Router)**, **Tailwind CSS**, **Appwrite** (auth + database), and **Resend** for customer-facing email.

Manage several businesses from one account, move customers through a sales lifecycle, log every interaction, and email customers directly from the app — every send lands on the customer's timeline.

---

## What's included

- **Authentication** with Appwrite Account (email + password) and a full **forgot-password flow** — recovery emails are sent and verified by Appwrite.
- **Multiple businesses** per account, modeled as **Appwrite Teams**, with a one-click switcher in the sidebar. Each business has its own customers, pipeline, and activity, and its own membership (owner / member).
- **Customers** with contact details, company, title, source, deal value, notes, and a lifecycle **status**: cold lead → hot lead → outreach → contacted → in pipeline → sold → recurring (plus *lost*).
- **Interaction logging** — notes, calls, meetings, and emails, shown as a timeline. Status changes are logged automatically.
- **Two-way email** — send via Resend from a customer's profile, and capture **inbound replies** on the timeline via a Resend webhook. Reusable **email templates** (with `{first name}` / `{name}` merge fields) per business.
- **Follow-up tasks** — create, complete, snooze, and delete tasks on a customer's profile; due/overdue tasks surface on the dashboard with one-click completion.
- **File attachments** — upload files to a customer (Appwrite Storage), streamed back through authenticated routes.
- **CSV import/export** — bulk-import customers from a CSV and export the full list.
- **Reports** — conversion funnel, win rate, weighted pipeline forecast (stage probability × value), and an 8-week activity chart.
- **AI prospect research** (Anthropic API) — finds potential clients tailored to your business profile by searching the public web, surfaces publicly listed owner/contact details with source citations and a confidence rating, and adds chosen prospects straight to your pipeline.
- **AI message drafting** (Anthropic API) — draft or improve a customer email in one click, using your business profile, the customer's stage, and recent interactions.
- **Business profile** — capture your industry, value proposition, and ideal customer profile so the AI features are tailored to your business.
- **Team collaboration** — invite existing users to a business and manage members/roles from Settings.
- **Live updates** — lists and timelines update in real time across teammates via Appwrite Realtime.
- **Daily reminders** — a scheduled Appwrite Function emails each business a digest of due/overdue follow-ups and deals going quiet.
- **Dashboard** with totals (customers, active leads, open pipeline value, won revenue), a status breakdown, follow-ups, and recent activity.

---

## Architecture / how auth works (important)

- **Auth** is handled by **Appwrite Account**. On login, the server creates an email/password session and stores its secret in an httpOnly cookie; every request rebuilds an Appwrite client bound to that session.
- **Businesses** are **Appwrite Teams**. Team membership is the source of truth for "who can access this business," and the team role (`owner` / `member`) drives permissions.
- **customers**, **contact_logs**, and **tasks** are **Appwrite Database** collections. Each document carries a `businessId` (the Team id) and is created with document-level permissions scoped to that team.
- All data access goes through **Next.js API routes** using the **node-appwrite** server SDK. Routes use an **admin client** (project API key — bypasses permissions) and enforce authorization themselves by checking Team membership, exactly where the old service-role model used to sit. Nothing queries Appwrite from the browser.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create an Appwrite project

Use [Appwrite Cloud](https://cloud.appwrite.io) or a self-hosted instance.

1. Create a project and note its **Project ID**.
2. **Settings → Platforms** → add a **Web** platform with hostname `localhost` (and your production domain). This is required for the recovery/invite redirect links.
3. **Overview → Integrations → API Keys** → create an API key with scopes:
   `sessions.write`, `users.read`, `users.write`, `teams.read`, `teams.write`, `databases.read`, `databases.write`, `documents.read`, `documents.write`, `files.read`, `files.write`.

### 3. Set up Resend

Create an API key at [resend.com/api-keys](https://resend.com/api-keys) and verify a sending domain. Use a `from` address on that domain (during testing you can use `onboarding@resend.dev`).

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=   # Appwrite project id
APPWRITE_API_KEY=                  # server API key (secret)
APPWRITE_DATABASE_ID=relay         # any short slug

APP_URL=http://localhost:3000      # base URL for recovery/invite links

RESEND_API_KEY=
EMAIL_FROM="Relay CRM <noreply@yourdomain.com>"
RESEND_WEBHOOK_SECRET=          # only for two-way email (inbound replies)

ANTHROPIC_API_KEY=             # for AI research + message drafting
# ANTHROPIC_MODEL=claude-opus-4-8   # optional model override
```

> `APPWRITE_API_KEY` is a secret. Keep it server-side and never expose it to the client.

### 5. Create the database schema

This creates the database, collections, attributes, indexes, and the storage bucket in your Appwrite project (idempotent — safe to re-run):

```bash
npm run appwrite:setup
```

> **Free plan note:** Appwrite Cloud's free plan caps **databases** and **storage buckets**. If your project already has one, the script adopts it automatically and prints a line to add to `.env.local` — `APPWRITE_DATABASE_ID=<existing-id>` and/or `APPWRITE_ATTACHMENTS_BUCKET=<existing-id>` — so the app and seed use the same resources. Set whatever it prints and you're done. (If no bucket can be created, everything works except file attachments.)

### 6. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account (a first business is created for you automatically), and start adding customers.

### 7. (Optional) Seed sample data

Populate your dev project with realistic sample data — two users, three businesses, ~16 customers across every lifecycle stage, plus contact logs and follow-up tasks:

```bash
npm run seed
```

This reads the same `.env.local` and writes through the Appwrite API key, so point it at a **development** project, not production. It's **idempotent**: each run deletes the seed users + teams (and their documents) by fixed ids and re-inserts a fresh dataset. It only touches the seed records, so data you create by hand is left alone, and it refuses to run when `NODE_ENV=production` unless you pass `--force`.

After seeding, log in with either account (password `password123`):

| Email | Password | Access |
| --- | --- | --- |
| `dana@relay.test` | `password123` | Owns **Acme Consulting** + **Bloom Studio** |
| `sam@relay.test` | `password123` | Owns **Okafor Legal**, member of **Acme Consulting** |

---

## Project structure

```
src/
  app/
    (app)/                  # authenticated area (server layout guards the session)
      dashboard/            # primary dashboard
      customers/            # list (import/export) + [id] detail
      research/             # AI prospect research
      reports/              # funnel, win rate, weighted pipeline, activity
      settings/             # businesses, members, profile, email templates
    api/
      auth/login|logout/    # Appwrite session cookie
      auth/realtime-token/  # short-lived JWT for the Realtime client
      register/             # account creation + first business
      forgot-password/ reset-password/   # Appwrite recovery
      businesses/[id]/members/   # team membership management
      businesses/[id]/profile/   # business profile (powers AI)
      customers/            # list / create / update / delete
      customers/export|import/   # CSV
      customers/[id]/logs|email|files/   # timeline, send, attachments
      customers/[id]/message-assist/   # AI draft / improve email
      files/[id]/           # stream / delete an attachment
      templates/            # email templates CRUD
      tasks/                # follow-up tasks
      research/             # AI prospect research (web search)
      reports/              # analytics aggregates
      dashboard/            # dashboard metrics
      webhooks/resend-inbound/   # inbound email → timeline
    login, register, forgot-password, reset-password
  components/               # sidebar, business switcher, UI primitives, status
  lib/                      # appwrite clients + mappers, authz, validation,
                            # rate-limit, resend, anthropic, status, use-realtime
  types/                    # shared TS types
scripts/
  appwrite-setup.mjs        # provisions DB/collections/attributes/indexes/bucket
  seed.mjs                  # sample-data seed (npm run seed)
functions/
  reminders/                # scheduled Appwrite Function (daily digest email)
```

### Optional: deploy the reminders function

The daily follow-up digest runs as a scheduled Appwrite Function. See
[`functions/reminders/README.md`](./functions/reminders/README.md) for deploy
steps and the CRON schedule.

### Optional: enable two-way email

To capture inbound replies on the timeline, configure a Resend inbound webhook
pointing at `https://your-app/api/webhooks/resend-inbound`, and set
`RESEND_WEBHOOK_SECRET` to that endpoint's signing secret.

### AI features (Anthropic API)

Set `ANTHROPIC_API_KEY` to enable **prospect research** and **message drafting**.
Both run server-side via the Anthropic API (`claude-opus-4-8` by default); research
uses Claude's web search tool to find and tailor prospects to your business profile.

1. Fill in your **Business profile** (Settings) — research and drafting are tailored to it.
2. Use **Research** in the sidebar to generate prospects; add the good ones to your pipeline.
3. In a customer's **Email** dialog, use *Draft with AI* / *Improve with AI*.

> **Accuracy & compliance:** research results are AI-generated from public web
> sources and can be wrong or stale. Treat every contact detail as a lead to
> **verify**, use only publicly available business contact information, and make
> sure your outreach complies with applicable law (e.g. CAN-SPAM, GDPR,
> Do-Not-Call). Research runs are rate-limited per business and are billed by
> Anthropic per token.

---

## Customizing the lifecycle

All statuses, their order, colors, and which ones count as "pipeline" or "won" live in [`src/lib/status.ts`](./src/lib/status.ts). If you add or rename a status, also update the `status` enum in [`scripts/appwrite-setup.mjs`](./scripts/appwrite-setup.mjs) and re-run `npm run appwrite:setup`.

---

## Notes

- **Cascading deletes:** Appwrite has no foreign-key cascade, so deleting a business or customer removes the related documents (and storage files) in application code (see `purgeBusiness` / `purgeCustomer` in `src/lib/appwrite.ts`).
- **Realtime auth:** the browser subscribes with a short-lived JWT from `/api/auth/realtime-token`; Appwrite only delivers events for documents the user can read, so team-scoped document permissions keep it tenant-safe.
- Security headers (CSP, HSTS, etc.) are set in [`next.config.js`](./next.config.js); lint runs during `next build`.

## Future features

Planned enhancements not yet implemented:

- **Pagination, saved views & column sorting** — customer lists are currently capped at 200 rows; add cursor pagination, user-defined filtered views, and sortable columns for larger datasets.
- **Tags & custom fields** — let each business attach freeform tags and define their own customer fields.
- **Global search** — search across customers, notes, and tasks (today search covers customers by name/email/company only).
- **Granular roles & audit log** — finer permissions than owner/member, and a per-business record of who changed what.
- **Deduplication & merge** — detect and merge duplicate customers (especially after CSV import).
