// Interactive setup: prompts for each env var in apps/api/.env.example and
// writes apps/api/.env. Re-running it shows current values as defaults
// (masked for secrets) — press enter to keep, type a new value to overwrite.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const exampleFile = join(repoRoot, "apps/api/.env.example");
const envFile = join(repoRoot, "apps/api/.env");

const SECRET_KEYS = new Set(["ANTHROPIC_API_KEY", "TAVILY_API_KEY"]);

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

function maskSecret(v) {
  if (!v) return "";
  if (v.length <= 8) return "*".repeat(v.length);
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

async function main() {
  const exampleText = await readFile(exampleFile, "utf8");
  const existing = existsSync(envFile)
    ? parseEnv(await readFile(envFile, "utf8"))
    : new Map();

  // Use the line iterator instead of rl.question() — readline/promises has a
  // known issue where piped stdin only delivers the first answer. The async
  // iterator handles both interactive TTY and piped input correctly.
  const rl = readline.createInterface({ input, output, terminal: input.isTTY });
  const iter = rl[Symbol.asyncIterator]();

  async function ask(prompt) {
    output.write(prompt);
    const { value, done } = await iter.next();
    if (done) throw new Error("stdin closed before all prompts answered");
    return value;
  }

  console.log("Crux setup — fill in your API keys.");
  console.log("Press enter to keep the value in [brackets]. Secrets are shown masked.\n");

  const outLines = [];
  for (const line of exampleText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) {
      // Comment, blank line, or anything that isn't KEY=VALUE — pass through.
      outLines.push(line);
      continue;
    }
    const key = m[1];
    const exampleValue = m[2];
    const currentValue = existing.has(key) ? existing.get(key) : exampleValue;
    const isSecret = SECRET_KEYS.has(key);

    const display =
      currentValue === ""
        ? "[empty]"
        : isSecret
          ? `[${maskSecret(currentValue)}]`
          : `[${currentValue}]`;

    const answer = (await ask(`  ${key} ${display}: `)).trim();
    const finalValue = answer === "" ? currentValue : answer;
    outLines.push(`${key}=${finalValue}`);
  }

  rl.close();

  await writeFile(envFile, outLines.join("\n"));
  console.log(`\nWrote ${envFile}`);

  // Surface anything still empty so the user knows what's missing.
  const written = parseEnv(outLines.join("\n"));
  const missing = [];
  for (const key of SECRET_KEYS) {
    if (!written.get(key)) missing.push(key);
  }
  if (missing.length > 0) {
    console.log(`\nWarning: still empty — ${missing.join(", ")}`);
    console.log("Re-run npm run setup when you have them.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
