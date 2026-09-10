import "server-only";
import { z } from "zod";
import { AppError } from "../errors";
import { documentInput, type DocumentInput } from "../ingest";

export const sourceConfig = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("github"),
    repository: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9](?:[a-z0-9-]{0,38})\/[a-z0-9_][a-z0-9_.-]{0,99}$/,
        "Use owner/repository, not a URL.",
      ),
    company: documentInput.shape.company,
    domain: documentInput.shape.domain,
    label: z.string().trim().max(100).default(""),
  }),
  z.object({
    provider: z.literal("airtable"),
    baseId: z
      .string()
      .trim()
      .regex(/^app[a-zA-Z0-9]{14}$/, "Enter an Airtable base ID."),
    tableId: z
      .string()
      .trim()
      .regex(/^tbl[a-zA-Z0-9]{14}$/, "Enter an Airtable table ID."),
  }),
]);
export const sourceSetup = z.object({
  config: sourceConfig,
  token: z
    .string()
    .trim()
    .max(1000)
    .regex(/^[\x21-\x7E]*$/)
    .default(""),
});
export type SourceConfig = z.infer<typeof sourceConfig>;
export type ExternalItem = { id: string; url: string; document: DocumentInput };
export type ExternalPage = {
  items: ExternalItem[];
  nextCursor: string | null;
  skipped: number;
  truncated: number;
};

export function resourceKey(config: SourceConfig) {
  return config.provider === "github"
    ? `${config.repository}:${config.label}`
    : `${config.baseId}/${config.tableId}`;
}

async function providerJSON(url: URL, token: string, transport: typeof fetch) {
  try {
    const response = await transport(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Revenue-Intelligence",
        ...(url.hostname === "api.github.com"
          ? { "X-GitHub-Api-Version": "2026-03-10" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (
        response.status === 429 ||
        (response.status === 403 &&
          response.headers.get("x-ratelimit-remaining") === "0")
      )
        throw new AppError(
          "SOURCE_RATE_LIMITED",
          "The source API limit was reached. Wait before syncing again.",
          429,
        );
      if ([401, 403, 404].includes(response.status))
        throw new AppError(
          "SOURCE_ACCESS_DENIED",
          "Check the source IDs, token permissions, expiry, and organization approval.",
          400,
        );
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "The source could not be read. Try again later.",
        502,
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty response");
    let size = 0;
    const parts: Uint8Array[] = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new AppError(
          "SOURCE_TOO_LARGE",
          "This source page exceeds the 2 MB prototype limit.",
          413,
        );
      }
      parts.push(part.value);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "SOURCE_UNAVAILABLE",
      "The source response could not be read. Check access and retry.",
      502,
    );
  }
}

function boundedBody(body: string) {
  return body.length > 19_000
    ? {
        body:
          body.slice(0, 19_000) +
          "\n[Prototype import truncated. Open the original source for the full text.]",
        truncated: 1,
      }
    : { body, truncated: 0 };
}

export async function fetchSourcePage(
  config: SourceConfig,
  token: string,
  cursor: string | null,
  transport: typeof fetch = fetch,
): Promise<ExternalPage> {
  let truncated = 0;
  if (config.provider === "github") {
    const page = cursor ? Number(cursor) : 1;
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw new AppError("INVALID_CURSOR", "Restart this connection's sync.");
    const url = new URL(
      `https://api.github.com/repos/${config.repository}/issues`,
    );
    url.search = new URLSearchParams({
      state: "all",
      sort: "created",
      direction: "asc",
      per_page: "20",
      page: String(page),
      ...(config.label ? { labels: config.label } : {}),
    }).toString();
    const raw = z
      .array(
        z.object({
          number: z.number().int().positive(),
          title: z.string().max(10000),
          body: z.string().nullable(),
          state: z.enum(["open", "closed"]),
          pull_request: z.unknown().optional(),
        }),
      )
      .max(20)
      .parse(await providerJSON(url, token, transport));
    const items = raw
      .filter((issue) => issue.pull_request === undefined)
      .map((issue) => {
        const source = `https://github.com/${config.repository}/issues/${issue.number}`;
        const content = boundedBody(
          `GitHub issue #${issue.number}: ${issue.title}\nState: ${issue.state}\nSource: ${source}\n\n${issue.body || "No issue description provided."}`,
        );
        truncated += content.truncated;
        return {
          id: String(issue.number),
          url: source,
          document: documentInput.parse({
            company: config.company,
            domain: config.domain,
            title: `#${issue.number} ${issue.title}`.slice(0, 200),
            body: content.body,
          }),
        };
      });
    return {
      items,
      nextCursor: raw.length === 20 ? String(page + 1) : null,
      skipped: raw.length - items.length,
      truncated,
    };
  }
  if (!token)
    throw new AppError(
      "SOURCE_TOKEN_REQUIRED",
      "Airtable requires a read-only personal access token.",
    );
  const url = new URL(
    `https://api.airtable.com/v0/${config.baseId}/${config.tableId}`,
  );
  url.searchParams.set("pageSize", "20");
  if (cursor) url.searchParams.set("offset", cursor);
  const raw = z
    .object({
      records: z
        .array(
          z.object({
            id: z.string().regex(/^rec[a-zA-Z0-9]{14}$/),
            fields: z.record(z.string(), z.unknown()),
          }),
        )
        .max(20),
      offset: z.string().min(1).max(1000).optional(),
    })
    .parse(await providerJSON(url, token, transport));
  const items = raw.records.map((record) => {
    const text = z.string().trim().min(20).parse(record.fields.Feedback);
    const content = boundedBody(text);
    truncated += content.truncated;
    const result = documentInput.safeParse({
      company: record.fields.Company,
      domain: record.fields["Company domain"],
      title: record.fields.Title || "Customer feedback via Airtable",
      body: content.body,
    });
    if (!result.success)
      throw new AppError(
        "SOURCE_INVALID_RECORD",
        `Airtable record ${record.id} needs valid Company, Company domain, Feedback, and optional Title fields. No records in this batch were saved.`,
      );
    return {
      id: record.id,
      url: `https://airtable.com/${config.baseId}/${config.tableId}/${record.id}`,
      document: result.data,
    };
  });
  return { items, nextCursor: raw.offset || null, skipped: 0, truncated };
}
