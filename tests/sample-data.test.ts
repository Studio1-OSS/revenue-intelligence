import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { sample, SYNTHETIC_SOURCE_NOTICE } from "../lib/sample-data";
import { parseCSV } from "../lib/ingest";

test("sample companies use the new real-world identities with consistent evidence links", () => {
  expect(sample.accounts.map((a) => a.name)).toEqual([
    "Shopify",
    "Notion",
    "Canva",
    "Figma",
    "Atlassian",
    "Zoom",
  ]);
  for (const signal of sample.signals) {
    const account = sample.accounts.find((a) => a.id === signal.companyId)!;
    const source = sample.evidence.find((e) => e.id === signal.chunkId)!;
    expect(signal.company).toBe(account.name);
    expect(signal.domain).toBe(account.domain);
    expect(source.domain).toBe(account.domain);
    expect(source.body).toContain(signal.quote);
  }
  for (const account of sample.accounts)
    expect(account.evidenceCount).toBe(
      sample.evidence.filter((e) => e.domain === account.domain).length,
    );
});

test("synthetic labels survive importing sample documents", () => {
  for (const source of sample.evidence) {
    expect(source.title).toStartWith("Synthetic demo:");
    expect(source.body).toStartWith(SYNTHETIC_SOURCE_NOTICE);
    expect(source.source).toStartWith("Synthetic");
  }
});

test("downloadable CSV uses the same identities and preserves the disclaimer", async () => {
  const rows = parseCSV(
    await readFile(
      new URL("../public/evidence-template.csv", import.meta.url),
      "utf8",
    ),
  );
  expect(rows.length).toBe(2);
  for (const row of rows) {
    const account = sample.accounts.find((a) => a.domain === row.domain)!;
    expect(row.company).toBe(account.name);
    expect(row.arr).toBe(account.arr);
    expect(row.body).toStartWith(SYNTHETIC_SOURCE_NOTICE);
  }
});
