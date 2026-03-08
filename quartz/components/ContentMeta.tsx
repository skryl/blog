import { Date } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import readingTime from "reading-time"
import { classNames } from "../util/lang"
import style from "./styles/contentMeta.scss"

interface ContentMetaOptions {
  showReadingTime: boolean
}

const defaultOptions: ContentMetaOptions = {
  showReadingTime: true,
}

export default ((opts?: Partial<ContentMetaOptions>) => {
  const options: ContentMetaOptions = { ...defaultOptions, ...opts }

  function ContentMetadata({ cfg, fileData, displayClass }: QuartzComponentProps) {
    const text = fileData.text
    if (!text) return null

    const publishedDate = fileData.dates?.published ?? fileData.dates?.created
    const modifiedDate = fileData.dates?.modified

    return (
      <div class={classNames(displayClass, "content-meta sidebar-card")}>
        <div class="content-meta-header">
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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>About this post</span>
        </div>
        <ul class="content-meta-list">
          {options.showReadingTime && (
            <li>
              Read time: {Math.ceil(readingTime(text).minutes)} minutes
            </li>
          )}
          {publishedDate && (
            <li>
              <a class="internal">Published</a> on{" "}
              <Date date={publishedDate} locale={cfg.locale} />
            </li>
          )}
          {modifiedDate && (
            <li>
              <a class="internal">Updated</a> on{" "}
              <Date date={modifiedDate} locale={cfg.locale} />
            </li>
          )}
        </ul>
      </div>
    )
  }

  ContentMetadata.css = style

  return ContentMetadata
}) satisfies QuartzComponentConstructor
