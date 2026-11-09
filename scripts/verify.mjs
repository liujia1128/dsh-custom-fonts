/**
 * dsh-custom-fonts — zero-dependency verification.
 *
 * Node's vm runs the Client bundle against a stubbed runtime, so all checks
 * work headlessly (no browser, no bundler, no npm install). The Client bundle
 * exposes a non-enumerable `__internals` hook purely for these assertions;
 * Cordis only reads `name` / `inject` / `apply`.
 *
 * Run: node scripts/verify.mjs   (or: npm run verify)
 */
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (p) => readFileSync(join(root, p), 'utf8')
const exists = (p) => {
  try { statSync(join(root, p)); return true } catch (_) { return false }
}

const failures = []
async function check(name, fn) {
  try {
    await fn()
    console.log('ok   ' + name)
  } catch (e) {
    failures.push(name)
    const msg = e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : String(e)
    console.error('FAIL ' + name + '\n     ' + msg)
  }
}

// ---- stubbed runtime ----------------------------------------------------
function makeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    _map: map,
  }
}

function makeDocument() {
  const tags = []
  return {
    head: { appendChild: (tag) => { tags.push(tag); return tag } },
    createElement(tagName) {
      if (tagName === 'canvas') return { getContext: () => null }
      return {
        tagName, attrs: {}, textContent: '', removed: false,
        setAttribute(k, v) { this.attrs[k] = v },
        remove() { this.removed = true },
      }
    },
    tags,
  }
}

// A React-ish stub whose createElement produces an inspectable element tree.
function makeReact() {
  let hookIndex = 0
  const hooks = []
  function createElement(type, props, ...children) {
    return { type, props: props || {}, children }
  }
  function useState(initial) {
    const i = hookIndex++
    if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial
    return [hooks[i], (v) => { hooks[i] = typeof v === 'function' ? v(hooks[i]) : v }]
  }
  function useEffect(fn) { if (typeof fn === 'function') fn() }
  function render(Component) {
    hookIndex = 0
    hooks.length = 0
    return Component()
  }
  return { createElement, useState, useEffect, render }
}

// Expand functional components + nested child arrays into a flat node list.
function flatten(node, out) {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (Array.isArray(node)) { node.forEach((n) => flatten(n, out)); return out }
  if (typeof node !== 'object') { out.push(node); return out }
  if (typeof node.type === 'function') {
    flatten(node.type(node.props), out)
    return out
  }
  out.push(node)
  node.children.forEach((c) => flatten(c, out))
  return out
}
function datalists(tree) {
  return flatten(tree, []).filter((n) => n && typeof n === 'object' && n.type === 'datalist')
}
function optionsOf(datalist) {
  return flatten(datalist, [])
    .filter((n) => n && typeof n === 'object' && n.type === 'option')
    .map((n) => n.props && n.props.value)
}

const storage = makeStorage()
const document = makeDocument()
const React = makeReact()
const loadCalls = []
let queryLocalFontsImpl = null
const window = {
  __ModuleLoader__: { load(opts) { loadCalls.push(opts) } },
  queryLocalFonts(...args) {
    return queryLocalFontsImpl ? queryLocalFontsImpl(...args) : Promise.resolve([])
  },
}
const sandbox = {
  window,
  document,
  localStorage: storage,
  navigator: { language: 'en-US' },
  console: { log() {}, error() {}, warn() {} },
}
vm.createContext(sandbox)
vm.runInContext(read('client/client.js'), sandbox, { filename: 'client/client.js' })

const loaderOpts = loadCalls[0]
const factory = loaderOpts && loaderOpts.factory
const requireStub = (name) => {
  if (name === 'react') return React
  throw new Error('unexpected runtime require: ' + name)
}

