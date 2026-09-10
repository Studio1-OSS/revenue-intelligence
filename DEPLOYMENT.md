# Deploy Revenue-Intelligence

Target: Vercel, Turso Cloud (libSQL), and Auth0. Each workspace supplies its own Nebius key after login. No platform Nebius key is needed.

## Public preview

With no Auth0, Turso, encryption, or cron configuration, Vercel builds the landing page and read-only demo without credentials. Workspace pages, authentication endpoints, and service APIs remain unavailable (503); this does not enable public signup or AI. A canonical `NEXT_PUBLIC_APP_URL` may be set independently. Once any service configuration is added, production builds require complete valid configuration. Configure the full service environment and apply migrations before enabling real workspaces.

## Current release status

The application has real server-side Auth0 sessions, libSQL persistence, encrypted workspace BYOK, processing, retrieval, chat, and MCP implementations. On 2026-09-07, the configured Turso Cloud database passed connection, all three migration checksums, native vector, and FTS readiness checks. It was initialized empty, with no demo records. Auth0 settings are configured locally; tenant discovery and the app-to-Universal-Login redirect passed, with email/password and Google sign-in offered. Interactive login, callback token exchange (including client-secret validation), workspace creation, Nebius calls, and public deployment remain unverified. Do not open public signup until the live acceptance checklist below passes.

Public fictional records are isolated at `/demo`. All normal workspace pages require authentication. New users receive an empty persisted personal workspace, not the fictional dashboard. A sample import is optional and explicitly initiated by the signed-in user.

On 2026-09-08, migration `004_tally_integration.sql` was applied to the configured Turso database. All four migration checksums, schema, native vectors, FTS, and Auth0 discovery passed. Signed Tally-format fixture tests pass locally; a live Tally delivery still requires a published form and a reachable HTTPS endpoint. No customer records or connector credentials were seeded into the live database during these tests.

## 1. Provision services

On 2026-09-09, migration `005_external_sources.sql` was applied and all five migration checksums, schema, FTS, native vectors, and Auth0 discovery passed. The GitHub adapter successfully read a public repository without a token; that smoke test performed no database writes or AI calls. GitHub private-token access and Airtable still need verification with the user's intended accounts. See [ARCHITECTURE.md](ARCHITECTURE.md) for the beginner-oriented system overview and current team-workspace limitations.

- Create a Turso Cloud database with the libSQL engine and an application token. Use its `libsql://` URL. The schema depends on native libSQL vectors and FTS5; do not substitute a different SQLite engine without migration testing.
- Create an Auth0 **Regular Web Application**. Enable the login connections you want public users to use. Configure the exact canonical app URL, callback `<APP_URL>/auth/callback`, logout `<APP_URL>`, and web origin `<APP_URL>`. Use separate localhost URLs for local development. Do not use wildcard production callbacks.
- For MCP, register an Auth0 API identifier, expose the `read:insights` scope, and configure an external public/native client with PKCE and appropriate callback URLs. Set `AUTH0_AUDIENCE` to that API identifier. Without it, MCP returns a configuration error while browser login can still work.

## 2. Configure secrets

Set production values in Vercel's environment settings. Keep preview environments on separate Auth0 applications and Turso databases.

| Variable                | Value                                                       |
| ----------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`   | Canonical HTTPS origin, no trailing slash                   |
| `APP_ENV`               | `production` on non-Vercel hosts; Vercel uses `VERCEL_ENV`  |
| `AUTH0_DOMAIN`          | Tenant hostname without `https://`                          |
| `AUTH0_CLIENT_ID`       | Regular Web Application client ID                           |
| `AUTH0_CLIENT_SECRET`   | Application secret                                          |
| `AUTH0_SECRET`          | Independent `openssl rand -hex 32` value                    |
| `AUTH0_AUDIENCE`        | Auth0 API identifier for MCP, optional for browser-only use |
| `TURSO_DATABASE_URL`    | Turso Cloud libSQL URL                                      |
| `TURSO_AUTH_TOKEN`      | Database application token                                  |
| `KEY_ENCRYPTION_SECRET` | Independent `openssl rand -hex 32` value; back up securely  |
| `CRON_SECRET`           | Independent random secret, at least 32 characters           |

Run `bun run check:env` with production variables loaded. The check prints missing names and configuration errors only, never values. Runtime secrets do not belong in `NEXT_PUBLIC_*` variables.

For local verification use one consistent origin: `http://localhost:3000` for the browser, `NEXT_PUBLIC_APP_URL`, and the Auth0 callback/logout settings. `http://127.0.0.1:3000` is a different origin; do not mix them. `bun run check:env --local` permits local origins. Use a development Turso database or `file:local.db`; cloud readiness must still be checked against the deployment database.

The current ignored `.env.local` uses `http://127.0.0.1:3000`. For this configuration, register `http://127.0.0.1:3000/auth/callback` as the Allowed Callback URL and `http://127.0.0.1:3000` as both Allowed Logout URL and Allowed Web Origin. In Auth0, create a Regular Web Application named Revenue-Intelligence and enter its Settings values into `AUTH0_DOMAIN` (hostname only), `AUTH0_CLIENT_ID`, and `AUTH0_CLIENT_SECRET`. App-owned session, encryption, and cron secrets have already been generated locally. Use fresh independent secrets and rotate any credentials shared in chat before production.

## 3. Migrate and deploy

