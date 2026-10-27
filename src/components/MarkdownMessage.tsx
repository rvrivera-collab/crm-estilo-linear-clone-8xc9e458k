import React, { memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkdownMessageProps {
  content: string
  isStreaming?: boolean
  onOpenDeal?: (code: string) => void
  className?: string
}

/**
 * Transforms plain string into React nodes, replacing NEG-XXXX mentions with clickable chips
 */
function renderDealCodeLinks(text: string, onOpenDeal?: (code: string) => void): React.ReactNode {
  if (!text || typeof text !== 'string') return text
  const parts = text.split(/(NEG-\d{4,})/g)
  if (parts.length === 1) return text

  return parts.map((part, index) => {
    if (/^NEG-\d{4,}$/.test(part)) {
      return (
        <button
          key={`${part}-${index}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpenDeal?.(part)
          }}
          className="mx-0.5 inline-flex items-center rounded border border-blue-200 bg-blue-50/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 active:scale-95"
          title={`Abrir negócio ${part}`}
        >
          {part}
        </button>
      )
    }
    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}

/**
 * Recursively scans children to transform any text nodes containing NEG-XXXX into deal chips
 */
function enhanceWithDealCodes(
  children: React.ReactNode,
  onOpenDeal?: (code: string) => void,
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      return renderDealCodeLinks(child, onOpenDeal)
    }
    if (React.isValidElement(child)) {
      // Don't format inside code blocks or preexisting buttons/links
      if (
        child.type === 'code' ||
        child.type === 'pre' ||
        child.type === 'button' ||
        child.type === 'a'
      ) {
        return child
      }
      const props = child.props as { children?: React.ReactNode }
      if (props && props.children) {
        return React.cloneElement(
          child,
          undefined,
          enhanceWithDealCodes(props.children, onOpenDeal),
        )
      }
    }
    return child
  })
}

function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
  const [copied, setCopied] = React.useState(false)
  const isInline = !className && !String(children).includes('\n')

  if (isInline) {
    return (
      <code
        className="rounded bg-[#f1f5f9] px-1.5 py-0.5 font-mono text-[12px] text-[#0f172a] border border-[#e2e8f0]"
        {...props}
      >
        {children}
      </code>
    )
  }

  const rawCode = String(children).replace(/\n$/, '')
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* intentionally ignored */
    }
  }

  return (
    <div className="relative my-3 overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[12px]">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f1f5f9]/70 px-3 py-1.5 text-[11px] font-medium text-[#64748b]">
        <span>{language || 'código'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-[#64748b] hover:bg-white hover:text-[#0f172a] hover:shadow-2xs transition"
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-600" />
              <span className="text-emerald-700">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-3">
        <code className="font-mono text-[12px] leading-relaxed text-[#1e293b]" {...props}>
          {children}
        </code>
      </div>
    </div>
  )
}

export const MarkdownMessage = memo(function MarkdownMessage({
  content,
  isStreaming = false,
  onOpenDeal,
  className,
}: MarkdownMessageProps) {
  const components: Components = React.useMemo(
    () => ({
      h1: ({ children, ...props }) => (
        <h1
          className="mb-2 mt-4 text-[16px] font-semibold tracking-tight text-[#0f172a] first:mt-0"
          {...props}
        >
          {enhanceWithDealCodes(children, onOpenDeal)}
        </h1>
      ),
      h2: ({ children, ...props }) => (
        <h2
          className="mb-2 mt-3.5 text-[14px] font-semibold tracking-tight text-[#0f172a] first:mt-0"
          {...props}
        >
          {enhanceWithDealCodes(children, onOpenDeal)}
        </h2>
      ),
      h3: ({ children, ...props }) => (
        <h3 className="mb-1.5 mt-3 text-[13px] font-semibold text-[#0f172a] first:mt-0" {...props}>
          {enhanceWithDealCodes(children, onOpenDeal)}
        </h3>
      ),
      h4: ({ children, ...props }) => (
        <h4 className="mb-1 mt-2.5 text-[12px] font-semibold text-[#0f172a] first:mt-0" {...props}>
          {enhanceWithDealCodes(children, onOpenDeal)}
        </h4>
      ),
      p: ({ children, ...props }) => (
        <p className="mb-2.5 leading-relaxed text-[#334155] last:mb-0" {...props}>
          {enhanceWithDealCodes(children, onOpenDeal)}
        </p>
      ),
      strong: ({ children, ...props }) => (
        <strong className="font-semibold text-[#0f172a]" {...props}>
          {enhanceWithDealCodes(children, onOpenDeal)}
        </strong>
      ),
      em: ({ children, ...props }) => (
        <em className="italic text-[#334155]" {...props}>
          {enhanceWithDealCodes(children, onOpenDeal)}
        </em>
      ),
      ul: ({ children, ...props }) => (
        <ul className="my-2 ml-4 list-disc space-y-1 text-[#334155]" {...props}>
          {children}
        </ul>
      ),
      ol: ({ children, ...props }) => (
        <ol className="my-2 ml-4 list-decimal space-y-1 text-[#334155]" {...props}>
          {children}
        </ol>
      ),
      li: ({ children, ...props }) => (
        <li className="leading-relaxed" {...props}>
          {enhanceWithDealCodes(children, onOpenDeal)}
        </li>
      ),
      blockquote: ({ children, ...props }) => (
        <blockquote
          className="my-2.5 border-l-2 border-amber-400 bg-amber-50/40 py-1 pl-3 pr-2 text-[12px] italic text-[#475569]"
          {...props}
        >
          {enhanceWithDealCodes(children, onOpenDeal)}
        </blockquote>
      ),
      hr: (props) => <hr className="my-3 border-[#e2e8f0]" {...props} />,
      a: ({ href, children, ...props }) => {
        const isExternal = href?.startsWith('http://') || href?.startsWith('https://')
        return (
          <a
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="font-medium text-amber-600 underline underline-offset-2 hover:text-amber-700 transition"
            {...props}
          >
            {enhanceWithDealCodes(children, onOpenDeal)}
          </a>
        )
      },
      code: CodeBlock,
      table: ({ children, ...props }) => (
        <div className="my-3 w-full overflow-x-auto rounded-lg border border-[#e2e8f0]">
          <table className="w-full border-collapse text-left text-[12px]" {...props}>
            {children}
          </table>
        </div>
      ),
      thead: ({ children, ...props }) => (
        <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569]" {...props}>
          {children}
        </thead>
      ),
      tbody: ({ children, ...props }) => (
        <tbody className="divide-y divide-[#e2e8f0] bg-white" {...props}>
          {children}
        </tbody>
      ),
      tr: ({ children, ...props }) => (
        <tr className="transition hover:bg-[#f8fafc]/60" {...props}>
          {children}
        </tr>
      ),
      th: ({ children, ...props }) => (
        <th className="px-3 py-2 font-semibold text-[#0f172a]" {...props}>
          {enhanceWithDealCodes(children, onOpenDeal)}
        </th>
      ),
      td: ({ children, ...props }) => (
        <td className="px-3 py-2 text-[#334155] align-top" {...props}>
          {enhanceWithDealCodes(children, onOpenDeal)}
        </td>
      ),
    }),
    [onOpenDeal],
  )

  return (
    <div
      className={cn(
        'markdown-content text-[13px] leading-relaxed break-words text-[#334155]',
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
      {isStreaming && (
        <span
          className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-amber-500 align-middle"
          aria-hidden="true"
        />
      )}
    </div>
  )
})
