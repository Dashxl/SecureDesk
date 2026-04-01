# SecureDesk

SecureDesk is a corporate AI agent built for the Auth0 hackathon "Authorized to Act: Auth0 for AI Agents".

The project explores a safer model for enterprise AI assistants: the agent can act on behalf of a real user, but only inside explicit security boundaries. Instead of handing raw third-party credentials to the model, SecureDesk uses Auth0 as the control plane for authentication, delegated access, and approval flows.

## What the project does

Users interact with SecureDesk through a chat interface. In the current zero-cost demo mode, SecureDesk uses deterministic command handling instead of a paid LLM API while preserving the same delegated-action security story.

- Low-risk actions such as listing Slack channels can proceed immediately.
- High-risk actions such as posting to Slack require explicit approval before execution.
- Every meaningful action is recorded in the audit trail.

## Hackathon architecture

SecureDesk is designed around three Auth0 capabilities:

- `Token Vault`: external provider tokens are stored in Auth0, not in the frontend or app database.
- `Fine-Grained Authorization (FGA)`: users can be allowed or denied per tool, not only by broad role.
- `CIBA`: optional phase-2 approval path for stronger out-of-band confirmation.

## Current demo slice

The repository is now aligned around a narrow but real demo:

- Auth0 login for a real user session
- Slack as the first live external integration
- Auth0 Token Vault exchange path for Slack
- Optional Auth0 FGA checks before Slack tools run
- Approval interception for high-risk Slack actions
- Deterministic command parsing with zero LLM cost

Gmail and Jira remain scaffolded in the codebase, but they are intentionally not presented as live integrations until they are connected through Token Vault as well.

For the fastest live demo path, enable Slack as the Auth0 social connection and sign in with Slack for the demo user.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill the values.

3. Generate Prisma client:

```bash
npm run postinstall
```

4. Run the dev server:

```bash
npm run dev
```

## Environment variables

These are the main values you need:

- `AUTH0_SECRET`
- `AUTH0_BASE_URL`
- `AUTH0_ISSUER_BASE_URL`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_AUDIENCE`
- `AUTH0_TOKEN_VAULT_CLIENT_ID`
- `AUTH0_TOKEN_VAULT_CLIENT_SECRET`
- `SLACK_CONNECTION_NAME` (preferred)
- `SLACK_CONNECTION_ID` (legacy fallback)
- `FGA_API_URL`
- `FGA_STORE_ID`
- `FGA_MODEL_ID`
- `FGA_CLIENT_ID`
- `FGA_CLIENT_SECRET`

Important:

- `AUTH0_ISSUER_BASE_URL` must be the tenant root, for example `https://YOUR_TENANT.us.auth0.com`
- Do not append `/api/v2`

## Auth0 setup checklist

The most important requirement for the hackathon is Token Vault. Configure the project in this order:

1. Create a Regular Web Application in Auth0 for the Next.js app.
2. Create a custom API and use its identifier as `AUTH0_AUDIENCE`.
3. In the application grant types, enable `Authorization Code`, `Refresh Token`, and `Token Vault`.
4. In the application `Multi-Resource Refresh Token` settings, enable `My Account API`.
5. Enable and connect Slack through Auth0 Connected Accounts / Token Vault.
6. Optionally create a minimal Auth0 FGA model for `tool:read_slack` and `tool:post_slack_message`.
7. Treat CIBA as an optional phase 2 if your tenant supports it.

You can also open the in-app Settings page, which now acts as a live setup checklist.

## Supported commands

The current zero-cost demo mode supports these commands without any external LLM:

- `List my Slack channels`
- `Show my Slack channels`
- `Post a message to #general saying: Hello from SecureDesk`

## Recommended FGA model

For the first real demo slice, this minimal model is enough:

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

## Verification

Use these commands before recording the demo or shipping to judges:

```bash
npm run lint
npm run build
```

## Notes for judges

- The live security path in this repo is intentionally narrow so it can be real and auditable.
- Slack is the first live integration.
- Gmail and Jira remain visible as future integrations, but the app does not pretend they are already live.