1. Run `bun install --frozen-lockfile`, `bun test`, `bun run typecheck`, and `bun run build`.
2. Run `bun run db:migrate` with production Turso credentials in the process environment. Migrations are explicit and checksum tracked. They are not run during every Vercel build or request.
3. Run `bun run check:services` with the target environment loaded. This validates tenant discovery and database connectivity, migration checksums, native vectors, and FTS. It is read-only and does not send customer data to Auth0 or make billable AI calls. It cannot validate client secrets or callback registration without a real login.
4. Import the repository in Vercel as Next.js with the repository root as Root Directory. `vercel.json` runs `build:deploy` with pinned Bun. Credential-free builds provide only the public preview; once service configuration is present, builds reject missing required values or file storage. Do not override this with the unchecked local build command.
5. Set the canonical deployment domain and update Auth0 callback/logout/origin settings and `NEXT_PUBLIC_APP_URL` to match. Redeploy after changing runtime variables.

## Live acceptance checklist

For an upgrade, pause processing and drain in-flight AI requests before applying migration `003_qwen_embeddings.sql` and deploying the new code. It queues old search vectors for Qwen re-embedding without deleting uploaded evidence or reclassifying completed signals. Do not roll back to code using the old embedding model against the migrated database. Existing owners must select and verify a supported Nemotron model in AI settings. No `NEBIUS_CHAT_MODEL` or platform `NEBIUS_API_KEY` environment variable is used.

- [ ] `/api/health` returns 200. A 503 means configuration or database readiness has failed. The endpoint reveals no credentials or database contents and is not a substitute for the checks below.
- [ ] `/demo` works without login; `/dashboard` redirects signed-out visitors to Auth0, never to sample data.
- [ ] Sign up with a new Auth0 user, complete the callback, refresh, and log out. Confirm an empty personal workspace is persisted after login.
- [ ] Repeat with a second user; verify the users cannot retrieve each other's accounts, sources, chat threads, or keys even with explicit IDs and `x-workspace-id` headers.
- [ ] Before connecting a key, AI endpoints return `AI_KEY_REQUIRED`. Add a Nebius key in `/settings/ai`; confirm embedding and selected chat model verification completes.
- [ ] Verify both Nemotron choices with a real key, including the US Central endpoint for Super. Switch using the saved key and confirm failed verification leaves the previous setting unchanged. Qwen embeddings always use the global endpoint, not the Super region; confirm this routing meets your data handling requirements.
- [ ] Import a small real CSV, process all chunks, read a detected signal and source quote, search, and ask a cited question. Confirm usage in the workspace and Nebius account.
- [ ] Apply migration `004_tally_integration.sql`, connect a published Tally form with a signing secret and public HTTPS endpoint, submit real feedback, and confirm one pending evidence document. Retry the same event from Tally's log and confirm no duplicate. Process it with the workspace's key. See [TALLY_SETUP.md](TALLY_SETUP.md).
- [ ] Apply migration `005_external_sources.sql`. Connect a public GitHub repository without a token, a private repository with a restricted token, and an Airtable table with a read-only token. Test pagination, repeated sync, changed feedback, disconnect, and source links. Confirm no AI calls occur until processing. See [CONNECTORS.md](CONNECTORS.md).
- [ ] Unauthenticated data APIs return 401, cross-origin mutations return 403, invalid cron and MCP tokens return 401.
- [ ] Connect an MCP client with a real Auth0 user access token and `read:insights`; test all four tools against that user's workspace.
- [ ] Create and revoke a shared-question link. Confirm the link exposes only the explicitly shared question, not sources or answers.
- [ ] Configure monitoring for `/api/health`, function failures and processing backlog. Verify a Turso restore procedure and back up the encryption secret before accepting customer data.
- [ ] Review public privacy/retention terms, Auth0 signup/verification and abuse controls, service limits, and expected hosting costs for your launch audience.

## Processing schedule

The included cron runs daily at 03:00 UTC and processes up to three chunks in one eligible workspace. The UI's Process evidence action runs batches immediately and works independently of cron. Each processing route allows up to 300 seconds; ensure your Vercel plan permits this duration.

For sustained production imports, use a scheduler every five minutes (subject to Vercel plan support) or a durable worker invoking the same authenticated endpoint. Each run selects the least recently used eligible workspace and uses a lease to avoid duplicates. Do not increase the number of workspaces handled in one request without accounting for the function duration limit. Failed chunks require an explicit retry from the evidence library.

## Operational limits

- 2 MB CSV uploads, 100 rows and 250 chunks per import, 20,000 characters per document, 500 documents per workspace.
- Workspace database rate limits cover chat, search, imports, key verification, saved questions and processing.
- Tally webhooks accept up to 100 KB and 60 signed deliveries/minute per connection. They queue evidence without making AI calls. The form is not live-verified until a signed submission is persisted; configure a public HTTPS endpoint before testing external delivery.
- Key disconnection stops new AI jobs. An already-running provider request may complete. Losing the encryption secret makes stored keys unusable.
- Quotes and source IDs are validated, but AI signals and health scores remain estimates for human review.
- Chat history is stored within the workspace; shared links never include that history. Account membership tables support isolation; v1 creates one personal workspace per user and does not include a team invitation workflow.
- No payment processing, arbitrary external data scraping, or platform-subsidized AI is included. Supported connectors are listed in CONNECTORS.md.

## Live verification status

Local tests and builds can validate code, protocol handling, and database behavior. Auth0 tenant configuration, real Nebius requests, Turso Cloud connectivity, and public Vercel deployment must be verified using the actual service accounts. Do not represent the public service as connected until these checks are complete.