function makeCtx() {
  const registered = []
  const injected = []
  const localeRegistered = []
  let effectFn
  const locale = {
    getLocale: () => ({ id: 'zh-CN' }),
    getSnapshot: () => ({ id: 'zh-CN' }),
    register: (...a) => { localeRegistered.push(a); return () => {} },
    subscribe: () => () => {},
  }
  const slots = {
    inject: (key, cb) => { injected.push({ key, cb }); if (typeof cb === 'function') cb(); return () => {} },
    register: (opts, component) => { registered.push({ opts, component }); return () => {} },
  }
  const ctx = {
    slots,
    get: (name) => (name === 'locale' ? locale : (name === 'slots' ? slots : undefined)),
    effect: (fn) => { effectFn = fn; return () => {} },
  }
  return { ctx, registered, injected, localeRegistered, getEffect: () => effectFn }
}

let s1, c1, I1

await check('host half imports and exposes { name, apply }', async () => {
  const mod = await import(pathToFileURL(join(root, 'lib/index.js')).href)
  assert.equal(mod.name, 'dsh-custom-fonts')
  assert.equal(typeof mod.apply, 'function')
  mod.apply()
})

await check('client half registers through __ModuleLoader__', () => {
  assert(loaderOpts, 'window.__ModuleLoader__.load was never called')
  assert.equal(loaderOpts.id, 'dsh-custom-fonts')
  assert.equal(typeof factory, 'function')
})

await check('surface shape + non-enumerable test hook', () => {
  s1 = factory(requireStub)
  assert.equal(s1.name, 'dsh-custom-fonts')
  assert.deepEqual([...s1.inject], ['slots'])
  assert.equal(typeof s1.apply, 'function')
  assert(!Object.keys(s1).includes('__internals'), '__internals must stay invisible')
  I1 = s1.__internals
  assert.equal(typeof I1.buildCss, 'function')
  assert.equal(typeof I1.scanFonts, 'function')
  assert.equal(I1.SLOT_ID, 'dsh-custom-fonts')
})

await check('apply() registers the settings slot, locale namespace and cleanup', () => {
  storage.clear()
  document.tags.length = 0
  c1 = makeCtx()
  s1.apply(c1.ctx)
  assert.equal(c1.injected[0].key, 'settings.section')
  const reg = c1.registered[0]
  assert.equal(reg.opts.name, 'settings.section')
  assert.equal(reg.opts.id, 'dsh-custom-fonts')
  assert.equal(typeof reg.opts.label(), 'string')
  assert.equal(typeof reg.component, 'function', 'register 2nd arg must be the component, not a thunk')
  assert.equal(typeof c1.getEffect()(), 'function', 'ctx.effect callback must return a cleanup')
  assert.equal(c1.localeRegistered[0][0], 'dsh-custom-fonts')
  const dicts = c1.localeRegistered[0][1]
  assert(dicts.en && dicts.zh && dicts['zh-CN'], 'en/zh/zh-CN dictionaries must be registered')
  assert.equal(document.tags.length, 0, 'defaults must not inject a stylesheet')
})

await check('P0 — boot replays persisted settings into state AND the stylesheet', () => {
  storage.clear()
  document.tags.length = 0
  storage.setItem(I1.SETTINGS_KEY, JSON.stringify({
    en: 'Arial', zh: '微软雅黑', code: 'Consolas', size: 2,
  }))
  const s2 = factory(requireStub) // fresh factory = fresh closure = a page reload
  const c2 = makeCtx()
  s2.apply(c2.ctx)
  const I2 = s2.__internals
  assert.deepEqual({ ...I2.getState() }, { en: 'Arial', zh: '微软雅黑', code: 'Consolas', size: 2 })
  const tag = document.tags[document.tags.length - 1]
  assert(tag, 'apply() must inject the stylesheet at boot, before Settings is opened')
  assert.equal(tag.attrs['data-dsh-custom-fonts'], '')
  assert(tag.textContent.includes("'Arial'"))
  assert(tag.textContent.includes('calc(100% + 2px)'))
  assert.equal(document.tags.length, 1)

  const css2 = I2.applyFonts({ size: -3 })
  assert(css2.includes('calc(100% - 3px)'))
  assert.equal(JSON.parse(storage.getItem(I1.SETTINGS_KEY)).size, -3, 'edits must persist')
  assert.equal(document.tags.length, 2, 'stylesheet must be replaced, not duplicated')
  assert.equal(document.tags[0].removed, true)

  assert.equal(I2.applyFonts({ en: '', zh: '', code: '', size: 0 }), null)
  assert.equal(JSON.parse(storage.getItem(I1.SETTINGS_KEY)).size, 0)
  assert.equal(document.tags[1].removed, true, 'reset must drop the stylesheet')
  c2.getEffect()()() // cleanup must not throw with an empty stylesheet
})

