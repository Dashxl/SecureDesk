# Auth0 Setup Guide for SecureDesk

This guide matches the current SecureDesk implementation:

- real Auth0 login
- real Slack Connected Account through Token Vault
- real Gmail Connected Account through Token Vault
- Auth0 FGA enforcement
- CIBA support with in-app review fallback
- Gemini `gemini-3-flash-preview` for intent parsing and response polishing on top of the deterministic runtime
- persistent audit logs and approval sessions stored in Postgres

## 1. Create the Regular Web Application

Create a `Regular Web Application` in Auth0 for the Next.js app.

Use these local URLs during development:

- Allowed Callback URLs:
  - `http://localhost:3000/api/auth/callback`
  - `http://localhost:3000/dashboard/settings/slack-callback`
  - `http://localhost:3000/dashboard/settings/gmail-callback`
- Allowed Logout URLs:
  - `http://localhost:3000`
- Allowed Web Origins:
  - `http://localhost:3000`

## 2. Create the custom backend API

Create a custom API in:

`Applications -> APIs`

Recommended identifier:

`https://api.securedesk.com`

Use that same value in `.env.local` as:

`AUTH0_AUDIENCE=https://api.securedesk.com`

## 3. Enable grant types for Token Vault

Open:

`Applications -> Applications -> SecureDesk -> Advanced Settings -> Grant Types`

Enable:

- Authorization Code
- Refresh Token
- Token Vault

If the `Token Vault` grant type is missing, the tenant likely does not have Token Vault enabled. Ask the hackathon organizers or Auth0 contact.

## 4. Enable MRRT and authorize the My Account API

Open:

`Applications -> Applications -> SecureDesk -> Multi-Resource Refresh Token`

Enable:

- `Auth0 My Account API`

Then open:

`Applications -> APIs -> Auth0 My Account API`

Authorize the SecureDesk application with these scopes:

- `create:me:connected_accounts`
- `read:me:connected_accounts`
- `delete:me:connected_accounts`

## 5. Create the Token Vault Custom API Client

This is separate from the web app credentials.

Open:

`Applications -> APIs -> securedesk-api`

Then:

1. Click `Add Application`
2. Create a client for Token Vault exchange
3. Copy its `Client ID` and `Client Secret`
4. Put them in:
   - `AUTH0_TOKEN_VAULT_CLIENT_ID`
   - `AUTH0_TOKEN_VAULT_CLIENT_SECRET`

## 6. Configure Slack Connected Accounts

Open:

`Authentication -> Social Connections -> Slack`

Check all of the following:

1. The Slack connection is enabled for `SecureDesk`
2. Purpose includes `Connected Accounts for Token Vault`
3. The Slack app has:
   - `channels:read`
   - `groups:read`
   - `chat:write`
4. The Slack app uses token rotation
5. The Slack app redirect URL includes:
   - `https://YOUR_TENANT.us.auth0.com/login/callback`

Then in SecureDesk, use the `Connect Slack` button in Settings.

## 7. Configure Gmail Connected Accounts

Open:

`Authentication -> Social Connections -> Google`

Check all of the following:

1. The Google connection is enabled for `SecureDesk`
2. It is configured for Connected Accounts / Token Vault
3. The Google scopes cover:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
4. Offline access / refresh-token support is enabled where required by the provider setup

Then in SecureDesk, use the `Connect Gmail` button in Settings.

## 8. Configure FGA

Open the Auth0 FGA dashboard:

`https://dashboard.fga.dev`

Create a store, then create this minimal model:

```fga
model
  schema 1.1

type user

type tool
  relations
    define invoke: [user]
```

Then add tuples for the current user:

- `user:YOUR_AUTH0_SUB invoke tool:read_slack`
- `user:YOUR_AUTH0_SUB invoke tool:post_slack_message`
- `user:YOUR_AUTH0_SUB invoke tool:read_emails`
- `user:YOUR_AUTH0_SUB invoke tool:send_email`

SecureDesk shows the exact tuple lines for the signed-in user in `/dashboard/settings`.

Put these values into `.env.local`:

- `FGA_API_URL`
- `FGA_STORE_ID`
- `FGA_MODEL_ID`
- `FGA_CLIENT_ID`
- `FGA_CLIENT_SECRET`
- `FGA_API_TOKEN_ISSUER`
- `FGA_API_AUDIENCE`

## 9. Configure CIBA and Guardian

CIBA is the preferred approval path for high-risk actions.

If your tenant supports it:

1. Enable the `CIBA` grant type on the SecureDesk application
2. Enable Guardian Push under:
   - `Security -> Multi-factor Auth`
3. Enroll the operating user in Guardian
4. Fill:
   - `AUTH0_CIBA_CLIENT_ID`
   - `AUTH0_CIBA_CLIENT_SECRET`
   - `AUTH0_CIBA_AUDIENCE`

If the tenant does not expose CIBA, SecureDesk will continue to work through the in-app approval path.

## 10. Gemini Flash

SecureDesk uses Gemini as the conversational layer. It can interpret requests and refine replies, but it does not replace the deterministic execution runtime.

Add to `.env.local`:

- `GEMINI_API_KEY_1`
- `GEMINI_API_KEY_2`
- `GEMINI_API_KEY_3`
- `GEMINI_API_KEY_4`
- `GEMINI_MODEL=gemini-3-flash-preview`

If only one key is available, fill `GEMINI_API_KEY_1` and leave the others empty.

## 11. Configure Postgres persistence

SecureDesk persists audit events and approval sessions in Postgres.

Recommended setup:

1. Link a Neon database to the Vercel project through `Storage`
2. Confirm Vercel injected:
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`
3. For local development, pull those variables into `.env.local`
4. Start the app and open:
   - `GET /api/migrate`

That route creates the `audit_logs` and `approval_sessions` tables used by the Trust Center and approval runtime.

## 12. Local environment reminder

`AUTH0_ISSUER_BASE_URL` must be the tenant root.

Correct:

`https://YOUR_TENANT.us.auth0.com`

Incorrect:

`https://YOUR_TENANT.us.auth0.com/api/v2/`

## 13. Final verification

Before recording:

1. Connect Slack in Settings
2. Connect Gmail in Settings
3. Confirm FGA tuples are in place
4. Test:
   - `List my Slack channels`
   - `Post a message to #general-securedesk saying: Hello from SecureDesk`
   - `List my unread emails`
   - `Summarize my emails from today`
   - `Send an email to teammate@example.com saying: Hello from SecureDesk`
5. Open `Audit Log`
6. Confirm the Trust Center shows live events
7. Refresh and verify the audit entries persist
8. Export CSV
