# Relay — a multi-business CRM

A customer relationship manager built with **Next.js (App Router)**, **Tailwind CSS**, **Appwrite** (auth + database), and **Resend** for customer-facing email.

Manage several businesses from one account, move customers through a sales lifecycle, log every interaction, and email customers directly from the app — every send lands on the customer's timeline.

---

## What's included

- **Authentication** with Appwrite Account (email + password) and a full **forgot-password flow** — recovery emails are sent and verified by Appwrite.
- **Multiple businesses** per account, modeled as **Appwrite Teams**, with a one-click switcher in the sidebar. Each business has its own customers, pipeline, and activity, and its own membership (owner / member).
- **Customers** with contact details, company, title, source, deal value, notes, and a lifecycle **status**: cold lead → hot lead → outreach → contacted → in pipeline → sold → recurring (plus *lost*).
- **Interaction logging** — notes, calls, meetings, and emails, shown as a timeline. Status changes are logged automatically.
- **Send email via Resend** from a customer's profile; the message is recorded on the timeline.
- **Follow-up tasks** tied to customers, surfaced on the dashboard.
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
   `sessions.write`, `users.read`, `users.write`, `teams.read`, `teams.write`, `databases.read`, `databases.write`, `documents.read`, `documents.write`.

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
```

> `APPWRITE_API_KEY` is a secret. Keep it server-side and never expose it to the client.

### 5. Create the database schema

This creates the database, collections, attributes, and indexes in your Appwrite project (idempotent — safe to re-run):

```bash
npm run appwrite:setup
```

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
      customers/            # list + [id] detail (timeline, email, logging)
      settings/             # create / rename / switch / delete businesses
    api/
      auth/login/           # create Appwrite session + set cookie
      auth/logout/          # delete session + clear cookie
      register/             # account creation + first business
      forgot-password/      # Appwrite createRecovery
      reset-password/       # Appwrite updateRecovery
      businesses/           # list / create / rename / delete (Teams)
      businesses/[id]/members/  # list / add / remove members
      customers/            # list / create / update / delete
      customers/[id]/logs/  # interaction timeline
      customers/[id]/email/ # send via Resend + auto-log
      tasks/                # follow-up tasks
      dashboard/            # aggregated metrics
    login, register, forgot-password, reset-password
  components/               # sidebar, business switcher, UI primitives, status
  lib/                      # appwrite clients + mappers, authz, validation,
                            # rate-limit, resend, status
  types/                    # shared TS types
scripts/
  appwrite-setup.mjs        # provisions DB/collections/attributes/indexes
  seed.mjs                  # sample-data seed (npm run seed)
```

---

## Customizing the lifecycle

All statuses, their order, colors, and which ones count as "pipeline" or "won" live in [`src/lib/status.ts`](./src/lib/status.ts). If you add or rename a status, also update the `status` enum in [`scripts/appwrite-setup.mjs`](./scripts/appwrite-setup.mjs) and re-run `npm run appwrite:setup`.

---

## Notes & next steps

- **Inviting teammates:** the member API (`/api/businesses/[id]/members`) is implemented — it looks a user up by email and adds them to the Team as `owner`/`member`. The Settings UI currently manages your own businesses; wiring an invite form to that endpoint is a small addition.
- **Cascading deletes:** Appwrite has no foreign-key cascade, so deleting a business or customer removes the related documents in application code (see `purgeBusiness` / `purgeCustomer` in `src/lib/appwrite.ts`).
- **Inbound email replies** aren't captured — Relay sends and logs outbound mail via Resend.
- Security headers (CSP, HSTS, etc.) are set in [`next.config.js`](./next.config.js); lint runs during `next build`.
