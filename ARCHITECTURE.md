# Revenue-Intelligence: How It Works

## The simple explanation

This app turns customer feedback into a searchable account history. A founder or customer-success person can see what customers are struggling with, what they want to buy next, and which alternatives they mention. Every useful AI insight should point back to the customer's actual words.

It is not a CRM replacement, billing system, automatic sales agent, or source of verified company revenue. It analyzes the information you choose to import. A GitHub bug is not automatically a cancellation threat, and a public GitHub author is not automatically a customer.

## The pieces

```text
Browser (Next.js dashboard)
    |
    +--> Auth0: signs the person in
    |
    +--> Next.js server: checks their workspace and permissions
                |
                +--> Tally: signed incoming form submissions
                +--> GitHub / Airtable: read-only manual sync
                +--> CSV / manual notes: direct imports
                |
                v
           Turso database
           Accounts, source documents, smaller text chunks
                |
                | User selects Process evidence
                v
           Nebius, using that workspace's encrypted API key
           Qwen embeddings: make meaning-based search possible
           Nemotron: identify supported signals and answer questions
                |
                v
           Turso: vectors, signals, citations, usage records
                |
                v
           Dashboard / account pages / cited answers

Optional external AI client --> Auth0 user access token --> MCP tools
```

**Next.js** is both the website and the server behind it. The browser never talks directly to Turso with your database credentials. **Auth0** confirms who signed in. **Turso** remembers each workspace's data. **Nebius** supplies AI models; it does not hold the app's user accounts or replace the database. **Vercel** is the planned public hosting service, not a data connector.

## A person's first session

1. Open the app and sign in. Auth0 returns a verified user identity, and the server creates an empty personal workspace. `/demo` is a separate, read-only fictional example.
2. Open Evidence Library. Connect a GitHub repository, an Airtable table, or a Tally form; alternatively import a CSV or paste a note. Connector credentials are separate from the AI key.
3. GitHub and Airtable owners press **Sync**. Each click reads up to 20 source records. **Sync next batch** continues a scan; after completion, **Sync** starts a new scan to check for changes. Tally sends submissions automatically once its webhook has been configured at a public HTTPS URL.
4. The server validates company domains and imports source text into the correct workspace. GitHub requires an explicit customer company/domain and optional customer label. Airtable and Tally use Company and Company domain fields. No company identity is inferred from an email, GitHub username, or repository owner.
5. Add a Nebius key in AI provider settings. Pick Lightning or Super. Verification makes a small billable request to the chat and embedding models.
6. Press **Process evidence**. Text is split into smaller chunks, embedded, and analyzed. New signals are associated with accounts and exact source quotes. Importing alone does not invoke AI.
7. Review the dashboard, open an account, and ask a question such as "What is preventing this customer from renewing?" The server retrieves relevant text, asks the selected model, and validates returned source quotes before saving the answer.

## How a company would use it

For this prototype, one designated person operates a workspace for their business. For example, a customer-success lead connects a customer-specific GitHub label, imports a feedback table, and sends a renewal survey through Tally. They review risks before account meetings, check original evidence, and decide what to do. The app does not send emails, modify tickets, close issues, or change CRM records.

**Important current limit:** every new signup gets a personal workspace. Team invitation, workspace switching in the UI, company-wide SSO, and an admin console are not implemented. The database has owner/member permissions and tenant isolation, but that alone does not make the product a finished collaborative company workspace. Do not share a login as a substitute. Team onboarding needs a separate implementation before a whole company can collaborate in one workspace.

## What happens during sync

- Source credentials are stored encrypted with both workspace and connection binding. Status APIs return configuration and counters, not tokens. Only an owner can connect, sync, or disconnect external sources.
- GitHub requests go only to `api.github.com`; Airtable requests go only to `api.airtable.com`. Requests are read-only, bounded, timed out, and do not follow redirects. Source links or attachment URLs in the returned content are never fetched.
- A stable provider record ID prevents repeated sync from adding duplicates within one connection. A content hash avoids reprocessing unchanged text. Overlapping GitHub label connections can still import the same issue separately, so use non-overlapping customer labels.
- Changed evidence keeps its document ID but replaces its chunks. Old vectors and detected signals are removed and new chunks are queued. These records need AI processing again. Previously stored chat answers are historical and may reference old chunks that no longer exist; they are not regenerated automatically.
- Sync and AI processing share a workspace lock to prevent concurrent updates during a normal job. Batch data and pagination progress commit together; a failed batch does not advance the cursor.
- This is not a full bidirectional mirror. Remote deletions, removed labels, lost permissions, and deleted Airtable records do not automatically erase previously imported evidence. An owner must remove that evidence in the app. Deleting an imported document also removes its sync mapping, so a later scan can import it again while the source remains connected.

## Asking questions

Embeddings turn text into numerical vectors so "canceling our contract" can be found for a question about "renewal risk." Qwen supplies both document and question embeddings. Turso combines that meaning-based search with keyword search, scoped to the current workspace. Nemotron then answers using the retrieved evidence.

An exact matching quote confirms where text came from, not whether the customer's statement is true or the AI's interpretation is correct. Account health is a simple heuristic, not a verified prediction. Review the source before making business decisions.

## Costs and data boundaries

Each workspace pays Nebius through its own key (BYOK). The app operator still pays any hosting, Auth0, Turso, and other service charges above their free allowances. A source API's free tier does not make AI processing free.

Customer text sent for processing goes to Nebius. Super uses the US Central endpoint; Lightning and Qwen embeddings use the global endpoint. Choose sources and model routing appropriate to the information you are authorized to process. Do not put tokens into customer notes or source text.

The browser login and connector protocols are implemented, but actual Auth0 callback completion, private source access, Airtable credentials, live Tally delivery, real Nebius calls, and public deployment require live acceptance testing. See [DEPLOYMENT.md](DEPLOYMENT.md) and [CONNECTORS.md](CONNECTORS.md).
