/**
 * dsh-custom-fonts — host half.
 *
 * Intentionally a no-op: every behavior of this plugin lives in the
 * browser half (./client). The host entry exists so the package carries a
 * `dsh.bundle` manifest — the marketplace listing requirement — and the
 * loader has something to import on the Node side.
 *
 * The Client half owns all state (localStorage), the injected stylesheet,
 * font discovery and the settings page. There is no package-private RPC:
 * the `window.__ModuleLoader__` bundle has no confirmed `host.call` channel,
 * so nothing is mounted or configured here.
 */
export const name = 'dsh-custom-fonts'

/** No host-side behavior. */
export function apply() {}
