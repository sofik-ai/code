# Validation — 2026-09-19 (America/Sao_Paulo)

Base: Code OSS 1.138.0, upstream commit `7debcd0e2acdea1c52de81bf9ee1620444407dda`.
Environment: macOS arm64, Node 24.16.0. The inherited `.nvmrc` recommends 24.18.0.

## Passed

- Full main-source TypeScript check (`@typescript/native`, `src/tsconfig.json`, no emit).
- Sofik build: main source transpilation, retained built-in language bundles and Sofik runtime bundle.
- Eight automated tests: ACP handshake/streaming/permission rejection; cancellation and overlapping prompt rejection; failed executable and initialization timeout; workspace traversal/symlink rejection (including dangling links); runtime configuration validation; native PTY output/exit; real JSON LSP schema completion; HTTP server authentication.
- Browser workbench opened a local disposable project with the Sofik identity and no Accounts or Extensions activity entries.
- TypeScript member suggestions included `at`, `charAt`, `includes`, `length`, etc. A completed `message.toLowerCase();` edit was saved and restored after reload.
- Compact preferences showed exactly five options. GitHub Dark and GitHub Light rendered, and the chosen light theme survived reload.
- Integrated zsh terminal executed a test printf command and displayed `SOFIK_TERMINAL_OK`.
- Sofik's configurable LSP client started an external stdio fixture and offered `sofikExternalCompletion` in a plain-text file.
- Through the actual editor commands, an ACP fixture requested permission; selecting **Reject Once** produced `deny` and `[end_turn]` in the Sofik Agent output. No external AI provider was called.
- Diff whitespace checks passed.

## Limits

- `espacial-app`/CEF integration and packaged macOS/Windows/Linux distributions are not part of this repository change. Browser validation uses the local Node development server.
- External LSP/ACP production executables and their authentication are user supplied; fixture tests do not establish compatibility with every agent or language server.
- The upstream internal extension host, configuration service and some compatibility services remain necessary for the retained language components. Their optional product screens are excluded; this is not a complete removal of every upstream type or dependency.
- Development reloads can log canceled file watches, closed IndexedDB writes and upstream lifecycle warnings. A missing JSON schema provider found during validation was fixed by registering schema documents independently from the removed settings UI.
- The retained accessibility/high-contrast fallback theme assets are still bundled; Sofik's compact preferences offer only GitHub Dark and GitHub Light.

## Desktop integration follow-up

The Sofik Flutter app now embeds this workbench through its CEF surface and a bundled Node runtime. Its isolated full-app fixture verified native typing/save, TypeScript autocomplete, terminal execution, GitHub theme selection, ACP permission rejection and streaming, external LSP suggestions, multi-root folders, Canvas/Code retention and separate Space sessions. No real provider was called. App-side tests exercise authenticated process ownership, stable port/token rotation, occupied-port recovery, disposal during startup and native overlay masks.

This uncovered a missing workspace-trust transition participant after the Extensions UI removal; it is now registered independently so built-in language modules and ACP activate immediately after trust. A multi-root startup race was also fixed: a configuration notification received before workspace creation no longer dereferences an uninitialized workspace.
