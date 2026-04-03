# SecureDesk

SecureDesk is a corporate AI agent built for the Auth0 hackathon **Authorized to Act: Auth0 for AI Agents**.

The project demonstrates how an assistant can act on behalf of a real user across external systems without exposing third-party tokens to the frontend, without relying on broad all-or-nothing permissions, and without executing sensitive actions invisibly.

SecureDesk is built with:

- Next.js 14
- TypeScript
- Tailwind CSS
- Auth0
- Auth0 Token Vault
- Auth0 Connected Accounts
- Auth0 Fine-Grained Authorization (FGA)
- Auth0 CIBA support with in-app review fallback
- Gemini Flash for intent parsing

## What SecureDesk does

Users interact with SecureDesk through a chat interface. Natural language requests are first mapped to a known action through Gemini Flash, and then SecureDesk routes them through a deterministic runtime that enforces the existing security controls.

Current supported live actions:

- List Slack channels
- Post a Slack message
- List unread Gmail messages
- Summarize today's Gmail messages
- Send a Gmail message

## Security architecture

SecureDesk is intentionally built around Auth0 as the control plane.

### 1. Auth0 Token Vault

Slack and Gmail are connected through Auth0 Connected Accounts and Token Vault. SecureDesk never stores provider tokens in the frontend and never manages raw third-party credentials manually.

### 2. Fine-Grained Authorization

Every tool action can be allowed or denied through Auth0 FGA. The runtime checks the user against `tool:*` permissions before executing Slack or Gmail actions.

### 3. High-risk approvals

High-risk actions such as posting to Slack or sending an email are intercepted before execution. SecureDesk initiates a CIBA flow when the tenant supports it and falls back to the existing in-app approval experience otherwise.

### 4. Auditability

Every action is written into the audit trail with service, action, risk level, user, metadata, timestamps, approval state, and export support.

## Current live product slice

The repository now contains a real end-to-end slice, not just mocked UX:

- Auth0 login and session management
- Slack connected through Token Vault
- Gmail connected through Token Vault
- FGA enforcement for action-level authorization
- Deterministic runtime for execution
- Gemini Flash as the intent parsing layer
- High-risk approval path
- Real-time Trust Center sidebar
- Audit Log page with CSV export

## Product flow

1. The user signs in with Auth0.
2. The user connects Slack and Gmail through Connected Accounts.
3. The user asks SecureDesk to perform an action in natural language.
4. Gemini Flash maps the request to a supported action.
5. SecureDesk checks FGA.
6. SecureDesk classifies the action as low-risk or high-risk.
7. If the action is high-risk, SecureDesk requires approval.
8. SecureDesk exchanges the Auth0 token through Token Vault and calls the external provider.
9. SecureDesk records the result in the audit trail.

## Example prompts

- `List my Slack channels`
- `Post a message to #general-securedesk saying: Hello from SecureDesk`
- `List my unread emails`
- `Summarize my emails from today`
- `Send an email to teammate@example.com saying: Hello from SecureDesk`

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill the values.
   For local development, point the Postgres variables to a real database.

3. Generate Prisma client:

```bash
npm run postinstall
```

4. Run the development server:

```bash
npm run dev
```

5. Once the app is running and the database connection is valid, call `GET /api/migrate` one time to create the audit and approval tables.

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

### Connected Account connections

- `SLACK_CONNECTION_NAME`
- `SLACK_CONNECTION_ID` (legacy fallback)
- `GMAIL_CONNECTION_NAME`
- `GMAIL_CONNECTION_ID`

### CIBA

- `AUTH0_CIBA_CLIENT_ID`
- `AUTH0_CIBA_CLIENT_SECRET`
- `AUTH0_CIBA_AUDIENCE`

### FGA

- `FGA_API_URL`
- `FGA_STORE_ID`
- `FGA_MODEL_ID`
- `FGA_CLIENT_ID`
- `FGA_CLIENT_SECRET`
- `FGA_API_TOKEN_ISSUER`
- `FGA_API_AUDIENCE`

### Gemini Flash

- `GEMINI_API_KEY`
- `GEMINI_MODEL`

### Database

- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

Important:

- `AUTH0_ISSUER_BASE_URL` must be the tenant root, for example `https://YOUR_TENANT.us.auth0.com`
- Do not append `/api/v2`
- When a Vercel Postgres database is linked to the project, Vercel injects these database variables automatically. Judges do not need to provision a database manually in Vercel.
- After the database is linked for the first time, call `GET /api/migrate` once to create the required `audit_logs` and `approval_sessions` tables.

## Auth0 setup checklist

Use `/dashboard/settings` inside the app as the live operational checklist.

The high-level order is:

1. Create a Regular Web Application in Auth0.
2. Create a custom API and set it as `AUTH0_AUDIENCE`.
3. Enable `Authorization Code`, `Refresh Token`, and `Token Vault`.
4. Enable MRRT and authorize `Auth0 My Account API`.
5. Configure Slack and Google social connections for Connected Accounts.
6. Create the Token Vault Custom API Client used for exchange.
7. Configure Auth0 FGA and add tuples for the current user.
8. Optionally configure CIBA and Guardian.

Detailed setup instructions live in [docs/auth0-setup.md](./docs/auth0-setup.md).

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

SecureDesk also shows the exact tuple values for the signed-in user in `/dashboard/settings`.

## Verification

Before recording or deploying to judges, run:

```bash
npm run lint
npm run build
```

## Submission notes

- Token Vault is active and used against real provider connections.
- Slack and Gmail are both live integrations.
- High-risk actions are approval-gated.
- The audit trail is visible in-app and exportable.
- Gemini Flash is used only as an intent parser; the deterministic runtime remains the execution layer.

## Bonus blog post

The repository includes a ready-to-publish blog post for the hackathon bonus submission in [BLOG.md](./BLOG.md).
