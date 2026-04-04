# SecureDesk

SecureDesk is a production-minded corporate AI agent built for the Auth0 hackathon **Authorized to Act: Auth0 for AI Agents**.

The project shows how an AI agent can act on behalf of a real user across Slack and Gmail while keeping provider credentials inside Auth0 Token Vault, enforcing explicit authorization boundaries, requiring approval for sensitive actions, and writing every meaningful step to a persistent audit trail.

## What SecureDesk does

SecureDesk gives the user a natural-language workspace where they can ask the agent to operate across connected business tools. The language layer makes the interaction feel conversational, but the execution layer stays deterministic and policy-driven.

Current live actions:

- List Slack channels
- Post a Slack message
- List unread Gmail messages
- Summarize today's Gmail messages
- Send a Gmail message

The product is built around a visible trust model:

- the user explicitly connects Slack and Gmail through Auth0 Connected Accounts
- SecureDesk checks Auth0 FGA before running any provider action
- high-risk actions pause for approval through CIBA / Guardian when available, with a secure in-app review fallback
- provider access is exchanged server-side through Token Vault
- every action is written to a persistent audit log and surfaced in the Trust Center

## Fully implemented architecture

### Identity, delegation, and policy

- Auth0 Next.js SDK for login, sessions, and protected routes
- Auth0 Connected Accounts for Slack and Gmail user connections
- Auth0 Token Vault for delegated provider token exchange
- Auth0 FGA for per-tool authorization
- Auth0 CIBA and Guardian for external approval of high-risk actions
- Secure in-product approval runtime when CIBA is unavailable

### Agent and application runtime

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- Zustand for client state used by the Trust Center and audit views
- Lucide React icons

### AI layer

- Gemini `gemini-2.5-flash`
- Gemini integration for natural-language intent parsing and response refinement
- Graceful fallback to deterministic responses when Gemini is unavailable
- Natural-language intent parsing plus response polishing, while execution remains deterministic

### Persistence and infrastructure

- Neon Postgres linked through Vercel Storage
- `@vercel/postgres` raw SQL for persistent audit logs and approval sessions
- Prisma Client for connected-service snapshots used by the settings experience
- Vercel-ready environment variable flow for cloud deployment

## End-to-end flow

1. The user signs in with Auth0.
2. The user connects Slack and Gmail in Settings through Auth0 Connected Accounts.
3. The user asks SecureDesk to perform an action in natural language.
4. Gemini interprets or refines the request when available.
5. SecureDesk resolves the request into a known action inside the runtime.
6. Auth0 FGA decides whether the current user may invoke that tool.
7. SecureDesk classifies the action as low-risk or high-risk.
8. High-risk actions pause for approval through CIBA / Guardian or the in-product review flow.
9. SecureDesk exchanges delegated provider access through Auth0 Token Vault.
10. Slack or Gmail is called server-side.
11. The result is stored in Postgres and surfaced in the Audit Log and Trust Center.

## Security model

SecureDesk is designed to score well against the hackathon's security and user-control criteria.

### Token isolation

Slack and Gmail tokens are never exposed to the frontend. SecureDesk requests delegated access only when it is ready to execute a permitted action.

### Explicit permissions

Each supported tool action is protected by Auth0 FGA. The runtime fails closed if policy is unavailable.

### High-risk approval

Write actions such as posting to Slack or sending email require explicit review before release. Approval state is validated server-side and persisted in the database.

### Persistent auditability

Audit entries and approval sessions are stored in Postgres, so they survive refreshes, cold starts, and redeploys. The Trust Center and Audit Log read from the database in real time.

## Current product surfaces

The repository contains a complete working product slice:

- marketing landing page
- Auth0 sign-in flow
- workspace chat UI
- Slack and Gmail connection flow in Settings
- live Trust Center sidebar
- Audit Log page with filters and CSV export
- approval modal and CIBA polling flow
- persistent audit log and approval-session storage

## Example prompts

- `List my Slack channels`
- `Post a message to #general-securedesk saying: Hello from SecureDesk`
- `List my unread emails`
- `Summarize my emails from today`
- `Send an email to teammate@example.com saying: Hello from SecureDesk`
- `What can you do for me today?`

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill the values.

3. Generate Prisma Client:

```bash
npm run postinstall
```

4. Start the development server:

```bash
npm run dev
```

5. Once Postgres is configured, call the migration route one time:

