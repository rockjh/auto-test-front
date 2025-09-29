import { createHash } from 'node:crypto'
import { access, readdir, readFile, stat } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { js2xml, xml2js, type Element as XmlElement, type Attributes as XmlAttributes } from 'xml-js'
import type { Plugin, ResolvedConfig } from 'vite'
import { normalizePath } from 'vite'

const VIRTUAL_REGISTER_DEPRECATED = 'virtual:svg-icons-register'
const VIRTUAL_REGISTER = 'virtual:svg-icons/register'
const VIRTUAL_NAMES_DEPRECATED = 'virtual:svg-icons-names'
const VIRTUAL_IDS = 'virtual:svg-icons/ids'
const VIRTUAL_REGISTER_URL_DEPRECATED = `/@id/__x00__${VIRTUAL_REGISTER_DEPRECATED}`
const VIRTUAL_REGISTER_URL = `/@id/__x00__${VIRTUAL_REGISTER}`
const VIRTUAL_NAMES_URL_DEPRECATED = `/@id/__x00__${VIRTUAL_NAMES_DEPRECATED}`
const VIRTUAL_IDS_URL = `/@id/__x00__${VIRTUAL_IDS}`
const SVG_DOM_ID = '__svg__icons__dom__'
const XMLNS = 'http://www.w3.org/2000/svg'
const XMLNS_LINK = 'http://www.w3.org/1999/xlink'

interface SvgIconsOptions {
  iconDirs: string[]
  symbolId?: string
  inject?: 'body-first' | 'body-last'
  customDomId?: string
}

interface CacheEntry {
  mtimeMs?: number
  entry: { symbolId: string; symbol: string }
}

interface SvgFileEntry {
  filePath: string
  mtimeMs?: number
}

const REGEXP_SYMBOL_ID = /^[A-Za-z][A-Za-z0-9_-]*$/
const REGEXP_DOM_ID = /^[a-zA-Z_][a-zA-Z0-9_-]*$/

const SPRITE_TEMPLATE = (symbols: string, customDomId: string, inject: 'body-first' | 'body-last') => `if (typeof window !== 'undefined') {
  function load() {
    var body = document.body;
    var el = document.getElementById('${customDomId}');
    if (!el) {
      el = document.createElementNS('${XMLNS}', 'svg');
      el.style.position = 'absolute';
      el.style.width = '0';
      el.style.height = '0';
      el.id = '${customDomId}';
      el.setAttribute('xmlns', '${XMLNS}');
      el.setAttribute('xmlns:link', '${XMLNS_LINK}');
      el.setAttribute('aria-hidden', true);
    }
    el.innerHTML = ${JSON.stringify(symbols)};
    body.insertBefore(el, ${inject === 'body-first' ? 'body.firstChild' : 'null'});
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
}
export default {}`

function validate(options: SvgIconsOptions) {
  if (!options.iconDirs || options.iconDirs.length === 0) {
    throw new Error("[svg-icons-lite]: 'iconDirs' is required")
  }
  if (options.symbolId) {
    if (!options.symbolId.includes('[name]')) {
      throw new Error("[svg-icons-lite]: 'symbolId' must contain [name]")
    }
    const base = options.symbolId.replaceAll(/\[name]/g, '').replaceAll(/\[dir]/g, '')
    if (!REGEXP_SYMBOL_ID.test(base)) {
      throw new Error("[svg-icons-lite]: 'symbolId' must start with a letter and only contain letters, numbers, _ or -")
    }
  }
  if (options.inject && !['body-first', 'body-last'].includes(options.inject)) {
    throw new Error("[svg-icons-lite]: 'inject' must be 'body-first' or 'body-last'")
  }
  if (options.customDomId && !REGEXP_DOM_ID.test(options.customDomId)) {
    throw new Error("[svg-icons-lite]: 'customDomId' must start with a letter/underscore and only contain letters, numbers, _ or -")
  }
}

function mergeOptions(user?: SvgIconsOptions) {
  return {
    iconDirs: user?.iconDirs ?? [],
    symbolId: user?.symbolId ?? 'icon-[dir]-[name]',
    inject: user?.inject ?? 'body-last',
    customDomId: user?.customDomId ?? SVG_DOM_ID
  }
}

