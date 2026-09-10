# Prototype Connectors

## Available now

| Source        | What is imported                                    | Access                                                                      | Trigger            |
| ------------- | --------------------------------------------------- | --------------------------------------------------------------------------- | ------------------ |
| Tally         | Company, domain, feedback, optional title           | Per-form signing secret                                                     | Signed webhook     |
| GitHub Issues | Title, description, issue number, open/closed state | No token for public repositories; restricted token for private repositories | Owner selects Sync |
| Airtable      | Company, Company domain, Feedback, optional Title   | Personal access token with read access to one base                          | Owner selects Sync |
| CSV / manual  | Customer evidence and optional account fields       | Signed-in workspace                                                         | Import             |

Other API connectors are not implemented. Spreadsheets exported as CSV work with the existing upload.

## GitHub setup

1. Use a repository you are authorized to analyze. For a shared repository, create or choose a customer-specific label. Importing an entire general-purpose repository into one customer's account would be misleading.
2. In Evidence Library, select **GitHub Issues**. Enter `owner/repository`, the actual customer company name/domain, and optionally the customer label. Confirm that these issues belong to that account.
3. Public repository: leave the token blank. Private repository: create a fine-grained token restricted to that repository with **Issues: Read-only**. Organization approval may be required. Paste it only into the app's password field, never into a chat message or an evidence document.
4. Select **Verify connection**. This reads the first page to check access without importing it. Then use **Sync** and **Sync next batch** until the scan is complete.
5. Process the pending evidence using the workspace's Nebius key.

We request open and closed issues, oldest-created first, up to 20 API items per batch. GitHub's endpoint also returns pull requests; these are counted as skipped, not imported. A PR-only page can therefore import zero documents while still having a next page. Comments, attachments, code, and discussions are not imported. URLs are constructed from the configured repository and issue number, not trusted from provider payloads. Source documents offer **Open original source**.

Renamed repositories return an error rather than following redirects with a token. Connect the current repository name after reviewing the old imported records. Closing an issue changes the imported state after a scan reaches it; human business risk resolution is not inferred automatically from that state alone.

Official references: [repository issues and token permissions](https://docs.github.com/en/rest/issues/issues#list-repository-issues), [token setup](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [API limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Airtable setup

Create a table with plain-text fields using these exact names:

| Field          | Requirement                           |
| -------------- | ------------------------------------- |
| Company        | Company name, 1-120 characters        |
| Company domain | Domain only, e.g. `customer.com`      |
| Feedback       | Text with at least 20 characters      |
| Title          | Optional text, maximum 200 characters |

Use plain text, not linked records or arrays. Extra fields are ignored during import; attachments are not downloaded. An invalid row rejects its entire batch rather than silently omitting that customer's feedback. Correct the row and retry.

Create a personal access token with **data.records:read**, granting access only to this base. Obtain the `app...` base ID and `tbl...` table ID from the base/table URL. Enter both IDs and the token under **Airtable** in Evidence Library, verify, and sync. No schema-write, record-write, or billing permissions are needed. The prototype does not require OAuth setup or a public webhook URL for this manual pull.

Airtable's free plan permits 1,000 API calls per workspace per month; setup verification and every sync batch each consume a call. The API also limits requests per base. These are provider limits, not an unlimited free allowance. Official references: [API and pagination](https://support.airtable.com/articles/6292134965-getting-started-with-airtable-s-web-api), [token permissions](https://support.airtable.com/articles/9934989703-creating-personal-access-tokens), [API limits](https://support.airtable.com/articles/7735693959-managing-api-call-limits-in-airtable).

## Tally setup

See [TALLY_SETUP.md](TALLY_SETUP.md). The connector already exists. Unlike the manual pull connectors, Tally needs a public HTTPS URL to reach the app. Its webhook feature is available free; Nebius processing still uses the workspace's billed AI key.

## Sync limits and safety

- Apply migration `005_external_sources.sql` before using GitHub/Airtable. It adds connection and record-mapping tables without changing existing evidence.
- Five saved GitHub/Airtable sources per workspace, including disconnected configurations. A disabled source can be reconnected with the same mapping and a replacement token; changing its customer mapping is not supported.
- Twenty source records per batch; 2 MB maximum provider response; ten sync requests per minute per workspace; 500 evidence documents per workspace. Long content is explicitly truncated with a notice and a count in the result.
- Sync does not call Nebius. New and changed documents require processing; unchanged documents keep their current embeddings and signals. Existing account revenue/owner/renewal fields are not overwritten.
- Each batch and its cursor are atomic. Finish a scan before starting another. Source-side edits/deletions during pagination can shift records; repeating a full scan picks up remaining changes, while stable IDs prevent duplicates within a connection.
- Disconnect removes the stored token and stops later syncs, preserving evidence. It also invalidates an in-flight sync before its database commit. Disconnecting is not a remote token revocation; revoke the token in GitHub/Airtable too when appropriate.
- Remote deletions are not mirrored. Deleting local evidence allows later reimport if the source remains connected. Previous AI chat answers are not rewritten when source text changes.
- Private tokens never appear in status responses. Tokens are encrypted with the configured encryption key and a connection-specific scope. Back up the encryption key securely; replacing it requires reconnecting credentials.
- Both new source endpoints require Auth0 sessions; mutations require same-origin requests and owner permissions. Tally's public webhook remains separately protected by its signature.

## Live acceptance

Automated tests use isolated databases and deterministic API responses. Before real users, verify a completed Auth0 session, one public repository, one restricted private repository/token, one Airtable table, a Tally delivery, and Nebius processing with the actual intended accounts. Do not publish customer information or make an Airtable base public to avoid token setup.

For a public SaaS release, GitHub App installations and Airtable OAuth would offer better onboarding and credential lifecycle management than manually pasted tokens. They are not part of this prototype.
