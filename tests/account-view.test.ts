import { expect, test } from "bun:test";
import { visibleAccounts } from "../lib/account-view";
import { sample } from "../lib/sample-data";

test("account toolbar composes text and health filters without mutating data", () => {
  const original = sample.accounts.map((a) => a.id);
  const attention = visibleAccounts(sample.accounts, "", "attention", "health");
  expect(attention.every((a) => a.health < 75)).toBe(true);
  expect(
    visibleAccounts(sample.accounts, "SHOPIFY", "all", "health").map(
      (a) => a.domain,
    ),
  ).toEqual(["shopify.com"]);
  expect(
    visibleAccounts(sample.accounts, "unmatched-account", "all", "health"),
  ).toEqual([]);
  const healthy = visibleAccounts(sample.accounts, "", "healthy", "revenue");
  expect(healthy.every((a) => a.health >= 75)).toBe(true);
  expect(healthy.map((a) => a.arr)).toEqual(
    healthy.map((a) => a.arr).sort((a, b) => b - a),
  );
  expect(sample.accounts.map((a) => a.id)).toEqual(original);
});

test("renewal sorting keeps accounts without dates at the end", () => {
  const accounts = [
    { ...sample.accounts[0], id: "none", renewal: "" },
    { ...sample.accounts[0], id: "later", renewal: "2027-01-01" },
    { ...sample.accounts[0], id: "soon", renewal: "2026-10-01" },
  ];
  expect(
    visibleAccounts(accounts, "", "all", "renewal").map((a) => a.id),
  ).toEqual(["soon", "later", "none"]);
});
