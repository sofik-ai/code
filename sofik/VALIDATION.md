# Validation — 2026-09-20 (America/Sao_Paulo)

Base: Code OSS 1.138.0, upstream `7debcd0e2acdea1c52de81bf9ee1620444407dda`.
Environment: macOS arm64, Node 24.16.0.

## Simplified workbench

- Main TypeScript check and complete Sofik build passed.
- Removed the restricted-mode enablement, trust UI, notification center/toasts/status icon, web titlebar, Help/Preferences menus, global account/configuration activity, remote-window/ports UI and debugger UI. Removed palette configuration buttons and the optional upstream AI command search.
- A fresh disposable workspace opened without any trust prompt. Its TypeScript service offered string member completions; editing, save and the integrated zsh terminal worked. The terminal printed `SOFIK_CLEAN_TERMINAL_OK`.
- The editor had no compact application-menu control, header, remote-window indicator or notification bell. Native Sofik CEF rendered the same reduced layout.
- Compatibility notifications are logged and dismissed asynchronously, so extension requests settle without invisible pending prompts. Tests cover dismissal, no action execution and no retained notification queue. Legacy stored trust settings cannot restore restricted mode.

## Chat and Code integration

The desktop cards and the private editor module now share ACP sessions owned by the Sofik daemon. A session is the existing conversation, not a new agent instance. The editor resolves the stored project/worktree through authenticated session context. With a selected/only card it connects without a prompt; multiple unselected chats require an explicit conversation choice. The editor preserves its original first root and appends missing worktrees, comparing canonical paths to avoid symlink aliases.

Native CEF validation used the full Sofik app and a dedicated local TLS daemon containing only a deterministic test provider:

1. A chat card loaded the stored conversation.
2. Sending from the card streamed a response and a `write_file` tool update through ACP.
3. The tool updated `example.ts`; switching to Code opened the updated file.
4. The selected Sofik chat card attached to the editor without a separate command-palette action or manual endpoint configuration.
5. Output showed tool progress and `[end_turn]`; returning to the card showed the editor's message in the same conversation.

Automated coverage includes the official ACP SDK through the bridge, handshake/load/stream/tool results, permission policy and cancellation, stdio failures/timeouts, workspace path boundaries, canonical-root deduplication, native PTY, real JSON LSP completion and authenticated Code server access. App-side coverage includes ACP controller lifecycle/reconnect, canonical daemon context, idempotency, startup/port recovery, loopback relay authentication, origin rejection and workspace persistence. The daemon ACP tests also pass with Go's race detector.

## Desktop runtime releases

Release [`v1.138.0-sofik.7`](https://github.com/sofik-ai/code/releases/tag/v1.138.0-sofik.7)
was compiled from `f081b851f352be883652c5a1d7f8d32d13ff5d61` and published by
[GitHub Actions](https://github.com/sofik-ai/code/actions/runs/35489206307).

- Native macOS arm64 (`macos-15`), Linux x64 (`ubuntu-24.04`) and Windows x64 (`windows-2025`) builds passed on Node 24.16.0.
- All three targets passed the 15 fixture tests, plus three checks using only the self-contained package: interactive terminal input/output and exit status, JSON LSP completion and authenticated server startup. Linux also passed the core TypeScript check.
- Windows setup now explicitly builds the server's registry/process-tree/certificate addons for Node. The terminal check uses the same distributed ConPTY DLL as the workbench. Its test runner exits after assertions and cleanup because that DLL can retain a native worker, matching node-pty's own test-suite practice; failed assertions still fail the job.
- Releases include three archives, individual SHA-256 files and a manifest with exact source revision, target, URL, size and digest. Publication rechecks every archive and remains a draft until all uploads complete. A transfer checksum mismatch was rejected before publication; the original Windows artifact and the successful retry matched the build's digest.
- Dependency caches are separated by target, Node ABI version, lockfiles and native setup script. App builds consume a pinned release; they do not compile Code implicitly or follow latest.

## Limits

- All agent execution above used local fixtures. Live provider login and paid requests were not exercised.
- Native application UI validation is macOS Debug. Windows/Linux Code runtimes passed the native CI checks above; full Windows/Linux application UI, production application signing, installers and size optimization are not certified here.
- The editor/configuration/extension-host compatibility services remain where languages and the upstream API depend on them. Optional product UI is removed at registrations and layout, not hidden with injected CSS; this does not claim every upstream class/dependency has been deleted.
- GitHub Dark/Light follow the host scheme; upstream accessibility fallback theme assets remain bundled.
- Existing Flutter/CEF duplicate accessibility-class and native-shortcut diagnostic warnings remain outside this change; no crash occurred in the tested journeys.
