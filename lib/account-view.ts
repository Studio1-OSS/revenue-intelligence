import type { Account } from "./types";

export function visibleAccounts(
  accounts: Account[],
  query: string,
  scope: string,
  sort: string,
) {
  return accounts
    .filter((a) => {
      const matchesQuery = `${a.name} ${a.domain} ${a.owner}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      return (
        matchesQuery &&
        (scope === "attention"
          ? a.health < 75
          : scope === "healthy"
            ? a.health >= 75
            : true)
      );
    })
    .sort((a, b) => {
      if (sort === "revenue")
        return b.arr - a.arr || a.name.localeCompare(b.name);
      if (sort === "renewal")
        return (
          (a.renewal || "9999").localeCompare(b.renewal || "9999") ||
          a.name.localeCompare(b.name)
        );
      return (
        a.health - b.health || b.arr - a.arr || a.name.localeCompare(b.name)
      );
    });
}
