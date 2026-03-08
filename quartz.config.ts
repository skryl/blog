import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
  configuration: {
    pageTitle: "The Pond",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: "skryl.github.io/blog",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "published",
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
          light: "#eff1f5",
          lightgray: "#dce0e8",
          gray: "#9ca0b0",
          darkgray: "#4c4f69",
          dark: "#303446",
          secondary: "#3e6ccb",
          tertiary: "#22820d",
          highlight: "rgba(62, 108, 203, 0.12)",
          textHighlight: "#df8e1d55",
        },
        darkMode: {
          light: "#303446",
          lightgray: "#414559",
          gray: "#737994",
          darkgray: "#c6d0f5",
          dark: "#e2e4ef",
          secondary: "#8caaee",
          tertiary: "#a6d189",
          highlight: "rgba(140, 170, 238, 0.12)",
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
          dark: "one-dark-pro",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
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
