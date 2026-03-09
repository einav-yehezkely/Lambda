'use client';

import { useEffect, useRef, useState } from 'react';
import katex from 'katex';

// ─── Toolbar ─────────────────────────────────────────────────────────────────

interface Btn {
  label: string;
  title: string;
  insert: string;
  wrapWith?: [string, string];
}

const GROUPS: { name: string; buttons: Btn[] }[] = [
  {
    name: 'Math',
    buttons: [
      { label: '$·$', title: 'Inline math $...$', insert: '$$', wrapWith: ['$', '$'] },
      { label: '$$·$$', title: 'Block math $$...$$', insert: '$$$$', wrapWith: ['$$', '$$'] },
      { label: 'xⁿ', title: '^{}', insert: '^{}' },
      { label: 'xₙ', title: '_{}', insert: '_{}' },
      { label: 'a/b', title: '\\frac{}{}', insert: '\\frac{}{}' },
      { label: '√x', title: '\\sqrt{}', insert: '\\sqrt{}' },
      { label: 'ⁿ√x', title: '\\sqrt[]{}', insert: '\\sqrt[]{}' },
      { label: '∞', title: '\\infty', insert: '\\infty' },
      { label: '|x|', title: '\\left|\\right|', insert: '\\left| \\right|' },
    ],
  },
  {
    name: 'Σ∫',
    buttons: [
      { label: '∑', title: '\\sum', insert: '\\sum_{i=1}^{n}' },
      { label: '∏', title: '\\prod', insert: '\\prod_{i=1}^{n}' },
      { label: '∫', title: '\\int', insert: '\\int_{}^{}' },
      { label: 'lim', title: '\\lim', insert: '\\lim_{n \\to \\infty}' },
      { label: '∂', title: '\\partial', insert: '\\partial' },
      { label: 'd/dx', title: 'Derivative', insert: '\\frac{d}{dx}' },
    ],
  },
  {
    name: 'αβγ',
    buttons: [
      { label: 'α', title: '\\alpha', insert: '\\alpha' },
      { label: 'β', title: '\\beta', insert: '\\beta' },
      { label: 'γ', title: '\\gamma', insert: '\\gamma' },
      { label: 'δ', title: '\\delta', insert: '\\delta' },
      { label: 'ε', title: '\\epsilon', insert: '\\epsilon' },
      { label: 'θ', title: '\\theta', insert: '\\theta' },
      { label: 'λ', title: '\\lambda', insert: '\\lambda' },
      { label: 'μ', title: '\\mu', insert: '\\mu' },
      { label: 'π', title: '\\pi', insert: '\\pi' },
      { label: 'σ', title: '\\sigma', insert: '\\sigma' },
      { label: 'φ', title: '\\phi', insert: '\\phi' },
      { label: 'ω', title: '\\omega', insert: '\\omega' },
      { label: 'Σ', title: '\\Sigma', insert: '\\Sigma' },
      { label: 'Δ', title: '\\Delta', insert: '\\Delta' },
      { label: 'Γ', title: '\\Gamma', insert: '\\Gamma' },
      { label: 'Λ', title: '\\Lambda', insert: '\\Lambda' },
      { label: 'Ω', title: '\\Omega', insert: '\\Omega' },
      { label: 'Θ', title: '\\Theta', insert: '\\Theta' },
    ],
  },
  {
    name: '≤∈',
    buttons: [
      { label: '≤', title: '\\leq', insert: '\\leq' },
      { label: '≥', title: '\\geq', insert: '\\geq' },
      { label: '≠', title: '\\neq', insert: '\\neq' },
      { label: '≈', title: '\\approx', insert: '\\approx' },
      { label: '∈', title: '\\in', insert: '\\in' },
      { label: '∉', title: '\\notin', insert: '\\notin' },
      { label: '⊆', title: '\\subseteq', insert: '\\subseteq' },
      { label: '⊂', title: '\\subset', insert: '\\subset' },
      { label: '∪', title: '\\cup', insert: '\\cup' },
      { label: '∩', title: '\\cap', insert: '\\cap' },
      { label: '∅', title: '\\emptyset', insert: '\\emptyset' },
    ],
  },
  {
    name: '∀⇒',
    buttons: [
      { label: '∀', title: '\\forall', insert: '\\forall' },
      { label: '∃', title: '\\exists', insert: '\\exists' },
      { label: '⇒', title: '\\Rightarrow', insert: '\\Rightarrow' },
      { label: '⟺', title: '\\Leftrightarrow', insert: '\\Leftrightarrow' },
      { label: '¬', title: '\\neg', insert: '\\neg' },
      { label: '∧', title: '\\land', insert: '\\land' },
      { label: '∨', title: '\\lor', insert: '\\lor' },
    ],
  },
  {
    name: 'O(n)',
    buttons: [
      { label: 'O()', title: 'Big-O', insert: 'O()' },
      { label: 'Ω()', title: 'Big-Omega', insert: '\\Omega()' },
      { label: 'Θ()', title: 'Big-Theta', insert: '\\Theta()' },
      { label: 'O(1)', title: 'Constant', insert: 'O(1)' },
      { label: 'O(n)', title: 'Linear', insert: 'O(n)' },
      { label: 'O(log n)', title: 'Logarithmic', insert: 'O(\\log n)' },
      { label: 'O(n²)', title: 'Quadratic', insert: 'O(n^2)' },
      { label: 'O(n log n)', title: 'Linearithmic', insert: 'O(n \\log n)' },
    ],
  },
];

