# Reminders function

A scheduled Appwrite Function that emails each business a daily digest of:

- ⏰ **Overdue** follow-up tasks
- 📅 Tasks **due soon** (next 2 days)
- 💤 Deals **going quiet** (no activity in 14+ days)

It iterates every Team (business), gathers the items, and emails each confirmed
member via Resend. Businesses with nothing to report are skipped.

## Deploy (Appwrite Console)

1. **Functions → Create function → Manual / Git**, Node 18+ runtime.
2. Set the entrypoint to `src/main.js` and build command `npm install`.
3. Upload this folder (or point it at `functions/reminders` in your repo).
4. **Settings → Schedule (CRON):** `0 13 * * *` (daily at 13:00 UTC — adjust as you like).
5. **Settings → Scopes:** grant `teams.read`, `databases.read`, `documents.read`.
   (Enable the dynamic API key so executions receive `x-appwrite-key`.)
6. **Settings → Variables:**
   - `APPWRITE_DATABASE_ID` — e.g. `relay`
   - `RESEND_API_KEY`
   - `EMAIL_FROM` — a verified Resend sender
   - `APP_URL` — your app's base URL (for dashboard/customer links)

`APPWRITE_FUNCTION_API_ENDPOINT` and `APPWRITE_FUNCTION_PROJECT_ID` are provided
by Appwrite automatically.

## Deploy (CLI)

```bash
appwrite functions create --functionId reminders --name "Reminders" --runtime node-18.0
appwrite functions createDeployment --functionId reminders \
  --entrypoint src/main.js --code functions/reminders --activate true
# then set the schedule + variables in the console (or via `appwrite functions update`)
```

You can also trigger it manually from the console's **Execute** button to test.
