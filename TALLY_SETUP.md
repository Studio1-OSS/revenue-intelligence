# Tally Feedback Integration

Tally is the first live prototype connector. Its [webhook integration](https://tally.so/help/webhooks) is available on the free plan. There is no Tally API token or platform AI key to configure.

## Connect a form

1. Create and publish a Tally form with these required questions. Labels are matched case-insensitively after trimming whitespace; do not duplicate them.

   | Question label | Field type   | Requirement                                         |
   | -------------- | ------------ | --------------------------------------------------- |
   | Company        | Short answer | 1-120 characters                                    |
   | Company domain | Short answer | Domain only, e.g. `shopify.com`, not a URL or email |
   | Feedback       | Long answer  | 20-20,000 characters                                |
   | Title          | Short answer | Optional, maximum 200 characters                    |

2. Sign in to Revenue-Intelligence. Open **Evidence Library**, find Tally, and enter the ID from your published link (`https://tally.so/r/<FORM_ID>`).
3. Select **Set up connection**. Copy the generated endpoint and signing secret. The secret is shown only in this response; reloading loses the visible copy. Disconnect and reconnect if you need a replacement.
4. In Tally, open the published form's **Integrations > Webhooks > Connect**. Paste the endpoint and signing secret. Do not leave the signing secret blank. Save the webhook.
5. Submit a new form response. Refresh the connection in Revenue-Intelligence. A successful import shows **Receiving submissions**, increments the imported count, and adds a pending source document. Merely saving configuration does not verify delivery.
6. Add your Nebius key in AI settings. Select **Process evidence** in the library, then review the account's signals and ask a question with cited evidence. This makes billable calls against your Nebius account.

Only submit customer information you are authorized to process. A public form does not authenticate the respondent or prove the feedback is true. Other fields, email answers, attachments, and Tally preview/PDF URLs are ignored.

## Localhost and deployment

The app currently runs at `http://127.0.0.1:3000`. Tally's servers cannot reach this address. Local setup, code tests, and a demo preview work, but a real external delivery requires a reachable HTTPS endpoint.

For the simplest stable setup, deploy to Vercel using [DEPLOYMENT.md](DEPLOYMENT.md), set `NEXT_PUBLIC_APP_URL` to that deployment's HTTPS origin, and update Auth0 callbacks. Copy the endpoint from the deployed app. Keep the same encryption secret when moving an existing database, or reconnect its AI keys and Tally form.

A temporary tunnel is an alternative only after approving public exposure. Prefer a tunnel restricted to `/api/webhooks/tally/<CONNECTION_ID>`; do not expose unrelated local services or disable authentication. Use the tunnel's HTTPS origin with that exact path in Tally. A new tunnel URL must also be updated in Tally. Creating a tunnel is not part of the automated setup.

## Delivery behavior

- HMAC-SHA256 is checked with constant-time comparison against `Tally-Signature`, following Tally's documented base64 digest of `JSON.stringify(payload)`. The secret never appears in a webhook URL.
- Only `FORM_RESPONSE` events for the configured form are accepted. Untrusted headers and payload workspace IDs cannot choose the destination workspace.
- HTTP 202 means evidence was persisted and queued, not that AI processing completed. HTTP 200 with `duplicate: true` means the submission was already imported.
- Tally expects 2XX within 10 seconds. The handler performs bounded database work only, no model calls or URL fetching. Cold-start/database latency still needs to be measured on the deployed host.
- Tally retries failed deliveries after 5 minutes, 30 minutes, 1 hour, 6 hours, and 1 day. Receipts use the connection, form, and submission ID so retries are idempotent even when event IDs change. Receipt insertion rolls back if evidence import fails.
- Maximum request body: 100 KB; up to 100 fields; 60 authenticated deliveries/minute/connection; existing 500-document workspace cap. Excess limits reject the delivery, not silently truncate it.
- Disconnecting removes the stored secret and blocks further deliveries. Imported evidence is retained; its normal deletion controls still apply. Receipts remain to prevent old submissions from being imported again after reconnecting the same form.

## Troubleshooting

Inspect Tally's webhook event log and delivery response. Error bodies contain sanitized codes, never secrets or source bodies.

| Response                               | Check                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 401 `INVALID_SIGNATURE`                | Signing secret must match the current connection exactly. Reconnecting rotates it.             |
| 403 `WRONG_FORM`                       | Form ID must match the published form sending the event.                                       |
| 400 `INVALID_INPUT` / `INVALID_FIELDS` | Required question labels, text field values, domain format, feedback length, duplicate labels. |
| 404 `NOT_FOUND`                        | Connection ID is unknown or disabled.                                                          |
| 409 `WORKSPACE_LIMIT`                  | Delete older evidence before retrying.                                                         |
| 409 `CONNECTION_CHANGED`               | A disconnect/reconnect happened during delivery. Retry against current settings.               |
| 413 `TOO_LARGE`                        | Remove unnecessary questions/attachments from this prototype form.                             |
| 429 `RATE_LIMITED`                     | Wait for the next rate-limit window; Tally retries failed deliveries.                          |
| 5XX                                    | Check deployment configuration, migration 004, database availability, and encryption key.      |

## Verification scope

Automated tests use isolated local libSQL databases, signed Tally-format fixtures, and a mocked Nebius transport. They cover signature rejection, tenant scope, encrypted secrets, retry deduplication, rollback, disconnect/reconnect, HTTP authorization, payload limits, and feedback-to-cited-answer processing.

A live Tally submission, actual Auth0 callback, and billable Nebius processing must still be verified with the user's accounts. Do not present fixture tests as live service verification.
