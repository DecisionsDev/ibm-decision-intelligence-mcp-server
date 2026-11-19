/*
 * Copyright contributors to the IBM ADS/Decision Intelligence MCP Server project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// scripts/check-release.js
// Run via the "prepack" npm script (or "npm run release:check") to block releases from the wrong state.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();

const fail = (message) => {
  console.error(`\nRelease check failed: ${message}\n`);
  process.exit(1);
};

// 1. Must be on main
const branch = run("git rev-parse --abbrev-ref HEAD");
if (branch !== "main") {
  fail(`refusing to publish from "${branch}". Switch to main.`);
}

// 2. Working tree must be clean (no uncommitted or untracked changes)
if (run("git status --porcelain") !== "") {
  fail("working tree is not clean. Commit or stash your changes.");
}

// 3. Local main must match origin/main
try {
  run("git fetch origin main");
} catch {
  fail("could not fetch origin/main. Check your network and remote.");
}

const [ahead, behind] = run("git rev-list --left-right --count HEAD...origin/main")
  .split(/\s+/)
  .map(Number);

if (ahead > 0 && behind > 0) {
  fail(`local main has diverged from origin/main (${ahead} ahead, ${behind} behind).`);
}
if (behind > 0) {
  fail(`local main is ${behind} commit(s) behind origin/main. Run "git pull".`);
}
if (ahead > 0) {
  fail(`local main is ${ahead} commit(s) ahead of origin/main. Push or discard them first.`);
}

console.log("Release check passed: on main, clean, and in sync with origin/main.");
