# Deploy Revenue-Intelligence

Revenue-Intelligence is designed to run on Vercel with Turso Cloud, Auth0, and user-supplied Nebius Token Factory keys. The app does not need a platform-wide Nebius key: each workspace connects its own key in AI settings.

## Deployment Modes

### Public Preview

If Auth0, Turso, encryption, and cron secrets are not configured, the app can still deploy a public landing page and read-only demo. In this mode, real workspace routes and service APIs return configuration errors instead of pretending to work.

Use this mode for demos, hackathon judging, landing-page review, and template previews.

### Full Workspace App

To enable sign-in, private workspaces, evidence import, AI processing, search, and chat, configure all required services and run database migrations before inviting users.

## Services

- **Vercel** hosts the Next.js app.
- **Turso Cloud** stores users, workspaces, evidence, chunks, embeddings, signals, chat, connector state, and usage events.
- **Auth0** handles browser login.
- **Nebius Token Factory** is BYOK: users add their own AI key after signing in.
- **Tally, GitHub, and Airtable** are optional data sources available in the current app.

## Environment Variables

Set these in Vercel for the environment you want to enable:

| Variable                | Value                                                      |
| ----------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`   | Canonical HTTPS origin, no trailing slash                  |
| `APP_ENV`               | `production` on non-Vercel hosts; Vercel uses `VERCEL_ENV` |
| `AUTH0_DOMAIN`          | Tenant hostname without `https://`                         |
| `AUTH0_CLIENT_ID`       | Auth0 Regular Web Application client ID                    |
| `AUTH0_CLIENT_SECRET`   | Auth0 application secret                                   |
| `AUTH0_SECRET`          | Independent `openssl rand -hex 32` value                   |
| `AUTH0_AUDIENCE`        | Optional Auth0 API identifier for future MCP access        |
| `MCP_FEATURE_ENABLED`   | `false` for normal launch; `true` only after MCP testing   |
| `TURSO_DATABASE_URL`    | Turso Cloud `libsql://` URL                                |
| `TURSO_AUTH_TOKEN`      | Turso database application token                           |
| `KEY_ENCRYPTION_SECRET` | Independent `openssl rand -hex 32` value; back up securely |
| `CRON_SECRET`           | Independent random secret, at least 32 characters          |

Keep runtime secrets out of `NEXT_PUBLIC_*` variables and out of version control.

## Auth0 Setup

Create an Auth0 **Regular Web Application**.

Configure:

- Allowed Callback URL: `<APP_URL>/auth/callback`
- Allowed Logout URL: `<APP_URL>`
- Allowed Web Origin: `<APP_URL>`

For local development, use one consistent origin. `http://localhost:3000` and `http://127.0.0.1:3000` are different origins, so do not mix them in Auth0 settings.

## Turso Setup

Create a Turso Cloud database using libSQL. The app relies on native vector functions and FTS5, so do not swap in a generic SQLite host without testing migrations and search.

Run migrations with production Turso credentials loaded:

```sh
bun run db:migrate
```

Run service checks:

```sh
bun run check:env
bun run check:services
```

`check:services` validates Auth0 discovery, database connectivity, migration checksums, native vector support, and FTS. It does not perform a full browser login or billable AI request.

## Vercel Setup

Import the repository as a Next.js project. The included `vercel.json` uses:

```sh
bun install --frozen-lockfile
bun run build:deploy
```

Run the same checks locally before pushing:

```sh
bun install --frozen-lockfile
bun test
bun run typecheck
bun run build:deploy
```

After deployment, set `NEXT_PUBLIC_APP_URL` to the final Vercel domain or custom domain and update Auth0 callback/logout/origin settings to match.

## Launch Checklist

- [ ] `/demo` works without login.
- [ ] `/dashboard` redirects signed-out visitors to Auth0.
- [ ] New Auth0 signup completes callback and creates an empty personal workspace.
- [ ] A second user cannot access the first user's accounts, sources, chat threads, or AI key metadata.
- [ ] AI endpoints return `AI_KEY_REQUIRED` before a workspace key is connected.
- [ ] A workspace owner can add a Nebius key and verify the selected chat and embedding models.
- [ ] CSV/manual import creates pending evidence.
- [ ] Visual evidence upload works for PNG, JPEG, or WebP images.
- [ ] Processing evidence creates embeddings, cited signals, usage events, and searchable chunks.
- [ ] Ask and Find Sources return workspace-scoped, cited results.
- [ ] Tally webhook delivery is tested against the deployed HTTPS URL.
- [ ] GitHub Issues sync is tested with one public repository.
- [ ] Private GitHub or Airtable sync is tested only with restricted read-only credentials.
- [ ] Invalid cron and MCP requests are rejected.
- [ ] Shared-question links expose only the intended public question metadata.
- [ ] Monitoring covers `/api/health`, function failures, processing backlog, and Turso availability.

## Processing Schedule

The included Vercel cron runs daily at 03:00 UTC and processes a small batch from one eligible workspace. Users can also process evidence immediately from the Evidence Library.

For larger deployments, use a more frequent scheduler or a durable worker that invokes the same protected processing endpoint. Keep function duration limits and provider rate limits in mind.

## Operational Limits

- 2 MB CSV uploads.
- 100 rows and 250 chunks per import.
- 5 MB visual image uploads.
- 20,000 characters per evidence document.
- 500 evidence documents per workspace.
- 20 GitHub/Airtable source records per sync batch.
- 100 KB Tally webhook payloads.

AI signals and account health are decision-support signals, not guarantees. Review source evidence before taking business action.

## Using This As A Template

This repo can be cloned or marked as a GitHub template for other revenue-intelligence apps. Good extension points are:

- Add new connectors that map external records into evidence documents.
- Add team workspaces and invitations.
- Replace Auth0 with another identity provider.
- Add billing around workspace seats or usage.
- Add native Zendesk, HubSpot, Slack, Intercom, Linear, Jira, Salesforce, or Help Scout connectors.

When adapting the template, keep the core safety rule: every AI insight should trace back to source evidence in the user's workspace.
