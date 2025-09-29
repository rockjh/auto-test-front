import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { chromium, firefox, webkit } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

const server = new McpServer({
  name: 'playwright-mcp',
  version: '0.1.0'
})

const browserLaunchers = {
  chromium,
  firefox,
  webkit
}

let browser = null
let context = null
let page = null
let currentBrowserName = null

const textResult = (text) => ({
  content: [
    {
      type: 'text',
      text
    }
  ]
})

const ensurePage = () => {
  if (!page) {
    throw new Error('No active page found. Call playwright_launch first.')
  }
  return page
}

const closeBrowser = async () => {
  if (browser) {
    await browser.close()
  }
  browser = null
  context = null
  page = null
  currentBrowserName = null
}

server.registerTool(
  'playwright_launch',
  {
    title: 'Launch a Playwright browser',
    description: 'Starts a headless (by default) Playwright browser session and optionally opens a URL.',
    inputSchema: {
      browser: z
        .enum(['chromium', 'firefox', 'webkit'])
        .describe('Underlying browser engine to launch (chromium by default)')
        .optional(),
      headless: z.boolean().describe('Whether to run in headless mode (default true)').optional(),
      baseUrl: z
        .string()
        .url()
        .describe('Optional URL to open immediately after launching the browser')
        .optional(),
      locale: z
        .string()
        .describe('Optional locale to apply when creating a new browser context, e.g. zh-CN')
        .optional(),
      viewportWidth: z.number().describe('Optional viewport width in pixels').optional(),
      viewportHeight: z.number().describe('Optional viewport height in pixels').optional()
    }
  },
  async ({ browser: browserName, headless, baseUrl, locale, viewportHeight, viewportWidth }) => {
    const launcherName = browserName ?? 'chromium'
    const launcher = browserLaunchers[launcherName]
    if (!launcher) {
      throw new Error(`Unsupported browser: ${launcherName}`)
    }

    await closeBrowser()

    browser = await launcher.launch({
      headless: headless ?? true
    })
    context = await browser.newContext({
      locale: locale ?? 'en-US',
      viewport:
        viewportWidth && viewportHeight
          ? { width: viewportWidth, height: viewportHeight }
          : undefined
    })
    page = await context.newPage()
    currentBrowserName = launcherName

    if (baseUrl) {
      await page.goto(baseUrl)
    }

    return textResult(
      `Launched ${launcherName} browser in ${headless ?? true ? 'headless' : 'headed'} mode${
        baseUrl ? ` and opened ${baseUrl}` : ''
      }.`
    )
  }
)

server.registerTool(
  'playwright_goto',
  {
    title: 'Navigate to URL',
    description: 'Navigates the active page to a given URL.',
    inputSchema: {
      url: z.string().url().describe('Destination URL'),
      waitUntil: z
        .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
        .describe('Desired load state to await after navigation')
        .optional(),
      timeout: z
        .number()
        .describe('Timeout in milliseconds before failing the navigation')
        .optional()
    }
  },
  async ({ url, waitUntil, timeout }) => {
    const currentPage = ensurePage()
    await currentPage.goto(url, {
      waitUntil: waitUntil ?? 'load',
      timeout: timeout ?? 30000
    })
    return textResult(`Navigated to ${url}.`)
  }
)

server.registerTool(
  'playwright_click',
  {
    title: 'Click a selector',
    description: 'Clicks an element located by a Playwright selector.',
    inputSchema: {
      selector: z.string().describe('Selector to click (CSS/xpath/text/etc.)'),
      button: z
        .enum(['left', 'right', 'middle'])
        .describe('Mouse button to use when clicking')
        .optional(),
      clickCount: z
        .number()
        .int()
        .positive()
        .describe('Number of times to click')
        .optional(),
      delay: z
        .number()
        .describe('Milliseconds to wait between mousedown and mouseup events')
        .optional(),
      timeout: z
        .number()
        .describe('Timeout in milliseconds for locating the selector before failing')
        .optional()
    }
  },
  async ({ selector, button, clickCount, delay, timeout }) => {
    const currentPage = ensurePage()
    await currentPage.click(selector, {
      button: button ?? 'left',
      clickCount: clickCount ?? 1,
      delay,
      timeout
    })
    return textResult(`Clicked selector ${selector}.`)
  }
)

