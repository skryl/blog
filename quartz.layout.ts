import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/skryl",
      RSS: "/blog/index.xml",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ArticleTitle(),
    Component.TagList(),
  ],
  left: [
    Component.Navbar({
      pages: [
        { title: "About me", slug: "/about" },
        { title: "My research", slug: "/research" },
        { title: "All posts", slug: "/posts" },
        { title: "Open source", slug: "/open-source" },
        { title: "Subscribe", slug: "/subscribe" },
      ],
    }),
    Component.Search(),
    Component.Explorer(),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    Component.SequenceNav(),
    Component.TagsSidebar(),
    Component.ContentMeta(),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle()],
  left: [
    Component.Navbar({
      pages: [
        { title: "About me", slug: "/about" },
        { title: "My research", slug: "/research" },
        { title: "All posts", slug: "/posts" },
        { title: "Open source", slug: "/open-source" },
        { title: "Subscribe", slug: "/subscribe" },
      ],
    }),
    Component.Search(),
    Component.Explorer(),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
  ],
}
