'use client';

import { useMemo } from 'react';
import katex from 'katex';

type Segment =
  | { type: 'text'; value: string }
  | { type: 'inline'; value: string }
  | { type: 'block'; value: string }
  | { type: 'list'; listType: 'ol' | 'ul'; items: string[] }
  | { type: 'code-block'; value: string }
  | { type: 'code-inline'; value: string };

// KaTeX-supported math environments only
const MATH_ENV_RE = /^(array|[pPbBvV]?matrix|align\*?|alignat\*?|alignedat|equation\*?|gather\*?|gathered|cases|[dr]?cases|split|CD|multline\*?|flalign\*?)$/;
const LIST_ENVS: Record<string, 'ol' | 'ul'> = { enumerate: 'ol', itemize: 'ul' };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  // Code blocks and inline code are matched first (higher priority than math)
  const re = /```([\s\S]*?)```|`([^`\n]+?)`|(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\begin\{([^}]+)\}[\s\S]*?\\end\{\4\})/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m[1] !== undefined) {
      // Code block ```...```
      if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) });
      segments.push({ type: 'code-block', value: m[1].replace(/^\n/, '').replace(/\n$/, '') });
      last = m.index + m[0].length;
      continue;
    }

    if (m[2] !== undefined) {
      // Inline code `...`
      if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) });
      segments.push({ type: 'code-inline', value: m[2] });
      last = m.index + m[0].length;
      continue;
    }

    // Math / environment (m[3] is the full match, m[4] is env name if \begin{...})
    const envName = m[4];

    if (envName && LIST_ENVS[envName]) {
      // List environment — render as HTML list
      if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) });
      const inner = m[0].slice(`\\begin{${envName}}`.length, -`\\end{${envName}}`.length);
      const items = inner.split('\\item').slice(1).map(s => s.replace(/^[ \n\r]+/, '').replace(/[ \n\r]+$/, ''));
      segments.push({ type: 'list', listType: LIST_ENVS[envName], items });
      last = m.index + m[0].length;
    } else if (envName && !MATH_ENV_RE.test(envName)) {
      // Unknown environment — skip, treat as plain text
      continue;
    } else {
      // $...$ / $$...$$ / supported math environment
      if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) });
      const isEnv = !!envName;
      const isBlock = isEnv || m[0].startsWith('$$');
      segments.push({
        type: isBlock ? 'block' : 'inline',
        value: isEnv ? m[0] : m[0].slice(isBlock ? 2 : 1, isBlock ? -2 : -1),
      });
      last = m.index + m[0].length;
    }
  }

  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}

// ── Inline formatting (Markdown-style) ───────────────────────────────────────
// Order matters: longer tokens first to avoid partial matches.
const INLINE_RE = /(\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\*(.+?)\*|_(.+?)_)/g;

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3] !== undefined) parts.push(<u key={m.index}>{m[3]}</u>);
    else if (m[4] !== undefined) parts.push(<del key={m.index}>{m[4]}</del>);
    else if (m[5] !== undefined) parts.push(<em key={m.index}>{m[5]}</em>);
    else if (m[6] !== undefined) parts.push(<em key={m.index}>{m[6]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderLatex(latex: string, displayMode: boolean): string {
  return katex.renderToString(latex, {
    displayMode,
    throwOnError: false,
    output: 'html',
  });
}

interface LatexContentProps {
  content: string;
  className?: string;
}

export function LatexContent({ content, className }: LatexContentProps) {
  const segments = useMemo(() => parseSegments(content), [content]);

  return (
    <span style={{ whiteSpace: 'pre-wrap' }} className={`leading-loose ${className ?? ''}`.trim()}>
      {segments.map((seg, i) => {
        if (seg.type === 'code-block') {
          const lines = seg.value ? seg.value.split('\n') : [''];
          return (
            <div key={i} dir="ltr" className="font-mono text-sm bg-gray-900 rounded my-1.5 border border-gray-700 flex overflow-x-auto">
              <div className="text-gray-500 p-3 pr-4 border-r border-gray-700 select-none text-right whitespace-pre leading-relaxed">
                {lines.map((_, j) => j + 1).join('\n')}
              </div>
              <pre className="text-green-400 p-3 flex-1 whitespace-pre m-0 leading-relaxed">{seg.value}</pre>
            </div>
          );
        }
        if (seg.type === 'code-inline') {
          return (
            <code key={i} dir="ltr" className="font-mono text-xs bg-gray-100 text-red-600 px-1.5 py-0.5 rounded border border-gray-200">
              {seg.value}
            </code>
          );
        }
        if (seg.type === 'text') {
          return <span key={i}>{renderInline(seg.value)}</span>;
        }
        if (seg.type === 'list') {
          const Tag = seg.listType === 'ol' ? 'ol' : 'ul';
          return (
            <Tag key={i} className={`${seg.listType === 'ol' ? 'list-decimal' : 'list-disc'} list-outside ps-5 space-y-1 my-2 block`}>
              {seg.items.map((item, j) => (
                <li key={j}><LatexContent content={item} /></li>
              ))}
            </Tag>
          );
        }
        try {
          const html = renderLatex(seg.value, seg.type === 'block');
          return (
            <span
              key={i}
              dir="ltr"
              dangerouslySetInnerHTML={{ __html: html }}
              className={seg.type === 'block' ? 'block my-4' : 'inline'}
            />
          );
        } catch {
          return (
            <span key={i} dir="ltr" className="font-mono text-xs">
              {seg.type === 'block' ? `$$${seg.value}$$` : `$${seg.value}$`}
            </span>
          );
        }
      })}
    </span>
  );
}
