# Revenue-Intelligence

Turn customer feedback into account insights, revenue-risk signals, and evidence-backed answers.

Import GitHub issues, Airtable records, Tally responses, CSV files, notes, or visual evidence from screenshots and exported slides. Review customer accounts, spot expansion opportunities, and ask questions with citations to the original evidence.

[<img src="public/token-factory.png" width="48" height="48" alt="Token Factory">](https://dub.sh/aistudio)

**[Powered by Nebius Token Factory](https://dub.sh/aistudio)**. Bring your own AI key; each workspace's AI usage is billed to its Nebius account.

## Stack

| Layer               | Technology                                                                |
| ------------------- | ------------------------------------------------------------------------- |
| App                 | Next.js 16, React 19, TypeScript, Bun                                     |
| AI platform         | Nebius Token Factory                                                      |
| Chat and signals    | Qwen3.8-27B (default), NVIDIA Nemotron 3.5 Lightning, or Nemotron 3 Super |
| Embeddings          | Qwen3-Embedding-8B, requested at 1,536 dimensions                         |
| Database and search | Turso/libSQL, native vectors and FTS5                                     |
| Authentication      | Auth0                                                                     |
| Deployment target   | Vercel                                                                    |

## Features

- Account dashboard with risk, expansion signals, and source evidence.
- GitHub Issues and Airtable manual sync, plus signed Tally webhooks.
- Qwen-powered extraction for chart, slide, dashboard, and document screenshots.
- Semantic and keyword search, cited answers, and saved questions.
- MCP access for external AI assistants is included as an inactive developer-preview route.
- Server-side encrypted AI keys and workspace-isolated data.

## Integrations

Revenue-Intelligence ships with CSV/manual evidence upload, visual evidence upload, GitHub Issues, Airtable, and Tally webhooks. These cover the first prototype use cases: product feedback, support-style tickets, intake forms, account notes, screenshots, and spreadsheet exports.

The connector layer is designed to be extended with customer systems such as Zendesk, HubSpot, Slack, Intercom, Linear, Jira, Salesforce, or Help Scout. Those connectors can map external records into the same evidence pipeline: source document -> chunks -> Qwen embeddings -> Turso search -> cited account signals.

**Prototype:** workspaces are personal; team invitations are not included. Demo company names are real, but all conversations and commercial figures are synthetic and imply no endorsement.

Qwen3.8-27B uses the model ID `Qwen/Qwen3.8-27B` through Nebius's global endpoint. Availability is verified with your workspace key when connecting. Existing workspaces retain their selected model until changed in AI settings. Visual evidence currently supports PNG, JPEG, and WebP images; export PDF pages, docs, and deck slides as images before upload. Search embeddings remain Qwen3-Embedding-8B, so changing chat models does not require re-embedding evidence.

## Get Started

```sh
git clone https://github.com/Studio1-OSS/revenue-intelligence.git
cd revenue-intelligence
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

Use Node.js 22.x and Bun 1.4.0. Open [localhost:3000](http://localhost:3000) for the landing page or `/demo` for the read-only sample workspace. Real workspaces require Auth0 configuration and database migrations. Add your Nebius key in **Nebius AI key**, import evidence, then select **Process evidence**.

## Documentation

- [Architecture and user workflow](ARCHITECTURE.md)
- [Connector setup](CONNECTORS.md)
- [Vercel deployment, environment variables, and launch checklist](DEPLOYMENT.md)

Vercel supports a credential-free landing page and read-only demo deployment. To enable real workspaces, configure the required environment variables and apply the Turso migrations using the [deployment guide](DEPLOYMENT.md). Partial service configuration is rejected. Keep `.env.local` and provider tokens out of version control.

Run checks with `bun test`, `bun run typecheck`, and `bun run build`.

## License

[MIT](LICENSE).
