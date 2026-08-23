# Publishing to npm

Packages publish under the `@evolving2code` scope:

| Package | npm name | CLI binary |
|---|---|---|
| Core library | `@evolving2code/agent-trace-core` | — |
| CLI + replay studio | `@evolving2code/agent-trace` | `agent-trace` |

> **Note:** The unscoped name `agent-trace` is already taken on npm by another project. Use `@evolving2code/agent-trace` for installs.

## Quick start (after publish)

```bash
npx @evolving2code/agent-trace demo
npx @evolving2code/agent-trace play
```

## Prerequisites

1. npm account with access to the `@evolving2code` scope
2. Logged in locally: `npm login`
3. Built native dependency support for `better-sqlite3` on publish machines (handled automatically for end users via npm install scripts)

## Prepare a release

```bash
pnpm install
pnpm prepare:publish   # builds all packages + bundles viewer into CLI
pnpm pack:check        # creates tarballs in /tmp for inspection
```

Inspect the CLI tarball includes `dist/`, `viewer-dist/`, and resolves `@evolving2code/agent-trace-core`.

## Publish

Publish **core first**, then CLI:

```bash
pnpm publish:packages
```

Or manually:

```bash
pnpm --filter @evolving2code/agent-trace-core publish --access public
pnpm --filter @evolving2code/agent-trace publish --access public
```

## Version bumps

1. Update `version` in `packages/core/package.json` and `packages/cli/package.json`
2. Run `pnpm install` to refresh the lockfile
3. Commit, tag (`v0.1.1`), and publish

## CI publishing (optional)

Set `NPM_TOKEN` in GitHub Actions with publish access to `@evolving2code`, then run `pnpm publish:packages` on tagged releases.
