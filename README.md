# dsh-custom-fonts

**v1.2.0** · MIT · DeepSeek Harness Web client

Customize the DeepSeek Harness UI fonts from a **Settings → Fonts** page: separate Latin and Chinese UI faces, a dedicated code font, and a flat global font-size offset. Fonts installed on your machine are offered in every field, and all settings survive a reload.

[中文说明](./README.zh-CN.md) · [安装与使用说明](./INSTALL.md) · [安装与使用说明（中文）](./INSTALL.zh-CN.md) · [Changelog](./CHANGELOG.md) · [Publishing](./PUBLISHING.md)

**Repository:** <https://github.com/liujia1128/dsh-custom-fonts> · `git clone https://github.com/liujia1128/dsh-custom-fonts.git`

---

## Quick start

```sh
git clone https://github.com/liujia1128/dsh-custom-fonts.git
cd dsh-custom-fonts
node scripts/verify.mjs        # 17 headless checks, zero dependencies
```

Then install the package through the Harness plugin manager (or add the bundle patch row below), enable it, and refresh the page once. Full walkthrough — three install methods, every control, uninstall and troubleshooting — is in [INSTALL.md](./INSTALL.md).

```yaml
# cordis.patch.yml — shipped with the package, applied by the install step
- insert:
    - id: dsh-custom-fonts
      name: dsh-custom-fonts
```

## Features

| Control | What it does |
| --- | --- |
| **UI font · Latin** | Latin text (Segoe UI, Arial, Georgia, …). |
| **UI font · Chinese** | Han characters — 霞鹜文楷 / LXGW WenKai (open-source Kaiti, built in), 微软雅黑, 思源黑体, 苹方, …. |
| **Code font** | A separate mono face for `pre`, `code`, `kbd`, `samp` and code blocks. |
| **Font-size offset** | −4…+8 px slider, applied **once** at `:root`. |
| **Scan installed fonts** | Enumerates fonts on this device and merges them into all three lists. |

- **LXGW WenKai (霞鹜文楷)** — an open-source Kaiti (楷体) face under SIL OFL 1.1, popular for personalized UIs, is a built-in option in the Chinese font field. Its `Screen`, `Lite`, `TC` and localized name variants are included, and the monospace sibling `霞鹜文楷等宽` / `LXGW WenKai Mono` / `LXGWWenKaiMono Nerd Font` is offered in the code font field. Install the font on your device first — the plugin references family names only, it does not ship font files.
- **Installed-font discovery** — `window.queryLocalFonts()` (exact OS family names; Chromium, permission may be requested) → canvas `measureText` probe over a ~70-name cross-platform pool → built-in suggestions. Deduplicated, sorted, capped at 800, cached locally.
- **Saved settings** — every change goes to `localStorage` and is replayed at boot by `apply()`, so a reload restores both the values and the injected stylesheet.
- **Live preview** — mixed Latin/Chinese sample plus a code-font sample.
- **Restore defaults** — clears all four controls and removes the stylesheet.
- **Bilingual UI** — English and Chinese labels (locale files + bundled fallback dictionary), custom icon, `meta.title` / `meta.description` for the plugin list.

Each field accepts a comma-separated list, e.g. `Segoe UI, Inter, Arial`. Quoted names work too; names are escaped before being placed into CSS.

## How it works

One `<style data-dsh-custom-fonts>` tag is injected into `<head>`:

```css
body, body * { font-family: 'Segoe UI', 'Microsoft YaHei' !important; }
pre, code, kbd, samp { font-family: 'Consolas' !important; }
:root { font-size: calc(100% + 2px) !important; }
```

- The UI stack lists the Latin face first, Chinese second. Browsers resolve each glyph through the fallback chain, so Han characters fall through to the Chinese face — no language detection, no DOM surgery.
- The code rule comes later and wins inside code regions only.
- **The size offset is a single root-level rule.** `1em` in `font-size` resolves against the *parent's* computed size, so an earlier per-element approach added N at every nesting level (16 → 18 → 20 → 22 …) and crushed inline styles. `:root { font-size: calc(100% ± Npx) }` moves the em/rem basis once and never compounds. Elements with a fixed `px` font-size keep their own size — a deliberate limitation; the built-in theme `setFontSize(role, px)` remains the per-role alternative.

Changes apply immediately and globally (message body, sidebar, inputs — everything). `font-family` is forced with `!important`, so icon fonts and inline font styles are also affected; that is expected for a global override.

## Persistence

| Key | Contents |
| --- | --- |
| `dsh-custom-fonts:settings:v1` | `{ en, zh, code, size }` |
| `dsh-custom-fonts:fonts:v1` | `{ list, source, at }` — cached installed-font names |

State lives in the Client half only: no package-private RPC, no Host config, no network access. Uninstalling removes the stylesheet; clearing site storage resets the settings.

## Project layout

```
lib/index.js            Host half (no-op, carries the bundle manifest)
client/client.js        Client bundle (UI, CSS, persistence, font discovery)
cordis.patch.yml        Bundle patch row
locale/*.json           Display metadata + UI strings (en / zh / zh-CN)
icon.svg                Settings icon
scripts/verify.mjs      Headless verification
INSTALL.md              Installation & usage guide
INSTALL.zh-CN.md        安装与使用说明
README.md               This file
README.zh-CN.md         中文说明
CHANGELOG.md            Version history
PUBLISHING.md           Release & catalog checklist
```

## Verify

```sh
node scripts/verify.mjs
# or
npm run verify
```

Zero dependencies. `node:vm` runs the Client bundle against a stubbed runtime and covers the loading contract, slot registration, CSS generation, escaping, size clamping, persistence/replay, installed-font discovery and cache, manifest/locale/icon artifacts, i18n dictionaries, release metadata and theme-token usage. Visual verification of the live page requires an authenticated Harness session.

## License

[MIT](./LICENSE) · Copyright (c) 2026
