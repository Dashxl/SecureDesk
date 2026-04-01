# Auth0 Setup Guide for SecureDesk

This guide is written for the current SecureDesk demo path:

- real Auth0 login
- real Slack integration through Token Vault
- optional real Auth0 FGA checks
- optional CIBA phase 2
- deterministic command handling with zero LLM cost

## 1. Regular Web Application

Create a `Regular Web Application` in Auth0 for the Next.js app.

Use these local URLs during development:

- Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
- Allowed Logout URLs: `http://localhost:3000`
- Allowed Web Origins: `http://localhost:3000`

## 2. Custom API

Create a custom API in `Applications -> APIs`.

Recommended identifier:

`https://api.securedesk.com`

That same value should be used in `.env.local` as:

`AUTH0_AUDIENCE=https://api.securedesk.com`

## 3. Enable grant types for Token Vault

Open:

`Applications -> Applications -> SecureDesk -> Advanced Settings -> Grant Types`

Enable:

- Authorization Code
- Refresh Token
- Token Vault

If the `Token Vault` grant type is missing, ask the hackathon organizers or Auth0 contact whether your tenant has Token Vault enabled.

## 4. Authorize the My Account API

Open:

`Applications -> APIs -> Auth0 My Account API`

Authorize your SecureDesk application for the scopes needed by Connected Accounts and Token Vault.

Also open:

`Applications -> Applications -> SecureDesk -> Multi-Resource Refresh Token`

Edit the configuration and enable `My Account API`.

## 5. Connect Slack

Open:

`Authentication -> Social Connections -> Slack`

What to check:

0. If Slack does not exist yet, create the connection first from `Authentication -> Social Connections`.
1. The Slack connection is enabled for the SecureDesk application.
2. The Slack app inside your workspace has the scopes required for the demo.
3. `Connected Accounts for Token Vault` is enabled if the option is available.

Fastest hackathon path:

- Use Slack as the login connection for the demo user as well.
- That keeps the first live SecureDesk slice much simpler because the same Auth0 user already has the Slack connected account available to Token Vault.

Recommended scopes for the first demo slice:

- `channels:read`
- `groups:read`
- `chat:write`

If you do not see `Connected Accounts for Token Vault`, that usually means the tenant does not have the feature enabled yet.

## 6. FGA

Create a minimal model:

```fga
model
  schema 1.1

type user

type tool
  relations
    define invoke: [user]
```

Create tuples like:

- `user:auth0|YOUR_USER_ID invoke tool:read_slack`
- `user:auth0|YOUR_USER_ID invoke tool:post_slack_message`

Then copy these values into `.env.local`:

- `FGA_API_URL`
- `FGA_STORE_ID`
- `FGA_MODEL_ID`
- `FGA_CLIENT_ID`
- `FGA_CLIENT_SECRET`

## 7. CIBA

CIBA is optional for the first real slice.

If your tenant supports it:

1. Enable the `CIBA` grant type on the application.
2. Enable Guardian Push.
3. Enroll your demo user in Guardian.
4. Fill `AUTH0_CIBA_CLIENT_ID`, `AUTH0_CIBA_CLIENT_SECRET`, and `AUTH0_CIBA_AUDIENCE`.

If the option is not visible, treat CIBA as a phase-2 enhancement instead of blocking Token Vault.

## 8. Local environment reminder

`AUTH0_ISSUER_BASE_URL` must be the tenant root, not the Management API path.

Correct:

`https://YOUR_TENANT.us.auth0.com`

Incorrect:

`https://YOUR_TENANT.us.auth0.com/api/v2/`
