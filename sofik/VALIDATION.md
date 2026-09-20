# Validation — 2026-09-20 (America/Sao_Paulo)

Base: Code OSS 1.138.0, upstream `7debcd0e2acdea1c52de81bf9ee1620444407dda`.
Environment: macOS arm64, Node 24.16.0.

## Simplified workbench

- Main TypeScript check and complete Sofik build passed.
- Removed the restricted-mode enablement, trust UI, notification center/toasts/status icon, web titlebar, Help/Preferences menus, global account/configuration activity, remote-window/ports UI and debugger UI. Removed palette configuration buttons and the optional upstream AI command search.
- A fresh disposable workspace opened without any trust prompt. Its TypeScript service offered string member completions; editing, save and the integrated zsh terminal worked. The terminal printed `SOFIK_CLEAN_TERMINAL_OK`.
- The compact application menu contained File, Edit, Selection, View, Go and Terminal. The editor had no header, remote-window indicator or notification bell. Native Sofik CEF rendered the same reduced layout.
- Compatibility notifications are logged and dismissed asynchronously, so extension requests settle without invisible pending prompts. Tests cover dismissal, no action execution and no retained notification queue. Legacy stored trust settings cannot restore restricted mode.

## Chat and Code integration

The desktop cards and the private editor module now share ACP sessions owned by the Sofik daemon. A session is the existing conversation, not a new agent instance. The editor resolves the stored project/worktree through authenticated session context. With a selected/only card it connects without a prompt; multiple unselected chats require an explicit conversation choice. The editor preserves its original first root and appends missing worktrees, comparing canonical paths to avoid symlink aliases.

Native CEF validation used the full Sofik app and a dedicated local TLS daemon containing only a deterministic test provider:

1. A chat card loaded the stored conversation.
2. Sending from the card streamed a response and a `write_file` tool update through ACP.
3. The tool updated `example.ts`; switching to Code opened the updated file.
4. **Sofik: Ask Agent** sent from the editor without manual endpoint/agent configuration.
5. Output showed tool progress and `[end_turn]`; returning to the card showed the editor's message in the same conversation.

Automated coverage includes the official ACP SDK through the bridge, handshake/load/stream/tool results, permission policy and cancellation, stdio failures/timeouts, workspace path boundaries, canonical-root deduplication, native PTY, real JSON LSP completion and authenticated Code server access. App-side coverage includes ACP controller lifecycle/reconnect, canonical daemon context, idempotency, startup/port recovery, loopback relay authentication, origin rejection and workspace persistence. The daemon ACP tests also pass with Go's race detector.

## Limits

- All agent execution above used local fixtures. Live provider login and paid requests were not exercised.
- Native validation is macOS Debug. Windows/Linux execution, release optimization, signing and installers are not certified here.
- The editor/configuration/extension-host compatibility services remain where languages and the upstream API depend on them. Optional product UI is removed at registrations and layout, not hidden with injected CSS; this does not claim every upstream class/dependency has been deleted.
- GitHub Dark/Light follow the host scheme; upstream accessibility fallback theme assets remain bundled.
- Existing Flutter/CEF duplicate accessibility-class and native-shortcut diagnostic warnings remain outside this change; no crash occurred in the tested journeys.
