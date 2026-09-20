# Sofik Code

This is an independent, fixed Code OSS 1.138.0 source base. Do not sync or rebase from upstream. Preserve the source provenance in `sofik/upstream.json`, upstream license headers, LICENSE.txt and ThirdPartyNotices.txt.

## Product boundaries

Keep editing, explorer/search/Git, terminal, language intelligence, ACP and the two GitHub themes. No user extension installation, Marketplace, accounts, sync, Copilot UI or full settings editor. Internal language modules and API compatibility services are implementation details, not public extensibility. Do not remove an internal service without validating its actual dependents in the browser.

## Working locally

- Setup: `npm run sofik:setup` (installs dependencies without lifecycle scripts, then explicitly builds the native Node modules).
- Build: `npm run sofik:build`.
- Tests: `npm run sofik:test` after building. These use only local fixtures and temporary workspaces.
- Core types: `node build/npm/electronTypes.ts`, then `node node_modules/@typescript/native/lib/tsc.js -p src/tsconfig.json --noEmit --skipLibCheck`.
- Serve: `npm run sofik:serve -- --folder /absolute/project/path`; loopback and connection-token authentication are mandatory for the normal launcher.

Preserve unrelated changes. Keep tests isolated from real agents/providers and user workspaces. Do not install agents, run real provider requests, publish releases or expose the server remotely without authorization. Inspect scripts before running them. Validate visual changes and editor/terminal interactions in a real browser. Keep evidence and limitations accurate in `sofik/VALIDATION.md`.

Use tabs in core TypeScript. Localize user-facing strings. Dispose services, listeners and child processes. Do not persist secrets in the repository.