await check('P1-1 — buildCss uses ONE flat :root rule, no calc(1em) cascade', () => {
  const css = I1.buildCss({ en: 'Segoe UI', zh: '微软雅黑', code: 'Consolas', size: 2 })
  assert.equal(css,
    "body, body * { font-family: 'Segoe UI', '微软雅黑' !important; }\n" +
    "pre, code, kbd, samp { font-family: 'Consolas' !important; }\n" +
    ':root { font-size: calc(100% + 2px) !important; }')
  assert(!css.includes('calc(1em'), 'the compounding 1em rule must be gone')
  assert(!css.includes('body, body * { font-size'), 'no per-element font-size !important')
  assert(!css.includes('--dsh-custom-fonts-'), 'dead :root vars must be gone')
  const neg = I1.buildCss({ size: -3 })
  assert(neg.includes(':root { font-size: calc(100% - 3px) !important; }'))
  const noSize = I1.buildCss({ en: 'Arial', size: 0 })
  assert(noSize && !noSize.includes('font-size'), 'size 0 must emit no font-size rule')
  assert.equal(I1.buildCss({ ...I1.DEFAULT }), null)
})

await check('quoteList escapes real installed-family names (CSS injection guard)', () => {
  assert.equal(I1.quoteList("Arial, 'Microsoft YaHei', 宋体"), "'Arial', 'Microsoft YaHei', '宋体'")
  const evil = I1.quoteList("A'); color:red; } /* x */, B\\C")
  assert(evil.startsWith("'"), 'every item must be single-quoted')
  assert(!evil.includes(';') && !evil.includes('}') && !evil.includes('{'))
  assert(!evil.includes('/*') && !evil.includes('*/'))
  assert(evil.includes('\\\\'), 'backslash must be doubled')
  assert.equal(I1.quoteList(''), '')
  assert.equal(I1.quoteList('   ,  , '), '')
})

await check('clampSize bounds the offset to -4..+8', () => {
  assert.equal(I1.clampSize(2), 2)
  assert.equal(I1.clampSize(99), 8)
  assert.equal(I1.clampSize(-99), -4)
  assert.equal(I1.clampSize('3.6'), 4)
  assert.equal(I1.clampSize(undefined), 0)
  assert.equal(I1.clampSize(NaN), 0)
})

