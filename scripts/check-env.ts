import { environmentProblems } from "../lib/environment";
const problems = environmentProblems(
  process.env,
  !process.argv.includes("--local"),
);
if (!process.env.AUTH0_AUDIENCE)
  console.log(
    "MCP requires AUTH0_AUDIENCE; browser login is independent of MCP.",
  );
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else console.log("Environment validation passed. No secret values printed.");
