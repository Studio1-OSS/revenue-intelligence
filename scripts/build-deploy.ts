import { environmentProblems, productionDeployment } from "../lib/environment";

if (productionDeployment()) {
  const problems = environmentProblems(process.env);
  if (problems.length) {
    console.error("Production deployment refused:\n" + problems.join("\n"));
    process.exit(1);
  }
}
const build = Bun.spawn(["bun", "run", "build"], {
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await build.exited);
