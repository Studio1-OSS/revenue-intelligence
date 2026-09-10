# Revenue-Intelligence

Turn customer feedback into account insights, revenue-risk signals, and evidence-backed answers.

Import GitHub issues, Airtable records, Tally responses, CSV files, or notes. Review customer accounts, spot expansion opportunities, and ask questions with citations to the original evidence.

[<img src="public/token-factory.png" width="48" height="48" alt="Token Factory">](https://dub.sh/aistudio)

**[Powered by Nebius Token Factory](https://dub.sh/aistudio)**. Bring your own AI key; each workspace's AI usage is billed to its Nebius account.

## Stack

| Layer | Technology |
| --- | --- |
| App | Next.js 16, React 19, TypeScript, Bun |
| AI platform | Nebius Token Factory |
| Chat and signals | NVIDIA Nemotron 3.5 Lightning or Nemotron 3 Super |
| Embeddings | Qwen3-Embedding-8B, requested at 1,536 dimensions |
| Database and search | Turso/libSQL, native vectors and FTS5 |
| Authentication | Auth0 |
| Deployment target | Vercel |

## Features

- Account dashboard with risk, expansion signals, and source evidence.
- GitHub Issues and Airtable manual sync, plus signed Tally webhooks.
- Semantic and keyword search, cited answers, and saved questions.
- Workspace-scoped MCP tools for external AI assistants.
- Server-side encrypted AI keys and workspace-isolated data.

**Prototype:** workspaces are personal; team invitations are not included. Demo company names are real, but all conversations and commercial figures are synthetic and imply no endorsement.

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

To deploy on Vercel, configure the required environment variables and apply the Turso migrations using the [deployment guide](DEPLOYMENT.md). Keep `.env.local` and provider tokens out of version control.

Run checks with `bun test`, `bun run typecheck`, and `bun run build`.

## License

[MIT](LICENSE).
