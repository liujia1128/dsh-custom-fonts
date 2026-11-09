# Changelog

All notable changes to this project are documented here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-11-09

### Fixed

- **P0 · 设置不持久化**：原先四个控件只存在 bundle 闭包内存里，`apply()` 启动时也不重放 CSS，刷新后取值与样式表同时归零（README 却写成「刷新页面即生效」）。现在每次改动写入 `localStorage`（`dsh-custom-fonts:settings:v1`），并在 `apply()` 里恢复取值、注入样式表；`dsh.client.immediately: true` 保证开机即加载，不等设置页被打开。
- **P1-1 · 字号偏移逐层累加**：`body, body * { font-size: calc(1em ± Npx) !important }` 的 `1em` 取父元素计算值，会在每层嵌套各加一次 N，并用 `!important` 压掉行内样式。改为单条 `:root { font-size: calc(100% ± Npx) !important; }`，只移动一次 em/rem 基准，不再级联放大。README 中「相对每个元素自身字号、不会指数级放大」的错误描述已更正。
- **P1-2 · 缺少展示元数据**：新增 `locale/en.json`、`locale/zh.json`、`locale/zh-CN.json`（`meta.title` / `meta.description` + 界面文案）与自绘 `icon.svg`，并在 `package.json` 补上 `./locale/*.json`、`./icon` 导出与 `files` 条目，插件列表不再回退到包名与默认图。
- **P1-3 · 文案硬编码中文**：设置页与 slot 标签改为走 `t()` 词典（en / zh），通过 `locale.register` / `locale.subscribe` 跟随界面语言，检测失败时回退到内置词典。

### Added

- **本机已安装字体**：新增「扫描本机字体」按钮与三级发现链 —— `window.queryLocalFonts()`（精确系统字体名）→ canvas `measureText` 探测（约 70 个跨平台候选池）→ 内置建议；去重排序后合并进英文 / 中文 / 代码三个 `<datalist>`，结果缓存在 `dsh-custom-fonts:fonts:v1`，启动时静默探测并回填。
- **CSS 转义硬化**：`quoteList` 现在处理反斜杠、单双引号、控制字符、`;{}`、注释定界符，避免真实系统字体名破坏规则；顺手删掉从未被 `var()` 引用的 `--dsh-custom-fonts-en/-zh` 死变量。
- **无头验证扩展**：`scripts/verify.mjs` 从 3 项扩到 16 项，通过 `surface.__internals` 直接断言 `buildCss` / `quoteList` / `clampSize` / 持久化重放 / 字体发现 / i18n / manifest / 发布元数据 / 安装文档，并新增 `npm run verify`。
- slot id 由无命名空间的 `fonts` 改为 `dsh-custom-fonts`；`slots.register` 第二参改为直接传组件 `FontPage`（原先传的是 thunk）；`ctx.effect` 清理函数同时移除样式表与 locale 订阅。
- `lib/index.js` 注释说明为何 Host 半区保持空实现（无可用的 package-private RPC 注册契约）。

### Changed

- 版本升到 1.2.0；`dsh.client` 补 `immediately: true`；`files` 补 `scripts/verify.mjs`、`locale/*.json`、`icon.svg`、`CHANGELOG.md`。
- README / README.zh-CN 全文重写：CSS 示例、持久化说明、字体发现机制、扁平根级偏移的限制（固定 px 字号元素不受影响）。
- 仓库地址迁移到 `https://github.com/liujia1128/dsh-custom-fonts.git`；`repository` / `homepage` / `bugs` 与 PUBLISHING.md、两份 README 全量同步。
- 新增独立安装使用说明 `INSTALL.md` / `INSTALL.zh-CN.md`（三种安装方式、控件说明、生效步骤、卸载回滚、故障排查）；两份 README 改为带 v1.2.0 版本标识的快速上手页并链接到安装说明。
- `scripts/verify.mjs` 增加发布元数据 / 安装文档 / 仓库地址一致性检查（14 项 → 16 项）。

## [1.1.0] - 2026-08-24

### Added

- Code font field with its own preview, separate from the UI font stack.
- Global font-size offset slider (−4…+8 px).
- Comma-separated font lists and quoted family names.

> 更正：本版本说明曾称偏移「相对每个元素自身字号、每层只偏移一次」，实际 `calc(1em ± Npx)` 会逐层累加；1.2.0 已改为单条 `:root` 规则，详见上文。

## [1.0.0] - 2026-08-24

### Added

- Settings → 字体 page with live mixed Latin/Chinese preview.
- Separate Latin and Chinese UI font fields, stylesheet injection, restore-defaults button.
- Pure client-side implementation (no Host config, no network).
- English and Chinese README, MIT license, publishing guide.
