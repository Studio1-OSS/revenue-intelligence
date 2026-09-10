import { environmentProblems, productionDeployment, publicPreviewOnly } from "../lib/environment";

if (productionDeployment() && publicPreviewOnly(process.env)) {
  console.info("Building public preview: landing page and read-only demo. Workspace services remain unavailable.");
} else if (productionDeployment()) {
  const problems = environmentProblems(process.env);
  if (problems.length) {
    console.error("Production deployment refused:\n" + problems.join("\n"));
    process.exit(1);
  }
}
const build = Bun.spawn([process.execPath, "run", "build"], {
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await build.exited);
