import { FullSlug, resolveRelative } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import style from "./styles/tagsSidebar.scss"

const TagsSidebar: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const tags = fileData.frontmatter?.tags
  if (!tags || tags.length === 0) {
    return null
  }

  return (
    <div class={classNames(displayClass, "tags-sidebar sidebar-card")}>
      <div class="tags-sidebar-header">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
        <span>Tags</span>
      </div>
      <ul class="tags-sidebar-list">
        {tags.map((tag) => {
          const linkDest = resolveRelative(fileData.slug!, `tags/${tag}` as FullSlug)
          return (
            <li>
              <a href={linkDest} class="internal">
                {tag}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

TagsSidebar.css = style

export default (() => TagsSidebar) satisfies QuartzComponentConstructor
