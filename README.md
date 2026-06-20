# Relay — a multi-business CRM

A customer relationship manager built with **Next.js (App Router)**, **Tailwind CSS**, **Next-Auth**, **Supabase** (Postgres), and **Resend** for email.

Manage several businesses from one account, move customers through a sales lifecycle, log every interaction, and email customers directly from the app — every send lands on the customer's timeline.

---

## What's included

- **Authentication** with Next-Auth (email + password) and a full **forgot-password flow** — reset emails are sent through Resend with single-use, expiring tokens.
- **Multiple businesses** per account, with a one-click switcher in the sidebar. Each business has its own customers, pipeline, and activity.
- **Customers** with contact details, company, title, source, deal value, notes, and a lifecycle **status**: cold lead → hot lead → outreach → contacted → in pipeline → sold → recurring (plus *lost*).
- **Interaction logging** — notes, calls, meetings, and emails, shown as a timeline. Status changes are logged automatically.
- **Send email via Resend** from a customer's profile; the message is recorded on the timeline.
- **Follow-up tasks** tied to customers, surfaced on the dashboard.
- **Dashboard** with totals (customers, active leads, open pipeline value, won revenue), a status breakdown, follow-ups, and recent activity.

---

## How auth works (important)

Authentication is handled by **Next-Auth**, not Supabase Auth. The app talks to Postgres using the Supabase **service-role key from server code only**. Authorization (is this user a member of this business?) is enforced in every API route. Row Level Security is enabled with no permissive policies, so the public/anon key can't read anything — never query these tables from the browser with the anon key.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project and run the schema

In the Supabase dashboard, open the **SQL editor** and run the contents of [`supabase/schema.sql`](./supabase/schema.sql). This creates the `users`, `businesses`, `business_members`, `customers`, `contact_logs`, `tasks`, and `password_reset_tokens` tables.

### 3. Set up Resend

Create an API key at [resend.com/api-keys](https://resend.com/api-keys) and verify a sending domain. Use a `from` address on that domain (during testing you can use `onboarding@resend.dev`).

### 4. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

```
NEXTAUTH_SECRET=          # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL= # Supabase: Settings -> API -> Project URL
SUPABASE_SERVICE_ROLE_KEY=# Supabase: Settings -> API -> service_role (secret)

RESEND_API_KEY=
EMAIL_FROM="Relay CRM <noreply@yourdomain.com>"
```

> `SUPABASE_SERVICE_ROLE_KEY` is a secret. Keep it server-side and never expose it to the client.

### 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account (a first business is created for you automatically), and start adding customers.

### 6. (Optional) Seed sample data

To populate your dev database with realistic sample data — two users, three
businesses, ~16 customers across every lifecycle stage, plus contact logs and
follow-up tasks — run:

```bash
npm run seed
```

This reads the same `.env.local` and writes through the Supabase service-role
key (just like the app), so point it at a **development** project, not
production. It's **idempotent**: each run removes the seed accounts (which
cascades to their businesses, customers, logs, and tasks) and re-inserts a
fresh dataset, so you can re-run it any time. It only ever touches the
`@relay.test` seed accounts, so data you create by hand is left alone. It
refuses to run when `NODE_ENV=production` unless you pass `--force`.

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
    (app)/                  # authenticated area (sidebar shell)
      dashboard/            # primary dashboard
      customers/            # list + [id] detail (timeline, email, logging)
      settings/             # create / rename / switch / delete businesses
    api/
      auth/[...nextauth]/   # Next-Auth handler
      register/             # account creation (bcrypt)
      forgot-password/      # generates token, emails via Resend
      reset-password/       # validates token, sets new password
      businesses/           # list / create / rename / delete
      customers/            # list / create / update / delete
      customers/[id]/logs/  # interaction timeline
      customers/[id]/email/ # send via Resend + auto-log
      tasks/                # follow-up tasks
      dashboard/            # aggregated metrics
    login, register, forgot-password, reset-password
  components/               # sidebar, business switcher, UI primitives, status
  lib/                      # supabase admin client, auth, resend, status, authz
  types/                    # shared TS types + next-auth augmentation
supabase/schema.sql         # database schema
scripts/seed.mjs            # sample-data seed for local dev (npm run seed)
```

---

## Customizing the lifecycle

All statuses, their order, colors, and which ones count as "pipeline" or "won" live in [`src/lib/status.ts`](./src/lib/status.ts). Edit that one file to rename stages, add new ones, or recolor the UI — every screen reads from it.

---

## Notes & next steps

- **Inviting teammates:** the schema supports `business_members` with an `owner`/`member` role. The current UI manages the owner's own businesses; adding an invite flow (look up a user by email, insert a membership row) is a natural extension.
- **Inbound email replies** aren't captured — Relay sends and logs outbound mail. Resend inbound webhooks could feed replies back onto the timeline.
- `eslint.ignoreDuringBuilds` is on so lint warnings don't block a deploy; TypeScript type-checking still runs during `next build`.