await check('P1-2 — manifest exports display metadata, locales and icon', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.version, '1.2.0')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.dsh.client.immediately, true, 'P0 boot replay needs immediately: true')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.exports['./locale/*.json'], './locale/*.json')
  assert.equal(pkg.exports['./icon'], './icon.svg')
  assert.equal(pkg.exports['./client'], './client/client.js')
  assert.equal(pkg.scripts.verify, 'node scripts/verify.mjs')
  for (const p of [
    'lib', 'client', 'scripts/verify.mjs', 'locale/*.json', 'icon.svg',
    'cordis.patch.yml', 'README.md', 'README.zh-CN.md', 'INSTALL.md',
    'INSTALL.zh-CN.md', 'CHANGELOG.md', 'PUBLISHING.md', 'LICENSE',
  ]) assert(pkg.files.includes(p), 'files[] missing ' + p)
  for (const p of [
    'client/client.js', 'lib/index.js', 'cordis.patch.yml', 'locale/en.json',
    'locale/zh.json', 'locale/zh-CN.json', 'icon.svg', 'scripts/verify.mjs',
    'README.md', 'README.zh-CN.md', 'INSTALL.md', 'INSTALL.zh-CN.md',
    'CHANGELOG.md', 'PUBLISHING.md', 'LICENSE',
  ]) assert(exists(p), 'artifact missing: ' + p)
  for (const p of ['locale/en.json', 'locale/zh.json', 'locale/zh-CN.json']) {
    const j = JSON.parse(read(p))
    assert(j.meta && typeof j.meta.title === 'string' && j.meta.title.length, p + ' needs meta.title')
    assert(j.meta && typeof j.meta.description === 'string' && j.meta.description.length, p + ' needs meta.description')
  }
  const svg = read('icon.svg')
  assert(svg.includes('<svg') && svg.includes('</svg>'))
  assert(Buffer.byteLength(svg) < 256 * 1024, 'icon must stay below 256 KiB')
  // The xmlns="http://www.w3.org/2000/svg" namespace is required, not an
  // external fetch. Only reject real resource references.
  assert(!/(?:xlink:)?href\s*=\s*["']https?:|<image\b|url\(\s*["']?https?:/i.test(svg),
    'icon must not reference external resources')
})

await check('P1-3 — bilingual dictionary, interpolation, locale detection', () => {
  I1.setLang('zh')
  assert.equal(I1.t('title'), '字体')
  assert.equal(I1.t('reset'), '恢复默认')
  I1.setLang('en')
  assert.equal(I1.t('title'), 'Fonts')
  assert.equal(I1.t('reset'), 'Restore defaults')
  assert(I1.t('scanDone', { n: 7 }).includes('7'), '{n} interpolation must work')
  assert.equal(I1.detectLang({ getLocale: () => ({ id: 'zh-CN' }) }), 'zh')
  assert.equal(I1.detectLang({ getSnapshot: () => ({ language: 'en-US' }) }), 'en')
  assert.equal(I1.detectLang({ getLocale: () => 'zh-Hans' }), 'zh')
  assert.equal(I1.detectLang(null), 'en')
  assert.equal(typeof I1.I18N.en.title, 'string')
  assert.equal(typeof I1.I18N.zh.title, 'string')
  assert.equal(Object.keys(I1.I18N.en).length, Object.keys(I1.I18N.zh).length, 'en/zh keys must match')
})

await check('installed fonts — queryLocalFonts, dedupe, sort and cached list', async () => {
  storage.clear()
  document.tags.length = 0
  queryLocalFontsImpl = () => Promise.resolve([
    { family: 'Fira Code' }, { family: '微软雅黑' },
    { family: 'Fira Code' }, { family: '实验室字体' },
  ])
  const s3 = factory(requireStub)
  s3.apply(makeCtx().ctx)
  const I3 = s3.__internals
  const r = await I3.scanFonts()
  assert.equal(r.source, 'os')
  assert.equal(r.count, 3, 'duplicate families must collapse')
  const cached = I3.loadFontCache()
  assert(cached && Array.isArray(cached.list), 'scan must write the font cache')
  assert.equal(cached.source, 'os')
  assert(cached.list.includes('Fira Code'))
  assert(cached.list.includes('实验室字体'))
  assert.equal(new Set(cached.list.map((x) => x.toLowerCase())).size, cached.list.length)
  assert.deepEqual([...I3.mergeOptions(['b', 'A', 'a'], ['a', 'C'])], ['A', 'b', 'C'])
  // A fresh factory replays the cache at boot with no new scan.
  const s4 = factory(requireStub)
  s4.apply(makeCtx().ctx)
  assert.equal(s4.__internals.loadFontCache().list.includes('实验室字体'), true)
  queryLocalFontsImpl = null
})

