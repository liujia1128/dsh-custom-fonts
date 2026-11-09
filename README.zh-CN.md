# dsh-custom-fonts

**v1.2.0** · MIT · DeepSeek Harness Web 客户端

在 **设置 → 字体** 页自定义 DeepSeek Harness 界面字体：英文 / 中文 UI 字体、独立的代码字体、扁平的全局字号偏移。每个输入框都会列出本机已安装的字体，所有设置在刷新后依然保留。

[English](./README.md) · [安装与使用说明](./INSTALL.zh-CN.md) · [Installation & usage](./INSTALL.md) · [更新日志](./CHANGELOG.md) · [发布说明](./PUBLISHING.md)

**仓库：** <https://github.com/liujia1128/dsh-custom-fonts> · `git clone https://github.com/liujia1128/dsh-custom-fonts.git`

---

## 快速开始

```sh
git clone https://github.com/liujia1128/dsh-custom-fonts.git
cd dsh-custom-fonts
node scripts/verify.mjs        # 17 项无头检查，零依赖
```

然后在 Harness 插件管理器中安装本包（或写入下方 bundle patch 行）、启用、刷新一次页面。三种安装方式、每个控件、卸载与故障排查的完整步骤见 [INSTALL.zh-CN.md](./INSTALL.zh-CN.md)。

```yaml
# cordis.patch.yml —— 随包提供，由安装步骤写入 profile
- insert:
    - id: dsh-custom-fonts
      name: dsh-custom-fonts
```

## 功能

| 控件 | 作用 |
| --- | --- |
| **UI 字体 · 英文** | 拉丁文字（Segoe UI、Arial、Georgia …）。 |
| **UI 字体 · 中文** | 汉字（霞鹜文楷 / LXGW WenKai 开源楷体，微软雅黑、思源黑体、苹方 …）。 |
| **代码字体** | 为 `pre`、`code`、`kbd`、`samp` 与代码块单独指定等宽字体。 |
| **字号偏移** | −4…+8 px 滑杆，**只**在 `:root` 应用一次。 |
| **扫描本机字体** | 枚举这台机器上的字体，合并进三个候选列表。 |

- **霞鹜文楷 (LXGW WenKai)** —— 开源楷体（SIL OFL 1.1），字形优美、社区人气高，已作为内置建议加入「UI 字体 · 中文」；`Screen` / `Lite` / `TC` / 中文名等别名一并收录，等宽版「霞鹜文楷等宽」/ `LXGW WenKai Mono` / `LXGWWenKaiMono Nerd Font` 放进代码字体列表。插件只写入字体族名称，不含字体文件，需先在本机安装该字体。
- **本机字体发现** —— `window.queryLocalFonts()`（精确系统字体名；Chromium，可能弹出权限请求）→ canvas `measureText` 探测（约 70 个跨平台候选名）→ 内置建议。去重排序、上限 800 条、结果本地缓存。
- **设置持久化** —— 每次改动写入 `localStorage`，并由 `apply()` 在启动时重放，刷新后取值与注入的样式表都会恢复。
- **实时预览** —— 中英混排示例 + 代码字体示例。
- **恢复默认** —— 清空四项设置并移除样式表。
- **中英双语界面** —— 英文 / 中文文案（locale 文件 + 内置回退词典）、自绘图标，以及插件列表用的 `meta.title` / `meta.description`。

每个输入框支持逗号分隔的字体列表，例如 `Segoe UI, Inter, Arial`；带引号的名称也可用。名称在写入 CSS 前会做转义。

## 实现原理

向 `<head>` 注入唯一的 `<style data-dsh-custom-fonts>`：

```css
body, body * { font-family: 'Segoe UI', 'Microsoft YaHei' !important; }
pre, code, kbd, samp { font-family: 'Consolas' !important; }
:root { font-size: calc(100% + 2px) !important; }
```

- UI 字体栈把英文字体放在前面、中文字体放在后面。浏览器按回退链逐字匹配字形：拉丁字体没有汉字字形，汉字自然落到中文字体，无需语言检测或改写 DOM。
- 代码字体规则排在后面，只在代码区域内生效。
- **字号偏移是单条根级规则。** `font-size` 里的 `1em` 取的是**父元素**的计算值，早先的逐元素写法会在每层嵌套各加一次 N（16 → 18 → 20 → 22 …），还会压掉行内样式。改成 `:root { font-size: calc(100% ± Npx) }` 只移动一次 em/rem 基准，不会逐层累加；使用固定 `px` 字号的元素保持原样 —— 这是扁平根级偏移的已知限制，按角色调整仍可用内置的 theme `setFontSize(role, px)`。

改动立即全局生效（消息正文、侧栏、输入框都在内）。`font-family` 带 `!important` 强制覆盖，因此图标字体与行内字体样式也会受影响，这是全局覆盖的预期行为。

## 持久化

| 键 | 内容 |
| --- | --- |
| `dsh-custom-fonts:settings:v1` | `{ en, zh, code, size }` |
| `dsh-custom-fonts:fonts:v1` | `{ list, source, at }` —— 缓存的本机字体名 |

状态只存在于 Client 半区：无 package-private RPC、无 Host 配置、无网络请求。卸载插件会移除样式表；清理站点存储会重置设置。

## 目录结构

```
lib/index.js            Host 半区（空实现，仅承载 bundle manifest）
client/client.js        Client bundle（UI、CSS、持久化、字体发现）
cordis.patch.yml        Bundle patch 行
locale/*.json           展示元数据 + 界面文案（en / zh / zh-CN）
icon.svg                设置项图标
scripts/verify.mjs      无头验证脚本
INSTALL.md              Installation & usage guide
INSTALL.zh-CN.md        安装与使用说明
README.md               English README
README.zh-CN.md         本文件
CHANGELOG.md            版本历史
PUBLISHING.md           发布与市场目录清单
```

## 验证

```sh
node scripts/verify.mjs
# 或
npm run verify
```

零依赖。脚本用 `node:vm` 在桩运行时里加载 Client bundle，覆盖加载契约、slot 注册、CSS 生成、转义、字号钳位、持久化/启动重放、本机字体发现与缓存、manifest/locale/icon 产物、i18n 词典、发布元数据与 theme token 使用。页面视觉效果需要在已登录的 Harness 会话中确认。

## 许可

[MIT](./LICENSE) · Copyright (c) 2026
