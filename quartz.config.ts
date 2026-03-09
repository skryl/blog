import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
  configuration: {
    pageTitle: "Skryl",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: "skryl.github.io/blog",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "published",
    navbar: {
      pages: [
        { title: "All posts", slug: "/posts" },
        { title: "About me", slug: "/about" },
        { title: "My projects", slug: "/research" },
        { title: "Subscribe", slug: "/subscribe" },
      ],
    },
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "EB Garamond",
        body: "EB Garamond",
        code: "Fira Code",
      },
      colors: {
        lightMode: {
          light: "#fafbfc",
          lightgray: "#e1e4e8",
          gray: "#8b949e",
          darkgray: "#3b3f46",
          dark: "#1f2328",
          secondary: "#0969da",
          tertiary: "#0891b2",
          highlight: "rgba(9, 105, 218, 0.08)",
          textHighlight: "#fff3cd88",
        },
        darkMode: {
          light: "#0d1117",
          lightgray: "#21262d",
          gray: "#6e7681",
          darkgray: "#c9d1d9",
          dark: "#e6edf3",
          secondary: "#58a6ff",
          tertiary: "#3fb9c7",
          highlight: "rgba(88, 166, 255, 0.08)",
          textHighlight: "#e3b34188",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: true }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents({ minEntries: 3 }),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config