// ─── DOM helpers ─────────────────────────────────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Walk the contenteditable div and produce the raw source string. */
function divToValue(div: HTMLElement): string {
  let out = '';
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
    } else if (node instanceof HTMLElement) {
      const latex = node.getAttribute('data-latex');
      if (latex !== null) { out += `$${latex}$`; return; }
      if (node.tagName === 'BR') { out += '\n'; return; }
      if (['DIV', 'P'].includes(node.tagName) && out && !out.endsWith('\n')) out += '\n';
      node.childNodes.forEach(walk);
    }
  }
  div.childNodes.forEach(walk);
  return out;
}

/** Convert a raw value string to HTML for initial render (renders existing $...$). */
function valueToHtml(value: string): string {
  const re = /\$([^$\n]+?)\$/g;
  let html = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    if (m.index > last) html += escHtml(value.slice(last, m.index)).replace(/\n/g, '<br>');
    const latex = m[1];
    try {
      const rendered = katex.renderToString(latex, { throwOnError: false });
      html += `<span data-latex="${latex.replace(/"/g, '&quot;')}" contenteditable="false" dir="ltr" class="math-span">${rendered}</span>`;
    } catch {
      html += escHtml(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < value.length) html += escHtml(value.slice(last)).replace(/\n/g, '<br>');
  return html;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface LatexEditorProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}

export function LatexEditor({ value, onChange, rows = 4, placeholder }: LatexEditorProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const [activeGroup, setActiveGroup] = useState(0);

  // Set initial content (and on external changes while not focused)
  useEffect(() => {
    const div = divRef.current;
    if (!div || focused.current) return;
    div.innerHTML = valueToHtml(value);
  }, [value]);

  // ── On space: render complete $...$ immediately before cursor ──
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // ── Backspace: expand rendered math span back to raw LaTeX ──
    if (e.key === 'Backspace') {
      divRef.current?.normalize();
      const sel = window.getSelection();
      if (!sel?.rangeCount || !sel.getRangeAt(0).collapsed) return;
      const range = sel.getRangeAt(0);

      let mathSpan: HTMLElement | null = null;
      let removeNbsp = false;

      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer as Text;
        const offset = range.startOffset;
        const charBefore = offset > 0 ? (textNode.nodeValue ?? '')[offset - 1] : null;
        if (offset === 0 || charBefore === '\u00a0') {
          const prev = textNode.previousSibling;
          if (prev instanceof HTMLElement && prev.hasAttribute('data-latex')) {
            mathSpan = prev;
            removeNbsp = charBefore === '\u00a0';
          }
        }
      } else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
        const offset = range.startOffset;
        if (offset > 0) {
          const prev = range.startContainer.childNodes[offset - 1];
          if (prev instanceof HTMLElement && prev.hasAttribute('data-latex')) {
            mathSpan = prev as HTMLElement;
          }
        }
      }

      if (mathSpan) {
        e.preventDefault();
        const latex = mathSpan.getAttribute('data-latex')!;
        const raw = `$${latex}$`;
        const rawNode = document.createTextNode(raw);
        if (removeNbsp) {
          const textNode = range.startContainer as Text;
          textNode.nodeValue = (textNode.nodeValue ?? '').slice(1);
        }
        mathSpan.parentNode!.replaceChild(rawNode, mathSpan);
        const newRange = document.createRange();
        newRange.setStart(rawNode, raw.length);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        onChange(divToValue(divRef.current!));
      }
      return;
    }

    if (e.key !== ' ') return;

    // Merge adjacent text nodes so $...$ is detectable even after toolbar inserts
    divRef.current?.normalize();

    const sel = window.getSelection();
    if (!sel?.rangeCount || !sel.getRangeAt(0).collapsed) return;
    const range = sel.getRangeAt(0);
    if (range.startContainer.nodeType !== Node.TEXT_NODE) return;

    const textNode = range.startContainer as Text;
    const offset = range.startOffset;
    const textBefore = (textNode.nodeValue ?? '').slice(0, offset);

    // Match complete $...$ right before cursor
    const match = textBefore.match(/\$([^$\n]+)\$$/);
    if (!match) return;

    e.preventDefault();

    const latex = match[1];
    const matchStart = offset - match[0].length;
    const fullText = textNode.nodeValue ?? '';
    const after = fullText.slice(offset);

    // Build rendered span
    const span = document.createElement('span');
    span.setAttribute('data-latex', latex);
    span.setAttribute('contenteditable', 'false');
    span.setAttribute('dir', 'ltr');
    span.className = 'math-span';
    try {
      span.innerHTML = katex.renderToString(latex, { throwOnError: false });
    } catch {
      span.textContent = match[0];
    }

    const parent = textNode.parentNode!;
    const beforeNode = document.createTextNode(fullText.slice(0, matchStart));
    const afterNode = document.createTextNode('\u00a0' + after); // nbsp acts as the inserted space

    parent.insertBefore(beforeNode, textNode);
    parent.insertBefore(span, textNode);
    parent.insertBefore(afterNode, textNode);
    parent.removeChild(textNode);

    // Place cursor right after the nbsp
    const newRange = document.createRange();
    newRange.setStart(afterNode, 1);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    onChange(divToValue(divRef.current!));
  }

  // ── Click on rendered math → expand back to raw LaTeX ──
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const span = (e.target as HTMLElement).closest('[data-latex]') as HTMLElement | null;
    if (!span) return;

    const latex = span.getAttribute('data-latex')!;
    const raw = `$${latex}$`;
    const textNode = document.createTextNode(raw);
    span.parentNode!.replaceChild(textNode, span);

    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, raw.length - 1); // cursor before closing $
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    onChange(divToValue(divRef.current!));
  }

  function handleInput() {
    if (divRef.current) onChange(divToValue(divRef.current));
  }

  // ── Toolbar insert ──
  function insertSnippet(btn: Btn) {
    const div = divRef.current;
    if (!div) return;
    div.focus();

    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);

    let snippet: string;
    let cursorPos: number;

    if (btn.wrapWith) {
      const [pre, post] = btn.wrapWith;
      const selected = range.toString();
      snippet = selected ? pre + selected + post : pre + post;
      cursorPos = selected ? snippet.length : pre.length;
    } else {
      snippet = btn.insert;
      const fb = snippet.indexOf('{');
      cursorPos = fb >= 0 ? fb + 1 : snippet.length;
    }

    range.deleteContents();
    const textNode = document.createTextNode(snippet);
    range.insertNode(textNode);

    const newRange = document.createRange();
    newRange.setStart(textNode, Math.min(cursorPos, snippet.length));
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    onChange(divToValue(div));
  }

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-gray-900">
      {/* Group tabs */}
      <div className="bg-gray-50 border-b border-gray-200 flex items-center overflow-x-auto">
        <div className="flex px-1 pt-1 gap-0.5">
          {GROUPS.map((g, i) => (
            <button
              key={g.name}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setActiveGroup(i); }}
              className={`px-2.5 py-1 text-xs rounded-t-sm whitespace-nowrap transition-colors ${
                activeGroup === i
                  ? 'bg-white border border-b-white border-gray-200 text-gray-900 font-medium relative z-10'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="bg-gray-50 border-b border-gray-200 px-2 py-1.5 flex flex-wrap gap-1">
        {GROUPS[activeGroup].buttons.map((btn) => (
          <button
            key={btn.title}
            type="button"
            title={btn.title}
            onMouseDown={(e) => { e.preventDefault(); insertSnippet(btn); }}
            className="px-1.5 py-0.5 text-sm bg-white border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 text-gray-700 min-w-[2rem] text-center font-mono leading-tight"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Contenteditable editor */}
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; }}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onClick={handleClick}
        dir="auto"
        data-placeholder={placeholder}
        style={{ minHeight: `${rows * 1.6}rem` }}
        className="px-3 py-2 text-sm focus:outline-none leading-relaxed
          before:content-[attr(data-placeholder)] before:text-gray-400 before:pointer-events-none
          [&:not(:empty)]:before:hidden
          [&_.math-span]:cursor-pointer [&_.math-span]:inline-block [&_.math-span]:align-middle
          [&_.math-span:hover]:outline [&_.math-span:hover]:outline-1 [&_.math-span:hover]:outline-blue-300 [&_.math-span:hover]:rounded"
      />
    </div>
  );
}
