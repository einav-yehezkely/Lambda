'use client';

import { useMemo } from 'react';
import katex from 'katex';

type Segment =
  | { type: 'text'; value: string }
  | { type: 'inline'; value: string }
  | { type: 'block'; value: string }
  | { type: 'list'; listType: 'ol' | 'ul'; items: string[] };

// KaTeX-supported math environments only
const MATH_ENV_RE = /^(array|[pPbBvV]?matrix|align\*?|alignat\*?|alignedat|equation\*?|gather\*?|gathered|cases|[dr]?cases|split|CD|multline\*?|flalign\*?)$/;
const LIST_ENVS: Record<string, 'ol' | 'ul'> = { enumerate: 'ol', itemize: 'ul' };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\begin\{([^}]+)\}[\s\S]*?\\end\{\2\})/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const envName = m[2]; // set only for \begin{...} matches

    if (envName && LIST_ENVS[envName]) {
      // List environment — render as HTML list
      if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) });
      const inner = m[0].slice(`\\begin{${envName}}`.length, -`\\end{${envName}}`.length);
      const items = inner.split('\\item').slice(1).map(s => s.trim());
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
const INLINE_RE = /(\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\*(.+?)\*|_(.+?)_)/gs;

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
    <span className={`leading-loose ${className ?? ''}`.trim()}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i} className="whitespace-pre-wrap">{renderInline(seg.value)}</span>;
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