await check('installed fonts appear in every field\'s <datalist> options', () => {
  const s5 = factory(requireStub)
  const c5 = makeCtx()
  s5.__internals.setLang('zh')
  // Seed the same cache the boot path reads, then open the page.
  storage.setItem(s5.__internals.FONTS_KEY, JSON.stringify({
    list: ['Fira Code', '实验室字体', '微软雅黑'], source: 'os', at: 1,
  }))
  s5.apply(c5.ctx)
  const FontPage = c5.registered[0].component
  const lists = datalists(React.render(FontPage))
  assert.equal(lists.length, 3, 'one datalist per font field')
  const ids = lists.map((d) => d.props && d.props.id)
  assert.equal(new Set(ids).size, 3, 'datalist ids must be unique')
  // Installed fonts must be offered in EVERY field, not just one.
  for (const dl of lists) {
    const values = optionsOf(dl)
    for (const name of ['Fira Code', '实验室字体', '微软雅黑']) {
      assert(values.includes(name), 'installed font missing from ' + dl.props.id + ': ' + name)
    }
    assert.equal(new Set(values).size, values.length, 'duplicate option in ' + dl.props.id)
  }
  const allValues = lists.flatMap(optionsOf)
  for (const name of ['Segoe UI', 'Consolas', '宋体']) {
    assert(allValues.includes(name), 'built-in suggestion must remain: ' + name)
  }
})

await check('霞鹜文楷 / LXGW WenKai is offered in the Chinese UI font field', () => {
  const families = [
    '霞鹜文楷', 'LXGW WenKai', '霞鹜文楷 屏幕阅读版',
    'LXGW WenKai Screen', 'LXGW WenKai Lite', 'LXGW WenKai TC',
  ]
  const mono = ['霞鹜文楷等宽', 'LXGW WenKai Mono', 'LXGWWenKaiMono Nerd Font']
  assert.deepEqual([...I1.LXGW_WENKAI], families)
  assert.deepEqual([...I1.LXGW_WENKAI_MONO], mono)
  families.forEach((n) => assert(I1.ZH_FONTS.includes(n), 'ZH_FONTS missing ' + n))
  mono.forEach((n) => assert(I1.CODE_FONTS.includes(n), 'CODE_FONTS missing ' + n))

  // The Chinese field really renders these names as selectable options.
  const s6 = factory(requireStub)
  const c6 = makeCtx()
  s6.apply(c6.ctx)
  const lists = datalists(React.render(c6.registered[0].component))
  const zh = lists.find((d) => d.props && d.props.id === I1.SLOT_ID + '-zh-list')
  assert(zh, 'Chinese font datalist not found')
  const values = optionsOf(zh)
  families.forEach((n) => assert(values.includes(n), 'Chinese datalist missing ' + n))
  const code = lists.find((d) => d.props && d.props.id === I1.SLOT_ID + '-code-list')
  assert(code, 'Code font datalist not found')
  mono.forEach((n) => assert(optionsOf(code).includes(n), 'Code datalist missing ' + n))

  // Names with spaces / CJK survive CSS quoting and reach the generated rule.
  assert.equal(I1.quoteList('霞鹜文楷, LXGW WenKai'), "'霞鹜文楷', 'LXGW WenKai'")
  assert(I1.buildCss({ zh: '霞鹜文楷' }).includes("'霞鹜文楷' !important"))
  // Placeholders advertise the new font in both languages + locale files.
  I1.setLang('zh')
  assert(I1.t('phZh').includes('霞鹜文楷'))
  I1.setLang('en')
  assert(I1.t('phZh').includes('LXGW WenKai'))
  for (const p of ['locale/en.json', 'locale/zh.json', 'locale/zh-CN.json']) {
    assert(/LXGW WenKai|霞鹜文楷/.test(read(p)), p + ' must advertise the new font')
  }
  for (const p of ['README.md', 'README.zh-CN.md', 'INSTALL.md', 'INSTALL.zh-CN.md']) {
    assert(/LXGW WenKai|霞鹜文楷/.test(read(p)), p + ' must document the new font')
  }
})

