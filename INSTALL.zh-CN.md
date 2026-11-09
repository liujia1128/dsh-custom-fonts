# 安装与使用说明

`dsh-custom-fonts` **v1.2.0** —— DeepSeek Harness Web 客户端插件，新增 **设置 → 字体** 页面。

仓库：<https://github.com/liujia1128/dsh-custom-fonts> · `https://github.com/liujia1128/dsh-custom-fonts.git`

[English guide](./INSTALL.md) · [README](./README.zh-CN.md) · [更新日志](./CHANGELOG.md)

---

## 1. 运行环境

| 项目 | 要求 |
| --- | --- |
| 宿主 | DeepSeek Harness 桌面端 Web 客户端（`http://127.0.0.1:<端口>`） |
| 插件平台 | `web` —— 纯 Client 插件，Host 半区刻意空实现 |
| 浏览器内核 | 推荐 Chromium（用 Local Font Access API 拿精确系统字体名） |
| 运行时依赖 | 无。Client bundle 只 `require('react')`，由 Harness 提供 |
| Node.js | 仅本地跑 `scripts/verify.mjs` 时需要，运行时不需要 |

零构建、零 `npm install`、运行时零网络请求。

## 2. 安装

三选一，三种方式最终都落到同一行 bundle patch（见下）。

### 方式 A —— 插件管理器（推荐）

1. 打开 Harness Web 界面的 **设置 → 插件**。
2. 按包名 `dsh-custom-fonts`（npm）安装，或用本地目录 / GitHub tarball：

   ```sh
   # 可选：从克隆的仓库打一个本地 tarball
   git clone https://github.com/liujia1128/dsh-custom-fonts.git
   cd dsh-custom-fonts
   npm pack                 # -> dsh-custom-fonts-1.2.0.tgz
   ```

3. 也可以把克隆目录直接作为 bundle 安装 —— 在插件管理器的「安装 bundle」里传该目录的**绝对路径**。本地迭代用这个最快。
4. 若已安装但处于禁用状态，启用它。

> 安装 bundle 会改动整个 profile（其中所有会话）。只是想试一下的话，建议用临时 profile。

### 方式 B —— 手写 bundle patch

把下面这行加进 profile 的 `cordis.patch.yml`（插件自带的 [cordis.patch.yml](./cordis.patch.yml) 内容相同）：

```yaml
- insert:
    - id: dsh-custom-fonts
      name: dsh-custom-fonts
```

`name` 是包标识符：npm 安装的包从 `node_modules` 解析；本地目录要先按方式 A 第 3 步安装，才能被解析。**不需要** `config: {}` —— 本插件没有 Host 侧可调配置。

### 方式 C —— 克隆后先验再装

```sh
git clone https://github.com/liujia1128/dsh-custom-fonts.git
cd dsh-custom-fonts
node scripts/verify.mjs     # 16 项无头检查
npm pack                    # 可选：给插件管理器用的 tarball
```

然后按方式 A 第 3 步安装目录，或按第 2 步安装 tarball。

## 3. 生效

1. Client 半区声明了 `dsh.client.immediately: true`，开机即加载，不必等设置页被打开。
2. 安装后**刷新一次页面**，让新 bundle 下发；不需要重启应用。
3. 之后每次启动都会自动重放已保存的设置 —— 刷新后取值与注入的样式表都在。

## 4. 使用

打开 **设置 → 字体**（slot `settings.section`，id `dsh-custom-fonts`，order 25）。

| 控件 | 用法 |
| --- | --- |
| **UI 字体 · 英文** | 输入或选择拉丁文字字体，如 `Segoe UI, Inter, Arial`。 |
| **UI 字体 · 中文** | 输入或选择汉字字体，如 `Microsoft YaHei, 思源黑体`。 |
| **代码字体** | `pre`、`code`、`kbd`、`samp` 的等宽字体，如 `JetBrains Mono, Consolas`。 |
| **字号偏移** | 滑杆 −4…+8 px；取 `0` 时整条规则不生成。 |
| **扫描本机字体** | 点击后枚举本机可用字体，结果合并进三个候选列表。 |
| **恢复默认** | 清空四项、移除样式表并重置存储。 |

几点说明：

- 支持**逗号分隔的字体列表**，带引号的名称也可用；写入 CSS 前会转义（反斜杠、引号、控制字符、`;{}`、注释定界符）。
- **本机字体发现**分三级：`window.queryLocalFonts()` 拿精确系统字体名（Chromium 可能请求权限）→ canvas `measureText` 探测约 70 个跨平台候选名 → 内置建议（始终保留）。结果去重排序、缓存在 `localStorage`，启动时静默重探。
- **实时预览**里有中英混排示例和代码字体示例，改之前可以先对比。
- **界面语言**跟随 Harness locale 服务（英文 / 简体中文），服务不可用时回退到内置词典。
- **全局生效**：消息正文、侧栏、输入框都受影响。`font-family` 带 `!important`，图标字体与行内字体样式同样被覆盖 —— 这是全局覆盖的预期行为。

## 5. 持久化与存储

| 键 | 内容 |
| --- | --- |
| `dsh-custom-fonts:settings:v1` | `{ en, zh, code, size }` |
| `dsh-custom-fonts:fonts:v1` | `{ list, source, at }` —— 缓存的本机字体名 |

状态只存在于 Client 半区：无 package-private RPC、无 Host 配置、无网络请求。清理站点存储会重置设置；卸载插件时 `ctx.effect` 清理函数会移除注入的样式表。

## 6. 卸载 / 回滚

1. 在 **设置 → 插件** 里禁用或移除 `dsh-custom-fonts`（或从 `cordis.patch.yml` 删掉那行 patch）。
2. 刷新页面，`<style data-dsh-custom-fonts>` 随之消失。
3. 需要彻底忘记设置时，删掉上面两个 `localStorage` 键。
4. 如果是手改的 profile，保留 `cordis.patch.yml` 原件 —— patch 层属于用户资产，包升级不会覆盖它。

## 7. 故障排查

| 现象 | 原因 / 处理 |
| --- | --- |
| 装完没变化 | 刷新一次页面让新 Client bundle 下发；确认插件已启用。 |
| 图标字形变怪 | 全局 `!important` 字体也会命中图标字体。把英文字体收窄成含图标的字体族，或留空 UI 字体字段。 |
| 有些文字字号不变 | 偏移是单条 `:root` 规则，固定 `px` 字号的元素保持原样；按角色调整可用内置 theme `setFontSize(role, px)`。 |
| 字体列表很短 / 只有通用项 | `queryLocalFonts` 需要 Chromium 与权限。再点一次「扫描本机字体」，或直接手输字体名 —— canvas 探测与内置建议始终可用。 |
| 刷新后设置丢失 | 检查隐私扩展是否清理站点存储；取值每次改动都会写入，启动时重放。 |
| 带空格的字体名出问题 | 用引号或逗号分隔的字体栈；插件生成 CSS 前会转义名称。 |

## 8. 验证本地副本

```sh
node scripts/verify.mjs
# 或
npm run verify
```

零依赖。脚本用 `node:vm` 在桩运行时里加载 Client bundle，覆盖加载契约、slot/locale 注册、CSS 生成与转义、字号钳位、持久化与启动重放、本机字体发现与缓存、manifest/locale/icon 产物、i18n 词典、发布元数据与 theme token 使用。页面视觉效果需要在已登录的 Harness 会话中确认。

## 9. 许可

[MIT](./LICENSE) · Copyright (c) 2026
