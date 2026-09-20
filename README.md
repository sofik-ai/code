# Sofik Code

A focused, local Code OSS workbench for Sofik. This is an independent product based on the fixed **Code OSS 1.138.0** snapshot, not a rolling upstream fork. Its exact source revision is in [sofik/upstream.json](sofik/upstream.json).

## Product

- Code OSS editing, explorer, search, Git/diffs, diagnostics, navigation and autocomplete.
- Native terminal backed by `node-pty` and xterm.
- Bundled TypeScript/JavaScript, JSON, HTML, CSS and other upstream language components; configurable external language servers over stdio/LSP.
- Agent Client Protocol connected to Sofik chat cards: shared conversation, streaming, cancellation and file/tool updates. Standalone stdio agents remain supported.
- GitHub Dark and GitHub Light, generated from the original MIT-licensed GitHub theme sources. Credits are in `extensions/theme-github/NOTICE.md`.
- GitHub themes follow the host color scheme; no separate configuration surface.

No restricted mode, notification center/toasts, internal window header, Help menu, Remote Window/Ports UI, debugging UI, configuration menus, Marketplace, user extension loading, extension installation UI, editor accounts, settings sync, profile UI, Copilot extension, upstream chat surface, onboarding or full settings editor. VSIX installation and gallery installation are rejected. Built-in language components and the private Sofik runtime still use the internal extension host; this implementation machinery is not a user plugin system. Shared configuration/API services remain where required by the editor. Removed surfaces are excluded at the workbench entrypoints, rather than hidden with CSS.

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

The executable target is the Node server plus browser workbench, embedded by the CEF surface in Sofik. The desktop integration lives in `espacial-app`. Release optimization, signing and native installers remain separate delivery work.

## Agents and language servers

Inside Sofik, **Ask Agent** connects automatically to the selected chat card, or the only chat in the Space. With multiple conversations, the editor asks which one to use. The daemon resolves the stored working directory, including worktrees. The host supplies an authenticated local bridge through a private sidecar; provider credentials stay in the daemon.

For standalone development, the private runtime still reads its user-level `runtime.json` (under the Sofik Runtime global storage directory); there is no settings or configuration command. The optional file supports:

```json
{
  "agent": { "command": "/absolute/path/to/acp-agent", "args": ["--acp"] },
  "languageServers": [
    { "id": "go", "command": "gopls", "args": [], "languages": ["go"] },
    { "id": "python", "command": "pyright-langserver", "args": ["--stdio"], "languages": ["python"] }
  ]
}
```

Executables must already exist. Sofik does not download agents or language servers. Command arguments are passed directly without a shell. Configuration is read only from the user's runtime file, not executable workspace configuration. Languages activate immediately; restricted mode and trust prompts are disabled at the service level. Use **Sofik: Restart Language Servers** after editing the file.

**Sofik: Ask Agent** (`Cmd+Alt+A` / `Ctrl+Alt+A`) uses the card conversation through ACP when hosted, and a stdio session when standalone, displaying streaming output in **Sofik Agent**. **Cancel Agent** interrupts a turn; **Disconnect Agent** stops the process. Configure authentication using the selected agent's own supported login flow. No account system or provider credentials are bundled into this editor.

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

## Embedded desktop host

`node scripts/sofik/bundle.mjs /absolute/new/output` assembles a self-contained, platform-specific payload with this build's Node binary, native dependencies and license notices. Build it on each target platform. The payload currently uses unminified source output; distribution-size optimization is still possible.

The desktop starts `bin/node scripts/sofik/host.mjs --data-dir <private-state> --token-file <private-token-file>` and keeps stdin open. Stdout emits JSON `{ "event": "ready", "port": ... }`; the host loads `http://127.0.0.1:<port>/?tkn=<token>&workspace=<absolute-workspace-file>`. Do not log the authenticated URL. EOF or a termination signal shuts down the owned process tree. The launcher remembers its loopback port for storage continuity and falls back to a fresh port if occupied. The desktop repository pins an exact commit in `tool/code/runtime.lock.json`.
