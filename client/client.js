/**
 * dsh-custom-fonts — client bundle.
 *
 * Adds a "Fonts" page under Settings that customizes the global UI fonts:
 *   - UI fonts: a Latin face and a CJK face, resolved through one CSS
 *     font-family fallback chain (Latin first, Han characters fall back to
 *     the CJK face — no language detection, no DOM surgery);
 *   - Code font: a separate mono face for `pre`/`code`/`kbd`/`samp`;
 *   - Font-size offset: a single flat `:root` rule (-4..+8 px), applied once
 *     to the em/rem basis so it does NOT compound on nested elements;
 *   - Installed fonts: the Local Font Access API (with a canvas measureText
 *     probe fallback) enumerates fonts available on this device and offers
 *     them in every field's <datalist>.
 *
 * Settings are persisted in localStorage and replayed at boot, so a page
 * refresh restores both the controls and the injected stylesheet.
 *
 * Bundle shape follows the official client-modules contract:
 *   window.__ModuleLoader__.load({ id, factory })
 * The factory's only external is `react` from the loader module table; every
 * other runtime dependency (DOM, localStorage, navigator, queryLocalFonts)
 * is guarded so the bundle also loads in headless verification.
 */
window.__ModuleLoader__.load({
  id: 'dsh-custom-fonts',
  factory: (require) => {
    const React = require('react')
    const createElement = React.createElement
    const useState = React.useState
    const useEffect = React.useEffect
    const h = createElement

    // ---- constants ------------------------------------------------------
    const SETTINGS_KEY = 'dsh-custom-fonts:settings:v1'
    const FONTS_KEY = 'dsh-custom-fonts:fonts:v1'
    const SLOT_ID = 'dsh-custom-fonts'
    const DEFAULT = { en: '', zh: '', code: '', size: 0 }

    const EN_FONTS = [
      'Segoe UI', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
      'Courier New', 'Consolas', 'Verdana', 'Calibri', 'Tahoma', 'Inter',
    ]
    const ZH_FONTS = [
      '微软雅黑', 'Microsoft YaHei', '宋体', 'SimSun', '黑体', 'SimHei',
      '楷体', 'KaiTi', '仿宋', 'FangSong', '思源黑体', 'Noto Sans CJK SC',
      '苹方', 'PingFang SC', '等线', 'DengXian',
    ]
    const CODE_FONTS = [
      'Consolas', 'Courier New', 'Menlo', 'Monaco', 'SF Mono',
      'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro',
      'DejaVu Sans Mono', 'Sarasa Mono SC', '等距更纱黑体', 'Roboto Mono',
    ]
    // Wider cross-platform candidate pool for the canvas probe. Real installed
    // families come from queryLocalFonts(); this pool is the permission-free
    // fallback and the seed for the probe.
    const COMMON_FONTS = [
      'Arial Black', 'Arial Narrow', 'Bahnschrift', 'Calibri Light', 'Cambria',
      'Cambria Math', 'Candara', 'Century Gothic', 'Comic Sans MS', 'Constantia',
      'Corbel', 'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi',
      'Impact', 'Ink Free', 'Leelawadee UI', 'Lucida Console',
      'Lucida Sans Unicode', 'Malgun Gothic', 'Microsoft JhengHei',
      'Microsoft YaHei UI', 'MingLiU', 'NSimSun', 'Palatino Linotype',
      'Segoe Print', 'Segoe Script', 'Segoe UI Emoji', 'Segoe UI Historic',
      'Segoe UI Symbol', 'Sitka', 'Sylfaen', 'Trebuchet MS', 'Webdings',
      'Wingdings', 'Yu Gothic', 'MS Gothic', 'Meiryo', '幼圆', '华文细黑',
      '思源宋体', 'Noto Serif CJK SC', 'Source Han Sans SC',
      'Avenir', 'Avenir Next', 'Baskerville', 'Geneva', 'Helvetica Neue',
      'Hiragino Sans', 'Lucida Grande', 'Optima', 'Palatino', 'PingFang TC',
      'San Francisco', 'Songti SC', 'STHeiti',
      'Cantarell', 'DejaVu Sans', 'DejaVu Serif', 'Droid Sans', 'Hack',
      'Lato', 'Liberation Mono', 'Liberation Sans', 'Liberation Serif',
      'Noto Sans', 'Noto Sans Mono CJK SC', 'Open Sans', 'Roboto',
      'Source Han Serif SC', 'Ubuntu', 'Ubuntu Mono', 'WenQuanYi Micro Hei',
      'Cascadia Mono', 'JetBrains Mono NL', 'IBM Plex Mono', 'Inconsolata',
    ]

    // ---- i18n -----------------------------------------------------------
    // The locale service's snapshot/translate shapes are version-dependent,
    // so registration and subscription are best-effort and a bundled
    // dictionary is always the source of truth for t().
    const I18N = {
      en: {
        title: 'Fonts',
        intro: 'Pick the UI fonts (Latin + Chinese), a code font and a global size offset. Fonts installed on this device are offered in every field. Settings are saved locally and restored on reload.',
        enLabel: 'UI font · Latin',
        zhLabel: 'UI font · Chinese',
        codeLabel: 'Code font',
        sizeLabel: 'Font size offset',
        phEn: 'e.g. Segoe UI, Arial',
        phZh: 'e.g. Microsoft YaHei, Noto Sans CJK SC',
        phCode: 'e.g. Consolas, JetBrains Mono',
        zero: 'Reset',
        reset: 'Restore defaults',
        scan: 'Scan installed fonts',
        scanning: 'Scanning…',
        scanDone: 'Found {n} fonts',
        scanFail: 'Font scan is unavailable here; built-in suggestions remain.',
        installed: '{n} fonts available · {source}',
        source_os: 'local font access',
        source_probe: 'font probe',
        source_auto: 'auto-detected',
        source_cache: 'cached',
        source_builtin: 'built-in',
        note: 'The offset is applied once at :root (em/rem basis), so it does not compound on nested elements. Elements with a fixed px font-size keep their own size.',
        previewLatin: 'The quick brown fox jumps over the lazy dog 0123456789',
        previewCjk: '敏捷的棕色狐狸跳过了懒狗 0123456789',
        codeSample: 'const font = "ui + code"; return 0x2f;  // code font preview',
        codeSampleEmpty: 'const demo = "set your code font";  // code font preview',
      },
      zh: {
        title: '字体',
        intro: '自定义界面字体（英文 / 中文）、代码字体与全局字号偏移。本机已安装的字体会出现在每个选择列表中；设置保存在本机，刷新后自动恢复。',
        enLabel: 'UI 字体 · 英文',
        zhLabel: 'UI 字体 · 中文',
        codeLabel: '代码字体',
        sizeLabel: '字体大小偏移',
        phEn: '例如 Segoe UI, Arial',
        phZh: '例如 微软雅黑, 思源黑体',
        phCode: '例如 Consolas, JetBrains Mono',
        zero: '归零',
        reset: '恢复默认',
        scan: '扫描本机字体',
        scanning: '正在扫描…',
        scanDone: '已发现 {n} 款字体',
        scanFail: '当前环境不支持字体扫描，仍可使用内置建议。',
        installed: '可选 {n} 款字体 · {source}',
        source_os: '本地字体 API',
        source_probe: '字体探测',
        source_auto: '自动探测',
        source_cache: '缓存',
        source_builtin: '内置建议',
        note: '字号偏移只在 :root 应用一次（作用于 em/rem 基准），不会在嵌套元素上逐层累加；使用固定 px 字号的元素保持原样。',
        previewLatin: 'The quick brown fox jumps over the lazy dog 0123456789',
        previewCjk: '敏捷的棕色狐狸跳过了懒狗 0123456789',
        codeSample: 'const font = "ui + code"; return 0x2f;  // 代码字体预览',
        codeSampleEmpty: 'const demo = "set your code font";  // 代码字体预览',
      },
    }

    let lang = 'en'
    const langListeners = new Set()

    function detectLang(locale) {
      let id
      try {
        const snap = locale && (typeof locale.getLocale === 'function'
          ? locale.getLocale()
          : (typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : undefined))
        if (snap && typeof snap === 'object') {
          id = snap.id || snap.locale || snap.lang || snap.current || snap.language || snap.name
        } else if (typeof snap === 'string') {
          id = snap
        }
        if (Array.isArray(id)) id = id[0]
      } catch (_) { /* snapshot shape unknown */ }
      if (!id) {
        try { id = typeof navigator !== 'undefined' ? navigator.language : '' } catch (_) {}
      }
      return /^zh\b/i.test(String(id || '')) ? 'zh' : 'en'
    }

    function setLang(next) {
      const n = next === 'zh' ? 'zh' : 'en'
      if (n === lang) return
      lang = n
      langListeners.forEach((fn) => { try { fn() } catch (_) {} })
    }

    function t(key, params) {
      const table = I18N[lang] || I18N.en
      let s = table[key] != null ? table[key] : (I18N.en[key] != null ? I18N.en[key] : key)
      if (params) {
        Object.keys(params).forEach((k) => { s = s.split('{' + k + '}').join(String(params[k])) })
      }
      return s
    }

    function useRerender(listeners) {
      const [, setTick] = useState(0)
      useEffect(() => {
        const fn = () => setTick((n) => n + 1)
        listeners.add(fn)
        return () => listeners.delete(fn)
      }, [listeners])
    }

    // ---- installed-font discovery --------------------------------------
    const fontState = { installed: [], source: 'builtin', scannedAt: 0 }
    const fontListeners = new Set()

    function mergeOptions(...lists) {
      const seen = Object.create(null)
      const out = []
      lists.forEach((list) => (list || []).forEach((name) => {
        const s = String(name == null ? '' : name).trim()
        const key = s.toLowerCase()
        if (!s || seen[key]) return
        seen[key] = 1
        out.push(s)
      }))
      return out.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    }

    function loadFontCache() {
      try {
        const raw = globalThis.localStorage && globalThis.localStorage.getItem(FONTS_KEY)
        if (!raw) return null
        const o = JSON.parse(raw)
        return o && Array.isArray(o.list) ? o : null
      } catch (_) { return null }
    }

    function setInstalled(list, source) {
      fontState.installed = list.slice(0, 800)
      fontState.source = source || 'builtin'
      fontState.scannedAt = Date.now()
      try {
        if (globalThis.localStorage) {
          globalThis.localStorage.setItem(FONTS_KEY, JSON.stringify({
            list: fontState.installed, source: fontState.source, at: fontState.scannedAt,
          }))
        }
      } catch (_) { /* storage may be unavailable */ }
      fontListeners.forEach((fn) => { try { fn() } catch (_) {} })
    }

    // Permission-free detection: compare measured text width against each
    // generic fallback. A real installed family changes at least one width.
    function detectFonts(candidates) {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') return []
      let ctx
      try {
        const canvas = document.createElement('canvas')
        ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null
      } catch (_) { return [] }
      if (!ctx || typeof ctx.measureText !== 'function') return []
      const base = ['monospace', 'sans-serif', 'serif']
      const text = 'mmmmmmmmmmlliWW@#中文字体0123456789'
      const widths = {}
      try {
        base.forEach((b) => { ctx.font = '72px ' + b; widths[b] = ctx.measureText(text).width })
      } catch (_) { return [] }
      const found = []
      candidates.forEach((name) => {
        const quoted = "'" + String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
        for (let i = 0; i < base.length; i += 1) {
          try {
            ctx.font = '72px ' + quoted + ', ' + base[i]
            if (Math.abs(ctx.measureText(text).width - widths[base[i]]) > 0.5) {
              found.push(name)
              return
            }
          } catch (_) { /* skip malformed family */ }
        }
      })
      return found
    }

    // Local Font Access API (Chromium). May require permission / a user
    // gesture, so it is only attempted from the explicit "Scan" button.
    async function queryOsFonts() {
      try {
        const w = typeof window !== 'undefined' ? window : globalThis
        if (typeof w.queryLocalFonts !== 'function') return null
        const list = await w.queryLocalFonts()
        if (!list || typeof list.forEach !== 'function') return null
        const out = []
        const seen = Object.create(null)
        list.forEach((f) => {
          const n = String((f && (f.family || f.fullName)) || '').trim()
          const key = n.toLowerCase()
          if (n && !seen[key]) { seen[key] = 1; out.push(n) }
        })
        return out
      } catch (_) { return null }
    }

    async function scanFonts() {
      const pool = mergeOptions(EN_FONTS, ZH_FONTS, CODE_FONTS, COMMON_FONTS)
      const os = await queryOsFonts()
      const probed = detectFonts(pool)
      let source
      if (os && os.length > 0) {
        setInstalled(mergeOptions(os, probed), 'os')
        source = 'os'
      } else if (probed.length > 0) {
        setInstalled(mergeOptions(fontState.installed, probed), 'probe')
        source = 'probe'
      } else {
        setInstalled(mergeOptions(fontState.installed), 'builtin')
        source = 'builtin'
      }
      return { count: fontState.installed.length, source }
    }

    // ---- CSS ------------------------------------------------------------
    // Escape everything that could break out of a single-quoted CSS string.
    // Real installed family names can contain quotes, backslashes or
    // punctuation, so this is stricter than the original naive quote strip.
    function quoteList(str) {
      return String(str == null ? '' : str)
        .split(',')
        .map((s) => s.trim().replace(/^['"]+/, '').replace(/['"]+$/, ''))
        .map((s) => s
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/"/g, '')
          .replace(/[\u0000-\u001f\u007f]/g, ' ')
          .replace(/[;{}]/g, ' ')
          .replace(/\/\*|\*\//g, ' ')
          .trim())
        .filter((s) => s.length > 0)
        .map((s) => "'" + s + "'")
        .join(', ')
    }

    function clampSize(v) {
      const n = Number(v)
      if (!Number.isFinite(n)) return 0
      return Math.max(-4, Math.min(8, Math.round(n)))
    }

    function buildCss(o) {
      const enQ = quoteList(o.en)
      const zhQ = quoteList(o.zh)
      const codeQ = quoteList(o.code)
      const offset = clampSize(o.size)
      const rules = []
      const uiStack = [enQ, zhQ].filter(Boolean).join(', ')
      if (uiStack) {
        rules.push('body, body * { font-family: ' + uiStack + ' !important; }')
      }
      if (codeQ) {
        rules.push('pre, code, kbd, samp { font-family: ' + codeQ + ' !important; }')
      }
      if (offset !== 0) {
        const sign = offset > 0 ? '+' : '-'
        // ONE root-level rule. The old `body, body * { font-size: calc(1em ±
        // Npx) }` resolved 1em against the parent and added N at every nesting
        // level; :root moves the em/rem basis once and never compounds.
        rules.push(':root { font-size: calc(100% ' + sign + ' ' + Math.abs(offset) + 'px) !important; }')
      }
      return rules.length === 0 ? null : rules.join('\n')
    }

    // ---- state + persistence (P0) --------------------------------------
    const state = { ...DEFAULT }
    let styleTag = null

    function loadSettings() {
      try {
        const raw = globalThis.localStorage && globalThis.localStorage.getItem(SETTINGS_KEY)
        if (!raw) return { ...DEFAULT }
        const o = JSON.parse(raw)
        return {
          en: typeof o.en === 'string' ? o.en : '',
          zh: typeof o.zh === 'string' ? o.zh : '',
          code: typeof o.code === 'string' ? o.code : '',
          size: clampSize(o.size),
        }
      } catch (_) { return { ...DEFAULT } }
    }

    function saveSettings(s) {
      try {
        if (globalThis.localStorage) {
          globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            en: s.en, zh: s.zh, code: s.code, size: clampSize(s.size),
          }))
        }
      } catch (_) { /* storage may be unavailable */ }
    }

    // Applies (or reverts) everything and persists on every change. Returns
    // the generated CSS so headless verification can assert it without a DOM.
    function applyFonts(next) {
      if (next) Object.assign(state, next)
      state.size = clampSize(state.size)
      saveSettings(state)
      const css = buildCss(state)
      if (typeof document === 'undefined' || !document.head ||
          typeof document.createElement !== 'function') return css
      if (styleTag !== null) {
        try { styleTag.remove() } catch (_) {}
        styleTag = null
      }
      if (css !== null) {
        const tag = document.createElement('style')
        tag.setAttribute('data-dsh-custom-fonts', '')
        tag.textContent = css
        document.head.appendChild(tag)
        styleTag = tag
      }
      return css
    }

    // ---- UI -------------------------------------------------------------
    const fieldLabelStyle = {
      display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6,
      color: 'var(--dsw-alias-label-primary)',
    }
    const inputStyle = {
      width: '100%', boxSizing: 'border-box', padding: '8px 10px',
      borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)',
      background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)',
      fontSize: 14, outline: 'none',
    }
    const btnStyle = {
      fontSize: 12, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
      border: '1px solid var(--dsw-alias-border-l1)',
      background: 'var(--dsw-alias-bg-layer-2)',
      color: 'var(--dsw-alias-label-primary)',
    }

    function Field(props) {
      return h('div', { style: { marginBottom: 14 } },
        h('label', { style: fieldLabelStyle }, props.label),
        h('input', {
          type: 'text', list: props.listId, value: props.value,
          placeholder: props.placeholder, onChange: props.onChange,
          style: inputStyle,
        }),
        h('datalist', { id: props.listId },
          props.options.map((name) => h('option', { key: name, value: name })),
        ),
      )
    }

    function FontPage() {
      useRerender(langListeners)
      useRerender(fontListeners)
      const [en, setEn] = useState(state.en)
      const [zh, setZh] = useState(state.zh)
      const [code, setCode] = useState(state.code)
      const [size, setSize] = useState(state.size)
      const [scanning, setScanning] = useState(false)
      const [scanMsg, setScanMsg] = useState('')

      const installed = fontState.installed
      const optEn = mergeOptions(EN_FONTS, installed)
      const optZh = mergeOptions(ZH_FONTS, installed)
      const optCode = mergeOptions(CODE_FONTS, installed)
      const uiStack = [quoteList(en), quoteList(zh)].filter(Boolean).join(', ')
      const codeQ = quoteList(code)

      function onScan() {
        if (scanning) return
        setScanning(true)
        setScanMsg(t('scanning'))
        Promise.resolve(scanFonts()).then((r) => {
          setScanning(false)
          setScanMsg(t('scanDone', { n: r.count }))
        }).catch(() => {
          setScanning(false)
          setScanMsg(t('scanFail'))
        })
      }

      function onReset() {
        setEn(''); setZh(''); setCode(''); setSize(0)
        setScanMsg('')
        applyFonts({ en: '', zh: '', code: '', size: 0 })
      }

      const sourceKey = 'source_' + (fontState.source || 'builtin')

      return h('div', { style: { maxWidth: 560, padding: '4px 2px' } },
        h('p', {
          style: {
            margin: '0 0 16px', fontSize: 13, lineHeight: 1.7,
            color: 'var(--dsw-alias-label-secondary)',
          },
        }, t('intro')),

        h('div', {
          style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 },
        },
          h('button', {
            type: 'button', onClick: onScan, disabled: scanning,
            style: Object.assign({}, btnStyle, { opacity: scanning ? 0.6 : 1, flexShrink: 0 }),
          }, scanning ? t('scanning') : t('scan')),
          h('span', {
            style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
          }, scanMsg || t('installed', { n: installed.length, source: t(sourceKey) })),
        ),

        h(Field, {
          label: t('enLabel'), listId: SLOT_ID + '-en-list', value: en,
          placeholder: t('phEn'), options: optEn,
          onChange: (e) => { setEn(e.target.value); applyFonts({ en: e.target.value }) },
        }),
        h(Field, {
          label: t('zhLabel'), listId: SLOT_ID + '-zh-list', value: zh,
          placeholder: t('phZh'), options: optZh,
          onChange: (e) => { setZh(e.target.value); applyFonts({ zh: e.target.value }) },
        }),
        h(Field, {
          label: t('codeLabel'), listId: SLOT_ID + '-code-list', value: code,
          placeholder: t('phCode'), options: optCode,
          onChange: (e) => { setCode(e.target.value); applyFonts({ code: e.target.value }) },
        }),

        h('div', { style: { marginBottom: 16 } },
          h('div', {
            style: {
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6,
            },
          },
            h('label', { style: fieldLabelStyle },
              t('sizeLabel') + ' ',
              h('span', {
                style: { color: 'var(--dsw-alias-label-secondary)', fontWeight: 400 },
              }, size > 0 ? '+' + size + 'px' : size + 'px'),
            ),
            size !== 0
              ? h('button', {
                  type: 'button',
                  onClick: () => { setSize(0); applyFonts({ size: 0 }) },
                  style: btnStyle,
                }, t('zero'))
              : null,
          ),
          h('input', {
            type: 'range', min: -4, max: 8, step: 1, value: size,
            onChange: (e) => {
              const v = clampSize(e.target.value)
              setSize(v)
              applyFonts({ size: v })
            },
            style: { width: '100%' },
          }),
          h('p', {
            style: {
              margin: '8px 0 0', fontSize: 12, lineHeight: 1.6,
              color: 'var(--dsw-alias-label-secondary)',
            },
          }, t('note')),
        ),

        h('div', {
          style: {
            marginTop: 4, padding: '14px 16px', borderRadius: 10,
            border: '1px solid var(--dsw-alias-border-l1)',
            background: 'var(--dsw-alias-bg-layer-1)',
            fontSize: 15, lineHeight: 1.8, color: 'var(--dsw-alias-label-primary)',
            fontFamily: uiStack || 'inherit',
          },
        },
          t('previewLatin'), h('br', null), t('previewCjk'),
        ),
        h('div', {
          style: {
            marginTop: 8, padding: '10px 16px', borderRadius: 10,
            border: '1px solid var(--dsw-alias-border-l1)',
            background: 'var(--dsw-alias-bg-layer-1)',
            fontSize: 13, lineHeight: 1.8, color: 'var(--dsw-alias-label-secondary)',
          },
        },
          h('code', {
            style: {
              fontFamily: codeQ || 'inherit',
              color: 'var(--dsw-alias-label-primary)',
              background: 'var(--dsw-alias-bg-layer-2)',
              padding: '2px 6px', borderRadius: 4,
            },
          }, codeQ ? t('codeSample') : t('codeSampleEmpty')),
        ),

        h('button', {
          type: 'button', onClick: onReset,
          style: Object.assign({}, btnStyle, { marginTop: 16, padding: '8px 16px', fontSize: 13 }),
        }, t('reset')),
      )
    }

    // ---- lifecycle ------------------------------------------------------
    function apply(ctx) {
      const slots = ctx.slots || (ctx.get && ctx.get('slots'))
      if (!slots) return

      // i18n: register the namespace when possible, then follow locale
      // changes. All of this is optional — t() uses the bundled dictionary.
      const locale = ctx.get ? ctx.get('locale') : undefined
      if (locale && typeof locale.register === 'function') {
        try {
          locale.register('dsh-custom-fonts', {
            en: I18N.en, zh: I18N.zh, 'zh-CN': I18N.zh,
          })
        } catch (_) { /* namespace registration is best-effort */ }
      }
      setLang(detectLang(locale))
      let offLocale
      if (locale && typeof locale.subscribe === 'function') {
        try { offLocale = locale.subscribe(() => setLang(detectLang(locale))) } catch (_) {}
      }

      // Fonts: restore the cached list, then do a silent permission-free probe
      // at boot. queryLocalFonts() is left to the explicit Scan button.
      const cached = loadFontCache()
      if (cached && Array.isArray(cached.list)) {
        fontState.installed = cached.list.slice(0, 800)
        fontState.source = 'cache'
        fontState.scannedAt = cached.at || 0
      }
      const probed = detectFonts(mergeOptions(EN_FONTS, ZH_FONTS, CODE_FONTS, COMMON_FONTS))
      if (probed.length > 0) {
        setInstalled(mergeOptions(fontState.installed, probed), 'auto')
      }

      // P0: hydrate from localStorage and replay the stylesheet at boot,
      // before the Settings page is ever opened.
      Object.assign(state, loadSettings())
      applyFonts()

      ctx.effect(() => () => {
        if (styleTag !== null) {
          try { styleTag.remove() } catch (_) {}
          styleTag = null
        }
        if (typeof offLocale === 'function') {
          try { offLocale() } catch (_) {}
        }
      })

      slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: SLOT_ID, order: 25, label: () => t('title') },
        FontPage,
      ))
    }

    const surface = { name: 'dsh-custom-fonts', inject: ['slots'], apply }
    // Non-enumerable test hook for scripts/verify.mjs; Cordis only reads
    // name / inject / apply, so this stays invisible to the runtime.
    Object.defineProperty(surface, '__internals', {
      value: {
        quoteList, buildCss, clampSize, mergeOptions, detectLang, t, setLang,
        loadSettings, saveSettings, loadFontCache, scanFonts, applyFonts,
        I18N, DEFAULT, SETTINGS_KEY, FONTS_KEY, SLOT_ID, EN_FONTS, ZH_FONTS,
        CODE_FONTS, COMMON_FONTS, getState: () => ({ ...state }),
      },
      enumerable: false,
    })
    return surface
  },
})