```txt
GET /api/migrate
```

That route creates the persistent `audit_logs` and `approval_sessions` tables.

## Required environment variables

### Auth0

- `AUTH0_SECRET`
- `AUTH0_BASE_URL`
- `AUTH0_ISSUER_BASE_URL`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_AUDIENCE`

### Token Vault exchange client

- `AUTH0_TOKEN_VAULT_CLIENT_ID`
- `AUTH0_TOKEN_VAULT_CLIENT_SECRET`

### Connected Accounts

- `AUTH0_TOKEN_VAULT_ENABLED`
- `SLACK_CONNECTION_NAME`
- `SLACK_CONNECTION_ID`
- `GMAIL_CONNECTION_NAME`
- `GMAIL_CONNECTION_ID`

### CIBA / Guardian

- `AUTH0_CIBA_CLIENT_ID`
- `AUTH0_CIBA_CLIENT_SECRET`
- `AUTH0_CIBA_AUDIENCE`

### Auth0 FGA

- `FGA_API_URL`
- `FGA_STORE_ID`
- `FGA_MODEL_ID`
- `FGA_CLIENT_ID`
- `FGA_CLIENT_SECRET`
- `FGA_API_TOKEN_ISSUER`
- `FGA_API_AUDIENCE`

### Gemini

- `GEMINI_API_KEY_1`
- `GEMINI_API_KEY_2`
- `GEMINI_API_KEY_3`
- `GEMINI_API_KEY_4`
- `GEMINI_MODEL`

### Database

- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

Important notes:

- `AUTH0_ISSUER_BASE_URL` must be the tenant root such as `https://YOUR_TENANT.us.auth0.com`
- do not append `/api/v2`
- when Neon is linked to the Vercel project through Storage, Vercel injects the Postgres variables automatically
- after linking the database for the first time, call `GET /api/migrate` once

## Vercel deployment

SecureDesk is designed to deploy on Vercel.

Recommended production setup:

1. Link the project to Neon through `Vercel Storage`.
2. Confirm Vercel injected the Postgres variables.
3. Add the Auth0, FGA, CIBA, Slack, Gmail, and Gemini variables in Project Settings.
4. Deploy the app.
5. Open `/api/migrate` once in the deployed environment.

No ORM migrations are required for the audit and approval core tables because they are created by the migration route.

## Auth0 setup checklist

Use `/dashboard/settings` as the live operational checklist inside the product.

High-level order:

1. Create a Regular Web Application in Auth0.
2. Create the custom backend API used as `AUTH0_AUDIENCE`.
3. Enable Authorization Code, Refresh Token, and Token Vault.
4. Enable Multi-Resource Refresh Token and authorize the My Account API.
5. Configure Slack and Google social connections for Connected Accounts.
6. Create the dedicated Token Vault exchange client.
7. Configure Auth0 FGA and add tuples for the signed-in user.
8. Configure CIBA and Guardian if your tenant supports them.

Detailed instructions live in [docs/auth0-setup.md](./docs/auth0-setup.md).

## Recommended FGA model

```fga
model
  schema 1.1

type user

type tool
  relations
    define invoke: [user]
```

Example tuples:

- `user:auth0|abc123 invoke tool:read_slack`
- `user:auth0|abc123 invoke tool:post_slack_message`
- `user:auth0|abc123 invoke tool:read_emails`
- `user:auth0|abc123 invoke tool:send_email`

SecureDesk also surfaces the exact tuple values for the signed-in user in `/dashboard/settings`.

## Verification

Before recording the demo or shipping to judges, run:

```bash
npm run lint
npm run build
```

Then verify:

- Slack connects successfully
- Gmail connects successfully
- low-risk reads work
- high-risk writes pause for approval
- approvals resume execution correctly
- the Audit Log shows persistent entries after refresh
- the Trust Center updates from database-backed audit data

## Submission notes

- Auth0 Token Vault is part of the live runtime, not just the story
- Slack and Gmail are both real connected integrations
- FGA gates tool execution before provider calls
- CIBA / Guardian can approve high-risk actions when available
- SecureDesk falls back to an in-product review flow when CIBA is unavailable
- audit events and approval sessions persist in Postgres
- Gemini improves the conversational experience without taking over execution control

## Bonus blog post

The repository includes a ready-to-publish blog post for the hackathon bonus submission in [BLOG.md](./BLOG.md).
