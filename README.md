# Sofik Code

A focused, local Code OSS workbench for Sofik. This is an independent product based on the fixed **Code OSS 1.138.0** snapshot, not a rolling upstream fork. Its exact source revision is in [sofik/upstream.json](sofik/upstream.json).

## Product

- Code OSS editing, explorer, search, Git/diffs, diagnostics, navigation and autocomplete.
- Native terminal backed by `node-pty` and xterm.
- Bundled TypeScript/JavaScript, JSON, HTML, CSS and other upstream language components; configurable external language servers over stdio/LSP.
- Agent Client Protocol over stdio: initialize, session creation, streaming response, explicit permission choices, cancellation and workspace file callbacks.
- GitHub Dark and GitHub Light, generated from the original MIT-licensed GitHub theme sources. Credits are in `extensions/theme-github/NOTICE.md`.
- Five preferences through **Preferences** (`Cmd+,` / `Ctrl+,`): theme, font size, indentation, word wrap and auto save.

No Marketplace, user extension loading, extension installation UI, editor accounts, settings sync, profile UI, Copilot extension, upstream chat surface, onboarding or full settings editor. VSIX installation and gallery installation are rejected. Built-in language components and the private Sofik runtime still use the internal extension host; this implementation machinery is not a user plugin system. Shared configuration/API services remain where required by the editor. Removed surfaces are excluded at the workbench entrypoints, rather than hidden with CSS.

The source snapshot retains internal compatibility services used by built-in languages and the upstream API. This is not a claim that every upstream class or transitive dependency has been eliminated. `src/vs/workbench/contrib/sofik/browser/sofik.services.ts` explicitly contains the remaining service registrations without their optional product surfaces.

## Local build

Use Node 24 (the upstream pin is in `.nvmrc`), npm and the platform's C++ build tools. On macOS this requires Xcode command line tools. The Sofik setup builds native modules for **Node**, not Electron.

```sh
npm run sofik:setup
npm run sofik:build
npm run sofik:test
npm run sofik:serve -- --folder /absolute/path/to/project
```

The server binds only to `127.0.0.1`. The launcher creates a local connection-token file with owner-only permissions, reports its path, and redacts token-bearing URLs from its output. The embedding host reads that file and opens the editor with the `tkn` query parameter; the server exchanges it for a session cookie. Optional launcher arguments: `--port`, `--data-dir`, `--token-file`. Never expose this process directly to a network.

The current executable target is the Node server plus browser workbench, intended for the existing CEF surface in Sofik. Integration into `espacial-app`, release packaging and native desktop installers are separate work; the app is not modified by this repository.

## Agents and language servers

Run **Sofik: Configure Agent and Languages** from the command palette. This opens one local, user-owned `runtime.json` file, separate from workspace settings:

```json
{
  "agent": { "command": "/absolute/path/to/acp-agent", "args": ["--acp"] },
  "languageServers": [
    { "id": "go", "command": "gopls", "args": [], "languages": ["go"] },
    { "id": "python", "command": "pyright-langserver", "args": ["--stdio"], "languages": ["python"] }
  ]
}
```

Executables must already exist. Sofik does not download agents or language servers. Command arguments are passed directly without a shell. Configuration is read only from the user's runtime file, not executable workspace configuration. Language servers start only in trusted workspaces. Use **Sofik: Restart Language Servers** after editing the file.

**Sofik: Ask Agent** (`Cmd+Alt+A` / `Ctrl+Alt+A`) starts an ACP session for the selected workspace and displays streaming output in **Sofik Agent**. **Cancel Agent** interrupts a turn; **Disconnect Agent** stops the process. Configure authentication using the selected agent's own supported login flow. No account system or provider credentials are bundled into this editor.

ACP file callbacks are constrained to the selected workspace, including symlink resolution. File writes require approval and use editor edits before saving. Permission requests are never automatically accepted. The process itself runs with the user's local OS permissions; workspace callback checks are not an OS sandbox. ACP client-managed terminal callbacks are not advertised; the editor terminal is independent. Sessions currently last for the editor lifetime.

## Validation

`npm run sofik:test` exercises a local ACP agent fixture, rejected permission propagation, cancellation, executable failure, initialization timeout, workspace path isolation, native PTY execution, real JSON LSP completion and server authentication. It uses only local test processes and temporary directories, with no hosted AI/provider calls.

For core TypeScript validation, after setup:

```sh
node build/npm/electronTypes.ts
node node_modules/@typescript/native/lib/tsc.js -p src/tsconfig.json --noEmit --skipLibCheck
```

See [sofik/VALIDATION.md](sofik/VALIDATION.md) for the observed verification and limits of this revision.

## Licensing

The original Code OSS [MIT license](LICENSE.txt), source copyright notices and [third-party notices](ThirdPartyNotices.txt) are preserved. GitHub themes retain their license. Bundled dependencies retain their own licenses (including the ACP SDK's Apache-2.0 license). Microsoft marketplace/product assets and services are not granted by the Code OSS license.