await check('styles use only --dsw-alias-* tokens; no extra runtime requires', () => {
  const src = read('client/client.js')
  const vars = [...src.matchAll(/var\((--[^)]+)\)/g)].map((m) => m[1])
  assert(vars.length >= 5, 'expected theme tokens in inline styles')
  vars.forEach((v) => assert(v.startsWith('--dsw-alias-'), 'non-theme token: ' + v))
  const reqs = [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1])
  assert.deepEqual(reqs, ['react'], 'the bundle must depend on react only')
  assert(!src.includes('document.body'), 'must not write to document.body')
})

await check('release 1.2.0 metadata points at the liujia1128 repository everywhere', () => {
  const pkg = JSON.parse(read('package.json'))
  const repo = 'https://github.com/liujia1128/dsh-custom-fonts'
  assert.equal(pkg.version, '1.2.0')
  assert.equal(pkg.repository.type, 'git')
  assert.equal(pkg.repository.url, 'git+' + repo + '.git')
  assert.equal(pkg.homepage, repo)
  assert.equal(pkg.bugs.url, repo + '/issues')
  for (const p of ['README.md', 'README.zh-CN.md', 'INSTALL.md', 'INSTALL.zh-CN.md', 'PUBLISHING.md']) {
    const d = read(p)
    assert(d.includes('1.2.0'), p + ' must state the v1.2.0 version')
    assert(d.includes(repo), p + ' must link the liujia1128 repository')
    assert(!d.includes('lsh2002'), p + ' still references the old repository owner')
  }
  assert(!read('package.json').includes('lsh2002'), 'package.json still references the old repository owner')
})

await check('installation & usage guides cover install, activation, usage and rollback', () => {
  for (const p of ['INSTALL.md', 'INSTALL.zh-CN.md']) {
    const d = read(p)
    assert(d.includes('git clone https://github.com/liujia1128/dsh-custom-fonts.git'), p + ' missing clone command')
    assert(d.includes('cordis.patch.yml'), p + ' missing bundle patch method')
    assert(d.includes('npm pack'), p + ' missing tarball method')
    assert(/dsh-custom-fonts:settings:v1/.test(d) && /dsh-custom-fonts:fonts:v1/.test(d), p + ' missing storage keys')
    assert(/Restore defaults|恢复默认/.test(d), p + ' missing restore-defaults docs')
    assert(/Scan installed fonts|扫描本机字体/.test(d), p + ' missing font-scan docs')
    assert(/Uninstall|卸载/.test(d), p + ' missing uninstall docs')
    assert(d.includes('scripts/verify.mjs'), p + ' missing verification command')
  }
})

await check('docs no longer advertise the broken cascade / stale refresh claim', () => {
  for (const p of ['README.md', 'README.zh-CN.md']) {
    const d = read(p)
    // The shipped ```css example must be the corrected one. A historical
    // "why we changed it" note outside the code fence is allowed.
    const cssBlocks = [...d.matchAll(/```css([\s\S]*?)```/g)].map((m) => m[1]).join('\n')
    assert(cssBlocks.length > 0, p + ' has no css example block')
    assert(!cssBlocks.includes('calc(1em'), p + ' css example still shows calc(1em)')
    assert(!cssBlocks.includes('body, body * { font-size'), p + ' css example still shows per-element font-size')
    assert(cssBlocks.includes(':root { font-size: calc(100%'), p + ' css example must show the :root rule')
    // Prose-level false claims are banned everywhere.
    assert(!d.includes('不会指数级放大'), p + ' still makes the false flatness claim')
    assert(!d.includes('刷新页面即生效，无需重启'), p + ' still claims refresh applies settings')
  }
  assert(read('CHANGELOG.md').includes('1.2.0'))
})

if (failures.length > 0) {
  console.error('\n' + failures.length + ' check(s) failed: ' + failures.join(', '))
  process.exitCode = 1
} else {
  console.log('\nall checks passed')
}
