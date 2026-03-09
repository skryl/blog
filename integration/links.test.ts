import { describe, it, before } from "node:test"
import assert from "node:assert/strict"
import { execSync } from "node:child_process"

/**
 * Integration test: verify no broken links on the site.
 *
 * Usage:
 *   # Against local dev server (default: http://localhost:8080)
 *   BASE_URL=http://localhost:8080 npx tsx --test integration/links.test.ts
 *
 *   # Against production
 *   BASE_URL=https://skryl.github.io/blog npx tsx --test integration/links.test.ts
 */

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "")
const TIMEOUT_MS = 10_000
const CONCURRENCY = 10

/** Minimal response shape returned by both fetch and curl fallback */
interface SimpleResponse {
  ok: boolean
  status: number
  headers: { get(name: string): string | null }
  text(): Promise<string>
}

/** Try native fetch, fall back to curl if fetch is blocked */
async function robustFetch(url: string, timeoutMs = TIMEOUT_MS): Promise<SimpleResponse> {
  try {
    return await nativeFetch(url, timeoutMs)
  } catch {
    return curlFetch(url, timeoutMs)
  }
}

/** Native fetch with timeout */
async function nativeFetch(url: string, timeoutMs: number): Promise<SimpleResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "quartz-integration-test" },
    })
  } finally {
    clearTimeout(timer)
  }
}

/** Curl-based fallback when native fetch is unavailable or blocked */
function curlFetch(url: string, timeoutMs: number): SimpleResponse {
  const timeoutSec = Math.ceil(timeoutMs / 1000)
  let stdout: string
  let statusCode: number

  try {
    // First get the status code and headers
    const headerOut = execSync(
      `curl -s -o /dev/null -w "%{http_code}" -L --max-time ${timeoutSec} ${JSON.stringify(url)}`,
      { encoding: "utf-8", timeout: timeoutMs + 5000 },
    ).trim()
    statusCode = parseInt(headerOut, 10) || 0

    // Then get the body + content-type
    stdout = execSync(
      `curl -s -L --max-time ${timeoutSec} -H "User-Agent: quartz-integration-test" ${JSON.stringify(url)}`,
      { encoding: "utf-8", timeout: timeoutMs + 5000, maxBuffer: 10 * 1024 * 1024 },
    )
  } catch {
    return {
      ok: false,
      status: 0,
      headers: { get: () => null },
      text: async () => "",
    }
  }

  // Get content-type via a separate HEAD request
  let contentType = ""
  try {
    contentType = execSync(
      `curl -s -I -L --max-time ${timeoutSec} ${JSON.stringify(url)} | grep -i "^content-type:" | tail -1`,
      { encoding: "utf-8", timeout: timeoutMs + 5000 },
    )
      .replace(/^content-type:\s*/i, "")
      .trim()
  } catch {
    // ignore
  }

  return {
    ok: statusCode >= 200 && statusCode < 400,
    status: statusCode,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
    text: async () => stdout,
  }
}