server.registerTool(
  'playwright_fill',
  {
    title: 'Fill input',
    description: 'Fills a form field located by selector with provided text.',
    inputSchema: {
      selector: z.string().describe('Selector to target input/textarea field'),
      value: z.string().describe('Text value to enter'),
      timeout: z
        .number()
        .describe('Timeout in milliseconds for locating the selector before failing')
        .optional()
    }
  },
  async ({ selector, value, timeout }) => {
    const currentPage = ensurePage()
    await currentPage.fill(selector, value, { timeout })
    return textResult(`Filled selector ${selector} with provided value.`)
  }
)

server.registerTool(
  'playwright_wait_for_selector',
  {
    title: 'Wait for selector state',
    description: 'Waits until the selector reaches the desired state (visible by default).',
    inputSchema: {
      selector: z.string().describe('Selector to observe'),
      state: z
        .enum(['attached', 'detached', 'visible', 'hidden'])
        .describe('Target state to wait for')
        .optional(),
      timeout: z
        .number()
        .describe('Timeout in milliseconds before failing the wait')
        .optional()
    }
  },
  async ({ selector, state, timeout }) => {
    const currentPage = ensurePage()
    await currentPage.waitForSelector(selector, {
      state: state ?? 'visible',
      timeout
    })
    return textResult(`Selector ${selector} reached state ${state ?? 'visible'}.`)
  }
)

server.registerTool(
  'playwright_screenshot',
  {
    title: 'Take screenshot',
    description: 'Captures a screenshot of the current page and optionally saves it to disk.',
    inputSchema: {
      path: z.string().describe('Filesystem path to write the screenshot file to').optional(),
      fullPage: z.boolean().describe('Capture the entire scrollable page').optional(),
      type: z.enum(['png', 'jpeg']).describe('Image type to produce').optional(),
      quality: z
        .number()
        .min(0)
        .max(100)
        .describe('JPEG quality (0-100). Only used when type is jpeg')
        .optional(),
      includeBase64: z
        .boolean()
        .describe('Whether to return the screenshot as base64 content in the tool response')
        .optional()
    }
  },
  async ({ path, fullPage, type, quality, includeBase64 }) => {
    const currentPage = ensurePage()
    const screenshotOptions = {
      fullPage: fullPage ?? false,
      type: type ?? 'png',
      quality: type === 'jpeg' ? quality : undefined
    }
    const buffer = await currentPage.screenshot(screenshotOptions)
    if (path) {
      await writeFile(path, buffer)
    }
    const messageParts = [`Captured ${fullPage ? 'full-page' : 'viewport'} screenshot as ${type ?? 'png'}.`]
    if (path) {
      messageParts.push(`Saved to ${path}.`)
    }
    const content = [
      {
        type: 'text',
        text: messageParts.join(' ')
      }
    ]
    if (includeBase64) {
      content.push({
        type: 'image',
        mimeType: `image/${type ?? 'png'}`,
        data: buffer.toString('base64')
      })
    }
    return { content }
  }
)

server.registerTool(
  'playwright_close',
  {
    title: 'Close browser',
    description: 'Closes the active Playwright browser session.'
  },
  async () => {
    await closeBrowser()
    return textResult('Closed Playwright browser session.')
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[playwright-mcp] Server is ready on stdio')
}

main().catch(async (error) => {
  console.error('[playwright-mcp] Fatal error:', error)
  await closeBrowser()
  process.exit(1)
})

const shutdown = async () => {
  await closeBrowser()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
