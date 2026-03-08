import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
  configuration: {
    pageTitle: "Origin",
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
        { title: "Tags", slug: "/tags" },
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
          light: "#fcfcff",
          lightgray: "#e6e9ef",
          gray: "#9ca0b0",
          darkgray: "#4c4f69",
          dark: "#303446",
          secondary: "#3e6ccb",
          tertiary: "#22820d",
          highlight: "rgba(62, 108, 203, 0.10)",
          textHighlight: "#df8e1d55",
        },
        darkMode: {
          light: "#12141e",
          lightgray: "#2a2d3d",
          gray: "#737994",
          darkgray: "#d6deff",
          dark: "#e2e4ef",
          secondary: "#8caaee",
          tertiary: "#a6d189",
          highlight: "rgba(140, 170, 238, 0.10)",
          textHighlight: "#e5c890aa",
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