/** Extract all href values from an HTML string */
function extractLinks(html: string, pageUrl: string): string[] {
  const links: string[] = []
  // Match the tag context around each href to filter out non-navigable links
  const hrefRegex = /(<[^>]*?)href=["']([^"']+)["']/g
  let match: RegExpExecArray | null
  while ((match = hrefRegex.exec(html)) !== null) {
    const tagPrefix = match[1]
    const href = match[2]
    // Skip anchors, mailto, tel, javascript, data URIs
    if (/^(#|mailto:|tel:|javascript:|data:)/.test(href)) continue
    // Skip preconnect and dns-prefetch link tags (not navigable pages)
    if (/rel=["'](preconnect|dns-prefetch)["']/.test(tagPrefix)) continue
    try {
      const resolved = new URL(href, pageUrl).href
      links.push(resolved)
    } catch {
      // Skip malformed URLs
    }
  }
  return links
}

/** Crawl the site starting from BASE_URL, collecting all internal page URLs */
async function crawlInternalPages(): Promise<Set<string>> {
  const visited = new Set<string>()
  const queue: string[] = [BASE_URL + "/"]

  while (queue.length > 0) {
    // Process in batches for concurrency
    const batch = queue.splice(0, CONCURRENCY)
    const results = await Promise.allSettled(
      batch
        .filter((url) => !visited.has(url))
        .map(async (url) => {
          visited.add(url)
          const res = await robustFetch(url)
          if (!res.ok) return { url, links: [] }
          const contentType = res.headers.get("content-type") ?? ""
          if (!contentType.includes("text/html")) return { url, links: [] }
          const html = await res.text()
          return { url, links: extractLinks(html, url) }
        }),
    )

    for (const result of results) {
      if (result.status !== "fulfilled") continue
      const { links } = result.value
      for (const link of links) {
        // Only follow internal links for crawling
        if (link.startsWith(BASE_URL) && !visited.has(link)) {
          // Strip hash fragments for crawling
          const clean = link.split("#")[0]
          if (!visited.has(clean)) {
            queue.push(clean)
          }
        }
      }
    }
  }

  return visited
}

/** Check a batch of URLs, returns list of broken ones */
async function checkLinks(
  urls: string[],
): Promise<{ url: string; status: number | string; from: string }[]> {
  const broken: { url: string; status: number | string; from: string }[] = []

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY)
    await Promise.allSettled(
      batch.map(async (entry) => {
        const [url, from] = entry.split("\t")
        try {
          const res = await robustFetch(url)
          if (res.status === 404) {
            broken.push({ url, status: res.status, from })
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          broken.push({ url, status: `error: ${message}`, from })
        }
      }),
    )
  }

  return broken
}

describe("Integration: Broken link checker", { timeout: 300_000 }, () => {
  let allLinks: Map<string, Set<string>> = new Map() // link -> set of pages it was found on
  let internalPages: Set<string> = new Set()

  before(async () => {
    // First, verify the site is reachable
    try {
      const res = await robustFetch(BASE_URL + "/", 15_000)
      assert.ok(res.ok, `Site not reachable at ${BASE_URL} (status: ${res.status})`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      assert.fail(`Cannot reach site at ${BASE_URL}: ${message}`)
    }

    // Crawl all internal pages
    console.log(`Crawling site at ${BASE_URL} ...`)
    internalPages = await crawlInternalPages()
    console.log(`Found ${internalPages.size} internal pages`)

    // Collect all links from every internal page
    for (const pageUrl of internalPages) {
      try {
        const res = await robustFetch(pageUrl)
        if (!res.ok) continue
        const contentType = res.headers.get("content-type") ?? ""
        if (!contentType.includes("text/html")) continue
        const html = await res.text()
        const links = extractLinks(html, pageUrl)
        for (const link of links) {
          const clean = link.split("#")[0]
          if (!clean) continue
          if (!allLinks.has(clean)) {
            allLinks.set(clean, new Set())
          }
          allLinks.get(clean)!.add(pageUrl)
        }
      } catch {
        // Skip pages that error during link extraction
      }
    }

    console.log(`Collected ${allLinks.size} unique links to check`)
  })

  it("should have no internal 404 links", async () => {
    const internalLinks = Array.from(allLinks.entries()).filter(([url]) =>
      url.startsWith(BASE_URL),
    )

    const entries = internalLinks.map(([url, sources]) => `${url}\t${Array.from(sources)[0]}`)
    const broken = await checkLinks(entries)

    if (broken.length > 0) {
      const report = broken
        .map((b) => `  404: ${b.url}\n       linked from: ${b.from}`)
        .join("\n")
      assert.fail(`Found ${broken.length} broken internal link(s):\n${report}`)
    }
  })

  it("should have no external 404 links", async () => {
    const externalLinks = Array.from(allLinks.entries()).filter(
      ([url]) => !url.startsWith(BASE_URL),
    )

    const entries = externalLinks.map(([url, sources]) => `${url}\t${Array.from(sources)[0]}`)
    const broken = await checkLinks(entries)

    if (broken.length > 0) {
      const report = broken
        .map((b) => `  ${b.status}: ${b.url}\n       linked from: ${b.from}`)
        .join("\n")
      assert.fail(`Found ${broken.length} broken external link(s):\n${report}`)
    }
  })
})