export function createSvgIconsLite(userOptions: SvgIconsOptions): Plugin {
  validate(userOptions)
  const options = mergeOptions(userOptions)
  const cache = new Map<string, CacheEntry>()
  let isBuild = false

  return {
    name: 'vite:svg-icons-lite',
    configResolved(resolved: ResolvedConfig) {
      isBuild = resolved.command === 'build'
    },
    resolveId(id) {
      return [VIRTUAL_REGISTER_DEPRECATED, VIRTUAL_NAMES_DEPRECATED, VIRTUAL_REGISTER, VIRTUAL_IDS].includes(id)
        ? `\0${id}`
        : null
    },
    async load(id, ssr) {
      const isVirtualRegister = id === `\0${VIRTUAL_REGISTER_DEPRECATED}` || id === `\0${VIRTUAL_REGISTER}`
      const isVirtualNames = id === `\0${VIRTUAL_NAMES_DEPRECATED}` || id === `\0${VIRTUAL_IDS}`
      if (!isBuild && !ssr && (isVirtualRegister || isVirtualNames)) {
        return null
      }
      if (isVirtualRegister) {
        return createSpriteModule(cache, options)
      }
      if (isVirtualNames) {
        return createIdsModule(cache, options)
      }
      return null
    },
    configureServer({ middlewares }) {
      middlewares.use(async (req, res, next) => {
        const url = normalizePath(req.url || '')
        const isRegister = url.endsWith(VIRTUAL_REGISTER_URL_DEPRECATED) || url.endsWith(VIRTUAL_REGISTER_URL)
        const isNames = url.endsWith(VIRTUAL_NAMES_URL_DEPRECATED) || url.endsWith(VIRTUAL_IDS_URL)
        if (!isRegister && !isNames) {
          return next()
        }
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/javascript')
        res.setHeader('Cache-Control', 'no-cache')
        let content = ''
        if (isRegister) {
          content = await createSpriteModule(cache, options)
        } else if (isNames) {
          content = await createIdsModule(cache, options)
        }
        res.setHeader('Etag', getWeakETag(content))
        res.statusCode = 200
        res.end(content)
      })
    }
  }
}

async function createIdsModule(cache: Map<string, CacheEntry>, options: ReturnType<typeof mergeOptions>) {
  const list = await compileIcons(cache, options)
  return `export default ${JSON.stringify(list.map((item) => item.symbolId))}`
}

async function createSpriteModule(cache: Map<string, CacheEntry>, options: ReturnType<typeof mergeOptions>) {
  const list = await compileIcons(cache, options)
  const symbols = list.map((item) => item.symbol).join('')
  return SPRITE_TEMPLATE(symbols, options.customDomId, options.inject)
}

async function compileIcons(cache: Map<string, CacheEntry>, options: ReturnType<typeof mergeOptions>) {
  const results = await Promise.all(
    options.iconDirs.map(async (dir) => {
      const files = await collectSvgFiles(dir)
      const compiled = await Promise.all(files.map((file) => processIconEntry(file, cache, dir, options)))
      return compiled.filter((entry): entry is { symbolId: string; symbol: string } => Boolean(entry))
    })
  )
  return results.flat()
}

async function processIconEntry(file: SvgFileEntry, cache: Map<string, CacheEntry>, dir: string, options: ReturnType<typeof mergeOptions>) {
  const { filePath, mtimeMs } = file
  const cached = cache.get(filePath)
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.entry
  }
  try {
    const normalized = normalizePath(filePath)
    const relativePath = normalized.replace(normalizePath(`${dir}/`), '')
    const symbolId = generateSymbolId(relativePath, options)
    const content = await readFile(filePath, 'utf-8')
    const symbol = convertSvgToSymbol(symbolId, sanitizeSvg(content))
    const entry = { symbolId, symbol }
    cache.set(filePath, { mtimeMs, entry })
    return entry
  } catch (error) {
    console.warn(`[svg-icons-lite]: failed to process ${filePath}`, error)
    return null
  }
}

async function collectSvgFiles(dir: string): Promise<SvgFileEntry[]> {
  const result: SvgFileEntry[] = []
  if (!(await pathExists(dir))) {
    return result
  }
  const walk = async (current: string) => {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
        try {
          const stats = await stat(fullPath)
          result.push({ filePath: fullPath, mtimeMs: stats.mtimeMs })
        } catch (error) {
          console.warn(`[svg-icons-lite]: failed to read stats for ${fullPath}`, error)
        }
      }
    }
  }
  try {
    await walk(dir)
  } catch (error) {
    console.warn(`[svg-icons-lite]: failed to scan directory ${dir}`, error)
  }
  return result
}

