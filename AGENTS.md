# Cloudflare Workers Development Guide

This guide contains important information for agents working with this Cloudflare Workers repository.

## Project Overview

This repository contains Cloudflare Workers scripts for various purposes. Each worker lives in
its own directory with a `worker.js` and a per-worker `wrangler.jsonc`:
- workers/container-proxy/worker.js: Container registry proxy for Docker, GCR, etc.
- workers/reverse-proxy/worker.js: General reverse proxy

## Development Commands

This is a pure JavaScript project with no build system. Each worker is a standalone script.
Biome (pinned in devDependencies) enforces the formatting rules below; run `pnpm install` first.

### Lint & Format

```bash
pnpm run lint       # Biome check (formatter + linter), same gate as CI
pnpm run lint:fix   # apply safe fixes and formatting
```

### Type Check

```bash
pnpm run typecheck  # tsc --noEmit over workers/ (same gate as CI)
```
Worker files are plain JavaScript; JSDoc annotations plus `tsconfig.json` (checkJs, strict,
`@cloudflare/workers-types`) give editors and CI real runtime types without a build step.

### Compatibility Date

```bash
pnpm run bump-compat  # set compatibility_date in workers/*/wrangler.jsonc to the latest wrangler release date
```
The safe maximum is the release date of the latest wrangler on npm (a date must not exceed
the wrangler used to deploy; Cloudflare Builds deploys with the latest wrangler). Run it
periodically, review `git diff`, then commit. Plain Node script, same command in any shell.

### Testing

Since there are no automated tests defined, manual testing involves:
1. Deploying to a Cloudflare Workers account
2. Testing endpoints directly or through a browser

### Deployment

Each worker directory has its own `wrangler.jsonc` (adjust `name` to the worker name on your
account). Deploy from the repo root or from inside the worker directory:
```bash
wrangler deploy --config workers/container-proxy/wrangler.jsonc
wrangler deploy --config workers/reverse-proxy/wrangler.jsonc
```

## Code Style Guidelines

### General Formatting

Enforced by Biome (see `biome.json`); the config matches these rules:
- Use 4 spaces for indentation (not tabs)
- Keep lines under 120 characters when possible
- No trailing whitespace
- End files with a newline

### Import/Export Patterns

- No ES6 modules - use vanilla JavaScript
- All functions are defined in the global scope
- No runtime dependencies - Cloudflare Workers provides built-in APIs; devDependencies
  are tooling only (Biome, TypeScript, @cloudflare/workers-types)
- Workers secrets go in bindings (e.g. `env.GITHUB_TOKEN` via `wrangler secret put`),
  never in source

### Naming Conventions

- Functions: camelCase (e.g., `handleRequest`, `fetchHandler`)
- Variables: camelCase (e.g., `urlObj`, `targetUrl`)
- Constants: UPPER_SNAKE_CASE for immutable values (e.g., `domainMapping`)
- File names: lowercase with no spaces (e.g., `container.js`, `ddns.js`)

### Function Structure

- All main handlers are async functions
- Keep functions focused on a single responsibility
- Use descriptive function names that explain their purpose
- Add version comments at the top of each file

### Error Handling

- Use try-catch blocks for all async operations
- Return meaningful error responses with appropriate HTTP status codes
- Include error messages in JSON responses for debugging
- Log errors using console.error when appropriate
- Example error response:
```javascript
return new Response(JSON.stringify({ error: error.message }), {
  status: 500,
  headers: { 'Content-Type': 'application/json; charset=utf-8' }
})
```

### Response Patterns

- Always set appropriate Content-Type headers
- Include CORS headers for cross-origin requests:
```javascript
'Access-Control-Allow-Headers': '*',
'Access-Control-Allow-Methods': '*',
'Access-Control-Allow-Origin': '*'
```

- Use consistent response structure for JSON responses
- Return appropriate HTTP status codes (400, 401, 404, 500, etc.)

### URL and Request Handling

- Always parse URLs using the URL constructor
- Extract query parameters using URL.searchParams
- Handle request headers appropriately, filtering Cloudflare-specific headers when proxying
- Preserve request method and body when forwarding requests

### Comments and Documentation

- Add version and description comment at the top of each file
- Keep comments concise and focused on explaining "why" not "what"
- No inline comments for self-evident code

### Performance Considerations

- Minimize memory usage in edge environments
- Use appropriate caching headers (typically `Cache-Control: no-store` for dynamic content)
- Avoid unnecessary operations in the request path

### Security Best Practices

- Never expose sensitive information in responses
- Validate and sanitize all inputs
- Use appropriate authentication mechanisms
- Filter headers when proxying requests to avoid exposing Cloudflare metadata

### Code Organization

- Main entry point: addEventListener for 'fetch' events
- Helper functions placed after main handler
- Constants defined at the top of functions
- Group related functionality together

When making changes:
1. Follow the existing patterns in each file
2. Test manually by deploying to a staging environment
3. Ensure backward compatibility when modifying existing functionality
4. Update version comments when making significant changes
