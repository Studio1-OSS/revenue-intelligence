const privateRoots = [
  "dashboard",
  "accounts",
  "signals",
  "competitors",
  "settings",
  "evidence",
];

export function isWorkspacePath(path: string) {
  return privateRoots.some(
    (root) => path === `/${root}` || path.startsWith(`/${root}/`),
  );
}

export function workspacePath(demo: boolean, path: string) {
  if (!demo || !isWorkspacePath(path)) return path;
  return path === "/dashboard" ? "/demo" : `/demo${path}`;
}