async function pathExists(path: string) {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

function sanitizeSvg(svg: string) {
  return svg.replace(/stroke="[a-zA-Z#0-9]*"/, 'stroke="currentColor"')
}

function generateSymbolId(relativePath: string, options: ReturnType<typeof mergeOptions>) {
  const { symbolId } = options
  const { dirName, baseName } = parseDirName(relativePath)
  const id = symbolId.replace(/\[dir]/g, dirName).replace(/\[name]/g, baseName)
  return id.replace(/-+/g, '-').replace(/(^-|-$)/g, '')
}

function parseDirName(name: string) {
  let dirName = ''
  let baseName = name
  const last = name.lastIndexOf('/')
  if (last !== -1) {
    dirName = name.slice(0, last).split('/').filter(Boolean).join('-')
    baseName = name.slice(last + 1)
  }
  return {
    dirName,
    baseName: basename(baseName, extname(baseName))
  }
}

function getWeakETag(source: string) {
  if (source.length === 0) {
    return '"W/0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"'
  }
  const size = Buffer.byteLength(source, 'utf8')
  const hash = createHash('sha1').update(source, 'utf8').digest('base64').slice(0, 27)
  return `W/${size}-${hash}`
}

function convertSvgToSymbol(id: string, content: string) {
  const parsed = xml2js(content, { compact: false }) as XmlElement
  const svg = findSvgElement(parsed)
  if (!svg) {
    throw new Error('[svg-icons-lite]: invalid SVG content, missing <svg> element')
  }
  ensureElement(svg)
  removeUselessAttrs(svg)
  unifySizeToViewBox(svg)
  prefixInternalId(svg, id)
  svg.name = 'symbol'
  svg.attributes = {
    ...(svg.attributes ?? {}),
    id
  }
  return js2xml({ elements: [svg] }, { compact: false })
}

function findSvgElement(element: XmlElement | undefined): XmlElement | undefined {
  if (!element) {
    return undefined
  }
  if (element.type === 'element' && element.name === 'svg') {
    return element
  }
  if (!element.elements) {
    return undefined
  }
  for (const child of element.elements) {
    const found = findSvgElement(child)
    if (found) {
      return found
    }
  }
  return undefined
}

function ensureElement(element: XmlElement) {
  element.type = 'element'
  if (!element.elements) {
    element.elements = []
  }
  if (!element.attributes) {
    element.attributes = {}
  }
}

function removeUselessAttrs(svg: XmlElement) {
  if (!svg.attributes) return
  delete svg.attributes.xmlns
  delete svg.attributes['xmlns:xlink']
  delete svg.attributes.class
  delete svg.attributes.style
  delete svg.attributes.role
  delete svg.attributes['aria-hidden']
}

function unifySizeToViewBox(svg: XmlElement) {
  if (!svg.attributes) {
    svg.attributes = {}
  }
  const attrs = svg.attributes
  if (!attrs.viewBox && attrs.width != null && attrs.height != null) {
    const width = parseFloat(String(attrs.width))
    const height = parseFloat(String(attrs.height))
    if (!Number.isNaN(width) && !Number.isNaN(height)) {
      attrs.viewBox = `0 0 ${width} ${height}`
    }
  }
  delete attrs.width
  delete attrs.height
}

function prefixInternalId(svg: XmlElement, id: string) {
  const idMap = new Map<string, string>()
  traverseElements(svg, (node) => {
    if (node.name === 'defs' && node.elements) {
      for (const child of node.elements) {
        if (child.type !== 'element') continue
        if (!child.attributes) continue
        const oldId = child.attributes.id
        if (!oldId) continue
        const oldIdStr = String(oldId)
        const newId = `${id}_${oldIdStr}`
        child.attributes.id = newId
        idMap.set(oldIdStr, newId)
        delete child.attributes.maskUnits
        delete child.attributes.patternUnits
        delete child.attributes.gradientUnits
        delete child.attributes.clipPathUnits
        delete child.attributes.markerUnits
        delete child.attributes.filterUnits
      }
    }
  })

  if (idMap.size === 0) return

  const updateAttributes = (attributes?: XmlAttributes) => {
    if (!attributes) return
    for (const [attrName, attrValue] of Object.entries(attributes)) {
      if (attrValue === undefined || attrValue === null) continue
      const value = String(attrValue)
      if ((attrName === 'xlink:href' || attrName === 'href') && value.startsWith('#')) {
        const refId = value.slice(1)
        if (idMap.has(refId)) {
          const target = `#${idMap.get(refId)}`
          attributes[attrName] = target
        }
      }
      if (value.includes('url(#')) {
        attributes[attrName] = value.replace(/url\(#(.*?)\)/g, (match, refId) => {
          if (idMap.has(refId)) {
            return `url(#${idMap.get(refId)})`
          }
          return match
        })
      }
    }
  }

  updateAttributes(svg.attributes)
  traverseElements(svg, (node) => {
    updateAttributes(node.attributes)
  })
}

function traverseElements(element: XmlElement, callback: (node: XmlElement) => void) {
  if (!element.elements) return
  for (const child of element.elements) {
    if (child.type === 'element') {
      callback(child)
      traverseElements(child, callback)
    }
  }
}

export type { SvgIconsOptions }
