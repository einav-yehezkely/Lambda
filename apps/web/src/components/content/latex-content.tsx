'use client';

import { useMemo } from 'react';
import katex from 'katex';

type Segment =
  | { type: 'text'; value: string }
  | { type: 'inline'; value: string }
  | { type: 'block'; value: string };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  // Match $$...$$ (block) or $...$ (inline), non-greedy
  const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ type: 'text', value: text.slice(last, m.index) });
    }
    const isBlock = m[0].startsWith('$$');
    segments.push({
      type: isBlock ? 'block' : 'inline',
      value: m[0].slice(isBlock ? 2 : 1, isBlock ? -2 : -1),
    });
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    segments.push({ type: 'text', value: text.slice(last) });
  }

  return segments;
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
    <span className={className} dir="auto">
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return (
            <span key={i} className="whitespace-pre-wrap">
              {seg.value}
            </span>
          );
        }
        try {
          const html = renderLatex(seg.value, seg.type === 'block');
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: html }}
              className={seg.type === 'block' ? 'block my-2' : 'inline'}
            />
          );
        } catch {
          // Fallback to raw text if KaTeX fails
          return (
            <span key={i} className="font-mono text-xs">
              {seg.type === 'block' ? `$$${seg.value}$$` : `$${seg.value}$`}
            </span>
          );
        }
      })}
    </span>
  );
}
