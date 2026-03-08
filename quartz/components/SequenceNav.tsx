import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative } from "../util/path"
import { FullSlug } from "../util/path"
import { classNames } from "../util/lang"
import style from "./styles/sequenceNav.scss"

const SequenceNav: QuartzComponent = ({
  fileData,
  displayClass,
}: QuartzComponentProps) => {
  const sequence = fileData.frontmatter?.sequence as string | undefined
  const sequenceSlug = fileData.frontmatter?.sequenceSlug as string | undefined
  const prev = fileData.frontmatter?.prev as string | undefined
  const prevTitle = fileData.frontmatter?.prevTitle as string | undefined
  const next = fileData.frontmatter?.next as string | undefined
  const nextTitle = fileData.frontmatter?.nextTitle as string | undefined

  if (!sequence) {
    return null
  }

  return (
    <div class={classNames(displayClass, "sequence-nav sidebar-card")}>
      <div class="sequence-header">
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
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span>
          Sequence:{" "}
          {sequenceSlug ? (
            <a
              href={resolveRelative(fileData.slug!, sequenceSlug as FullSlug)}
              class="internal"
            >
              {sequence}
            </a>
          ) : (
            <strong>{sequence}</strong>
          )}
        </span>
      </div>
      {prev && (
        <div class="sequence-link">
          Previous:{" "}
          <a
            href={resolveRelative(fileData.slug!, prev as FullSlug)}
            class="internal"
          >
            {prevTitle || prev}
          </a>
        </div>
      )}
      {next && (
        <div class="sequence-link">
          Next:{" "}
          <a
            href={resolveRelative(fileData.slug!, next as FullSlug)}
            class="internal"
          >
            {nextTitle || next}
          </a>
        </div>
      )}
    </div>
  )
}

SequenceNav.css = style

export default (() => SequenceNav) satisfies QuartzComponentConstructor
