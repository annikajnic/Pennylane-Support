import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// GFM adds the tables and task lists some descriptions use. react-markdown doesn't render raw HTML by default, so user-authored content is safe.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
