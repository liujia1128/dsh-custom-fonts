# Installation & usage guide

`dsh-custom-fonts` **v1.2.0** — a DeepSeek Harness Web client plugin that adds a **Settings → Fonts** page.

Repository: <https://github.com/liujia1128/dsh-custom-fonts> · `https://github.com/liujia1128/dsh-custom-fonts.git`

[中文安装与使用说明](./INSTALL.zh-CN.md) · [README](./README.md) · [Changelog](./CHANGELOG.md)

---

## 1. Requirements

| Item | Requirement |
| --- | --- |
| Host | DeepSeek Harness desktop app with the Web client (`http://127.0.0.1:<port>`) |
| Plugin platform | `web` — this is a Client-only bundle; the Host half is an intentional no-op |
| Browser engine | Chromium recommended (needed for the exact OS font list via Local Font Access API) |
| Runtime deps | None. The Client bundle requires only `react`, which the Harness provides |
| Node.js | Only needed to run `scripts/verify.mjs` locally; not needed at runtime |

No build step, no `npm install`, no network access at runtime.

## 2. Install

Pick **one** of the three methods. All of them end with the same bundle patch row (shown below).

### Method A — Plugin manager (recommended)

1. Open **Settings → Plugins** in the Harness Web UI.
2. Install the package by name `dsh-custom-fonts` (npm) or by local directory / GitHub tarball:

   ```sh
   # Optional: produce a local tarball from the cloned repo
   git clone https://github.com/liujia1128/dsh-custom-fonts.git
   cd dsh-custom-fonts
   npm pack                 # -> dsh-custom-fonts-1.2.0.tgz
   ```

3. Or install the cloned directory directly as a bundle — pass the **absolute path** of the clone to the plugin manager's "install bundle" action. This is the fastest way to iterate on a local checkout.
4. Enable the plugin if it is installed but disabled.

> Installing a bundle changes the whole profile (every session in it). If you only want to try the plugin, use a scratch profile.

### Method B — Hand-write the bundle patch

Add this row to your profile's `cordis.patch.yml` (the plugin ships the same file at [cordis.patch.yml](./cordis.patch.yml)):

```yaml
- insert:
    - id: dsh-custom-fonts
      name: dsh-custom-fonts
```

`name` is the package specifier. With `npm`-installed packages it resolves from `node_modules`; with a local checkout, install the directory first so the package is resolvable. No `config: {}` is needed — this plugin has no Host-side tunable config.

### Method C — Clone and verify before shipping

```sh
git clone https://github.com/liujia1128/dsh-custom-fonts.git
cd dsh-custom-fonts
node scripts/verify.mjs     # 17 headless checks
npm pack                    # optional tarball for the plugin manager
```

Then install the cloned directory (Method A, step 3) or the tarball (Method A, step 2).

## 3. Activate

1. The Client half declares `dsh.client.immediately: true`, so it loads at boot without waiting for the Settings page to open.
2. **Refresh the Web page once** after installation so the new bundle is delivered. No application restart is needed.
3. From that point on, saved settings are replayed automatically at every boot — a refresh keeps both the values and the injected stylesheet.

## 4. Use

Open **Settings → Fonts** (slot `settings.section`, id `dsh-custom-fonts`, order 25).

| Control | How to use |
| --- | --- |
| **UI font · Latin** | Type or pick a family for Latin text, e.g. `Segoe UI, Inter, Arial`. |
| **UI font · Chinese** | Type or pick a family for Han characters, e.g. `LXGW WenKai, Microsoft YaHei, 思源黑体`. 霞鹜文楷 / LXGW WenKai (open-source Kaiti) is built into the list. |
| **Code font** | Mono face for `pre`, `code`, `kbd`, `samp`, e.g. `JetBrains Mono, Consolas`. |
| **Font-size offset** | Slider −4…+8 px; `0` removes the rule entirely. |
| **Scan installed fonts** | Click to enumerate fonts available on this device; results merge into all three suggestion lists. |
| **Restore defaults** | Clears all four fields, removes the stylesheet and resets storage. |

Details worth knowing:

- **LXGW WenKai (霞鹜文楷)** is bundled as a built-in Chinese font suggestion (plus `Screen` / `Lite` / `TC` and localized aliases); its monospace variant `霞鹜文楷等宽` / `LXGW WenKai Mono` is in the code font list. The plugin only emits family names — install the font on the device first (SIL OFL 1.1), otherwise the browser falls back to the next family in the stack.
- **Comma-separated lists** are supported and quoted names work too. Names are escaped before entering CSS (backslashes, quotes, control characters, `;{}`, comment delimiters).
- **Installed-font discovery** runs in three tiers: `window.queryLocalFonts()` for exact OS family names (Chromium may ask for permission) → canvas `measureText` probe over a ~70-name cross-platform pool → built-in suggestions, which always remain. The result is deduplicated, sorted, cached in `localStorage`, and silently re-probed at boot.
- **Live preview** shows a mixed Latin/Chinese sample and a code-font sample so you can compare before committing.
- **Language** follows the Harness locale service (English / Simplified Chinese), with a bundled fallback dictionary if the service is unavailable.
- **Everything is global**: message body, sidebar and inputs are all affected. `font-family` uses `!important`, so icon fonts and inline font styles are overridden too — expected for a global override.

## 5. Persistence & storage

| Key | Contents |
| --- | --- |
| `dsh-custom-fonts:settings:v1` | `{ en, zh, code, size }` |
| `dsh-custom-fonts:fonts:v1` | `{ list, source, at }` — cached installed-font names |

State lives only in the Client half: no package-private RPC, no Host config, no network calls. Clearing site storage resets the settings. Uninstalling the plugin removes the injected stylesheet through `ctx.effect` cleanup.

## 6. Uninstall / rollback

1. Disable or remove `dsh-custom-fonts` in **Settings → Plugins** (or delete the patch row from `cordis.patch.yml`).
2. Refresh the page; the `<style data-dsh-custom-fonts>` tag is gone.
3. Optionally remove the two `localStorage` keys above to forget the saved values.
4. Keep the original `cordis.patch.yml` copy if you hand-edited the profile — the patch layer is user-owned and survives package upgrades.

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Nothing changes after install | Refresh the page once so the new Client bundle is delivered; confirm the plugin is enabled. |
| Icon glyphs look wrong | Global `!important` font-family also hits icon fonts. Narrow the Latin field to a family that includes icons, or leave the UI font field empty. |
| Some text does not resize | The offset is a single `:root` rule; elements with a fixed `px` font-size keep their own size. Use the built-in theme `setFontSize(role, px)` for per-role control. |
| Font list is short / generic | `queryLocalFonts` needs Chromium + permission. Click **Scan installed fonts** again, or type the family name manually — the canvas probe and built-in suggestions still work. |
| Settings lost after refresh | Confirm site storage is not cleared by a privacy extension; the values are written on every change and replayed at boot. |
| Font name with spaces breaks the field | Use quotes or a comma-separated stack; the plugin escapes names before generating CSS. |

## 8. Verify a checkout

```sh
node scripts/verify.mjs
# or
npm run verify
```

Zero dependencies. `node:vm` runs the Client bundle in a stubbed runtime and checks the loading contract, slot/locale registration, CSS generation and escaping, size clamping, persistence + boot replay, installed-font discovery and cache, manifest/locale/icon artifacts, i18n dictionaries, release metadata and theme-token usage. Visual confirmation of the live page requires an authenticated Harness session.

## 9. License

[MIT](./LICENSE) · Copyright (c) 2026
