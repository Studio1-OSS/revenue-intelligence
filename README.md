# Revenue-Intelligence

Turn customer feedback into account insights, revenue-risk signals, and evidence-backed answers.

Import GitHub issues, Airtable records, Tally responses, CSV files, notes, or visual evidence from screenshots and exported slides. Review customer accounts, spot expansion opportunities, and ask questions with citations to the original evidence.

[<img src="public/token-factory.png" width="48" height="48" alt="Token Factory">](https://dub.sh/aistudio)

**[Powered by Nebius Token Factory](https://dub.sh/aistudio)**.

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
- MCP-ready foundation for future external AI assistant workflows.
- Server-side encrypted AI keys and workspace-isolated data.

## Integrations

Available today:

- CSV and manual evidence upload for exported support tickets, sales notes, account reviews, and spreadsheets.
- Visual evidence upload for screenshots, charts, dashboard exports, and slide images.
- GitHub Issues sync for product feedback and public/private issue queues.
- Airtable sync for lightweight customer tables and feedback databases.
- Tally webhooks for form submissions and intake workflows.

Common next connectors include Zendesk, HubSpot, Slack, Intercom, Linear, Jira, Salesforce, and Help Scout. Each new connector only needs to turn its records into Revenue-Intelligence evidence documents; the existing pipeline handles chunking, Qwen embeddings, Turso search, signal detection, and cited answers.

## Qwen-Powered Evidence Analysis

Revenue-Intelligence uses Qwen3.8-27B for customer-evidence reasoning and Qwen3-Embedding-8B for retrieval. Text notes, tickets, form submissions, CSV rows, and screenshots become searchable evidence that can produce cited answers, renewal-risk signals, expansion opportunities, and competitor mentions.

Visual evidence supports PNG, JPEG, and WebP uploads, making the app useful for screenshots of dashboards, charts, exported slides, and customer-shared product states. PDFs, docs, and decks can be exported as images before upload.

## Current Scope

Workspaces are personal; team invitations are not included yet. Demo company names are real, but all demo conversations and commercial figures are synthetic and imply no endorsement.

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
