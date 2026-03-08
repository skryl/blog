import { describe, it, before } from "node:test"
import assert from "node:assert/strict"

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

/** Fetch with timeout */
async function fetchWithTimeout(url: string, timeoutMs = TIMEOUT_MS): Promise<Response> {
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

/** Extract all href values from an HTML string */
function extractLinks(html: string, pageUrl: string): string[] {
  const links: string[] = []
  const hrefRegex = /href=["']([^"']+)["']/g
  let match: RegExpExecArray | null
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1]
    // Skip anchors, mailto, tel, javascript, data URIs
    if (/^(#|mailto:|tel:|javascript:|data:)/.test(href)) continue
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
          const res = await fetchWithTimeout(url)
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
          const res = await fetchWithTimeout(url)
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
      const res = await fetchWithTimeout(BASE_URL + "/", 15_000)
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
        const res = await fetchWithTimeout(pageUrl)
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
    const internalLinks = Array.from(allLinks.entries()).filter(([url]) => url.startsWith(BASE_URL))

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
    const externalLinks = Array.from(allLinks.entries()).filter(([url]) => !url.startsWith(BASE_URL))

    const entries = externalLinks.map(([url, sources]) => `${url}\t${Array.from(sources)[0]}`)
    const broken = await checkLinks(entries)

    if (broken.length > 0) {
      const report = broken
        .map((b) => `  ${b.status}: ${b.url}\n       linked from: ${b.from}`)
        .join("\n")
      // External links may have transient failures, so log but still fail
      assert.fail(`Found ${broken.length} broken external link(s):\n${report}`)
    }
  })
})
