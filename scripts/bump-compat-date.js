// v1.0.0 - Bump compatibility_date in every workers/*/wrangler.jsonc to the
// release date of the latest wrangler version published on npm.
//
// Why the latest wrangler release date is the safe maximum: a compatibility
// date must not exceed the release date of the wrangler used to deploy, and
// Cloudflare Builds deploys with the latest wrangler.
//
// Plain Node.js with no dependencies; runs the same way from zsh, bash or
// PowerShell via `pnpm run bump-compat`.

const { execFileSync } = require("node:child_process");
const { readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

// Windows resolves `npm` to npm.cmd; execFileSync does not do PATH extension
// resolution for .cmd, so pick the shim explicitly.
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const PACKAGE = "wrangler";

function latestWranglerRelease() {
    const version = execFileSync(npm, ["view", PACKAGE, "version"], { encoding: "utf8" }).trim();
    const time = JSON.parse(execFileSync(npm, ["view", PACKAGE, "time", "--json"], { encoding: "utf8" }));
    const iso = time[version];
    if (!iso) {
        throw new Error(`npm registry returned no release date for ${PACKAGE}@${version}`);
    }
    return { version, date: iso.slice(0, 10) };
}

function bumpFile(file, date) {
    let content;
    try {
        content = readFileSync(file, "utf8");
    } catch {
        return; // worker without a wrangler.jsonc is fine to skip
    }
    const current = content.match(/"compatibility_date"\s*:\s*"([^"]*)"/);
    if (!current) {
        console.warn(`WARN ${file}: no compatibility_date found, skipped`);
        return;
    }
    if (current[1] === date) {
        console.log(`ok   ${file}: already ${date}`);
        return;
    }
    writeFileSync(file, content.replace(/"compatibility_date"\s*:\s*"[^"]*"/, `"compatibility_date": "${date}"`));
    console.log(`bump ${file}: ${current[1]} -> ${date}`);
}

function main() {
    const { version, date } = latestWranglerRelease();
    console.log(`latest ${PACKAGE}@${version} released ${date}`);
    const workersDir = join(__dirname, "..", "workers");
    for (const entry of readdirSync(workersDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            bumpFile(join(workersDir, entry.name, "wrangler.jsonc"), date);
        }
    }
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
