'use client';

import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import { MathMLToLaTeX } from 'mathml-to-latex';

// ─── Word math conversion ─────────────────────────────────────────────────────

const UNICODE_TO_LATEX: [string, string][] = [
  ['⟹', '\\Longrightarrow'], ['⟺', '\\Longleftrightarrow'],
  ['→', '\\rightarrow'], ['←', '\\leftarrow'], ['↔', '\\leftrightarrow'],
  ['↦', '\\mapsto'],
  ['⇒', '\\Rightarrow'], ['⇐', '\\Leftarrow'], ['⇔', '\\Leftrightarrow'],
  ['≤', '\\leq'], ['≥', '\\geq'], ['≠', '\\neq'], ['≈', '\\approx'],
  ['∈', '\\in'], ['∉', '\\notin'], ['⊆', '\\subseteq'], ['⊂', '\\subset'],
  ['∪', '\\cup'], ['∩', '\\cap'], ['∅', '\\emptyset'],
  ['∀', '\\forall'], ['∃', '\\exists'], ['¬', '\\neg'],
  ['∧', '\\land'], ['∨', '\\lor'],
  ['∞', '\\infty'], ['∂', '\\partial'],
  ['∑', '\\sum'], ['∏', '\\prod'], ['∫', '\\int'],
  ['±', '\\pm'], ['×', '\\times'], ['÷', '\\div'], ['·', '\\cdot'],
  ['√', '\\sqrt'],
  ['⋮', '\\vdots'], ['⋯', '\\cdots'], ['⋱', '\\ddots'], ['…', '\\ldots'],
  ['ℂ', '\\mathbb{C}'], ['ℝ', '\\mathbb{R}'], ['ℤ', '\\mathbb{Z}'],
  ['ℕ', '\\mathbb{N}'], ['ℚ', '\\mathbb{Q}'],
  ['Γ', '\\Gamma'], ['Δ', '\\Delta'], ['Θ', '\\Theta'], ['Λ', '\\Lambda'],
  ['Ξ', '\\Xi'], ['Π', '\\Pi'], ['Σ', '\\Sigma'], ['Υ', '\\Upsilon'],
  ['Φ', '\\Phi'], ['Ψ', '\\Psi'], ['Ω', '\\Omega'],
  ['α', '\\alpha'], ['β', '\\beta'], ['γ', '\\gamma'], ['δ', '\\delta'],
  ['ε', '\\epsilon'], ['ζ', '\\zeta'], ['η', '\\eta'], ['θ', '\\theta'],
  ['ι', '\\iota'], ['κ', '\\kappa'], ['λ', '\\lambda'], ['μ', '\\mu'],
  ['ν', '\\nu'], ['ξ', '\\xi'], ['π', '\\pi'], ['ρ', '\\rho'],
  ['σ', '\\sigma'], ['τ', '\\tau'], ['υ', '\\upsilon'], ['φ', '\\phi'],
  ['χ', '\\chi'], ['ψ', '\\psi'], ['ω', '\\omega'],
];

/** Convert Word's _(expr) / ^(expr) notation to LaTeX _{expr} / ^{expr}. */
function convertSubSupParens(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    if ((text[i] === '_' || text[i] === '^') && text[i + 1] === '(') {
      result += text[i] + '{';
      i += 2;
      let depth = 1;
      while (i < text.length) {
        if (text[i] === '(') { depth++; result += text[i++]; }
        else if (text[i] === ')') {
          depth--;
          if (depth === 0) { result += '}'; i++; break; }
          result += text[i++];
        } else {
          result += text[i++];
        }
      }
    } else {
      result += text[i++];
    }
  }
  return result;
}

/** Returns true if the text contains Word linear math patterns. */
function hasMathContent(text: string): boolean {
  if (/[_^]\(/.test(text)) return true;
  if (/[⟹⟺→↦⇒⇐⇔≤≥≠≈∈∉⊆⊂∪∩∅∀∃∞∂±×÷∑∏∫√]/.test(text)) return true;
  if (/[αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΥΦΨΩ]/.test(text)) return true;
  if (text.includes('█')) return true; // Word matrix/vector notation
  // Inline equation: variable=expression, e.g. f=..., N=(V,E,c,s,t)
  if (/[a-zA-Z]\s*=\s*[a-zA-Z0-9(\\]/.test(text)) return true;
  // Fraction: x/y, (expr)/y, x/(expr), |x|/y
  if (/[a-zA-Z0-9)|]\s*\/\s*[a-zA-Z0-9(|]/.test(text)) return true;
  return false;
}

const HEBREW_RE = /[\u0590-\u05FF\u05BE\u05C0\u05C3\u05C6\uFB1D-\uFB4E]/;
const MATH_SIGNAL_RE = /[_^{}\\=|<>']/;

/**
 * Walk through converted text and wrap "math islands" in $...$.
 * Math islands are non-Hebrew sequences that contain at least one math signal.
 * Spaces inside {} and spaces followed by '(' (function application) are
 * kept inside the island.
 */
function wrapMathIslands(text: string): string {
  let result = '';
  let i = 0;

  while (i < text.length) {
    // Hebrew run — copy as-is
    if (HEBREW_RE.test(text[i])) {
      while (i < text.length && HEBREW_RE.test(text[i])) result += text[i++];
      continue;
    }
    // Newline — copy as-is
    if (text[i] === '\n' || text[i] === '\r') { result += text[i++]; continue; }
    // Space — copy as-is (spaces *outside* math are separators)
    if (/[ \t]/.test(text[i])) { result += text[i++]; continue; }

    // Potential math / plain token — collect greedily
    let seg = '';
    let braceDepth = 0;
    let hasMathSignal = false;

    while (i < text.length) {
      const ch = text[i];
      if (HEBREW_RE.test(ch) || ch === '\n' || ch === '\r') break;

      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
      if (MATH_SIGNAL_RE.test(ch)) hasMathSignal = true;

      if (/[ \t]/.test(ch)) {
        if (braceDepth > 0) { seg += text[i++]; continue; } // inside {}, always continue

        // Lookahead past spaces
        let j = i;
        while (j < text.length && /[ \t]/.test(text[j])) j++;
        if (j >= text.length || HEBREW_RE.test(text[j]) || /[\n\r]/.test(text[j])) break;

        // Continue if: we already have a math signal AND the next token looks like math
        if (hasMathSignal && /[|(+\-=<>a-zA-Z0-9\\{]/.test(text[j])) {
          seg += ch; i++; continue;
        }
        break;
      }

      seg += text[i++];
    }

    if (!seg) continue;

    if (hasMathSignal) {
      const trimmed = seg.trimStart().trimEnd();
      // Strip trailing sentence punctuation (but not math punctuation like })
      const stripped = trimmed.replace(/[.,:;!?]+$/, '');
      const punct = trimmed.slice(stripped.length);
      // Use display math ($$) for block environments like \begin{pmatrix}
      if (/\\begin\{/.test(stripped)) {
        result += `$$${stripped}$$${punct}`;
      } else {
        result += `$${stripped}$${punct}`;
      }
    } else {
      result += seg;
    }
  }

  return result;
}

/**
 * Scan backwards from the end of `text` to extract one math token.
 * Returns [startIndex, content]. Outer parens are stripped (they were grouping for the fraction).
 */
function scanTokenBack(text: string): [number, string] {
  const origLen = text.length;
  if (origLen === 0) return [0, ''];
  let pos = origLen;

  while (pos > 0) {
    const ch = text[pos - 1];

    if (ch === ')') {
      let depth = 1; let j = pos - 2;
      while (j >= 0 && depth > 0) {
        if (text[j] === ')') depth++;
        else if (text[j] === '(') depth--;
        j--;
      }
      if (depth !== 0) break;
      const pStart = j + 1;
      if (pos === origLen) return [pStart, text.slice(pStart + 1, pos - 1)]; // strip outer parens
      pos = pStart; continue;
    }

    if (ch === '}') {
      let depth = 1; let j = pos - 2;
      while (j >= 0 && depth > 0) {
        if (text[j] === '}') depth++;
        else if (text[j] === '{') depth--;
        j--;
      }
      if (depth !== 0) break;
      pos = j + 1;
      if (pos > 0 && (text[pos - 1] === '_' || text[pos - 1] === '^')) pos--;
      continue;
    }

    if (ch === '|' && pos === origLen) {
      let j = pos - 2;
      while (j >= 0 && text[j] !== '|') j--;
      if (j >= 0) return [j, text.slice(j, pos)];
      break;
    }

    if (/[a-zA-Z0-9\\']/.test(ch)) { pos--; continue; }
    break;
  }

  if (pos === origLen) return [origLen, ''];
  return [pos, text.slice(pos, origLen)];
}

/**
 * Scan forwards from `start` to extract one math token.
 * Returns [endIndex, content]. Outer parens are stripped.
 */
function scanTokenFwd(text: string, start: number): [number, string] {
  if (start >= text.length) return [start, ''];
  const ch = text[start];

  if (ch === '(') {
    let depth = 1; let j = start + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '(') depth++;
      else if (text[j] === ')') depth--;
      j++;
    }
    return [j, text.slice(start + 1, j - 1)]; // strip outer parens
  }

  if (ch === '{') {
    let depth = 1; let j = start + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    return [j, text.slice(start, j)];
  }

  if (ch === '|') {
    let j = start + 1;
    while (j < text.length && text[j] !== '|') j++;
    if (j < text.length) return [j + 1, text.slice(start, j + 1)];
    return [start + 1, ch];
  }

  // Atom: letters, digits, LaTeX commands, trailing sub/superscripts
  let end = start;
  while (end < text.length) {
    const c = text[end];
    if (/[a-zA-Z0-9\\']/.test(c)) { end++; continue; }
    if ((c === '_' || c === '^') && text[end + 1] === '{') {
      let depth = 1; let j = end + 2;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      end = j; continue;
    }
    if ((c === '_' || c === '^') && end + 1 < text.length && /[a-zA-Z0-9]/.test(text[end + 1])) {
      end += 2; continue;
    }
    break;
  }
  if (end === start) return [start, ''];
  return [end, text.slice(start, end)];
}

/**
 * Convert slash-fractions to \frac{}{} using a balanced-paren parser.
 * Handles nested parens, |...|, and chained sub/superscripts.
 */
function convertFractions(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '/' || text[i + 1] === '/') { result += text[i++]; continue; }

    const [numStart, num] = scanTokenBack(result);
    const [denomEnd, denom] = scanTokenFwd(text, i + 1);

    if (num && denom) {
      result = result.slice(0, numStart) + `\\frac{${num}}{${denom}}`;
      i = denomEnd;
    } else {
      result += text[i++];
    }
  }
  return result;
}

/** Split `inner` by '@' at depth 0 (not inside parens/braces). */
function splitMatrixRows(inner: string): string[] {
  const rows: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '(' || ch === '{') depth++;
    else if (ch === ')' || ch === '}') depth--;
    else if (ch === '@' && depth === 0) { rows.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  rows.push(current.trim());
  return rows.filter(Boolean);
}

/**
 * Convert Word's █(row1@row2@row3) matrix/vector notation to \begin{pmatrix}...\end{pmatrix}.
 * Uses balanced-paren scanning so rows containing P(x), f(x), etc. are handled correctly.
 */
function convertWordMatrices(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '█' && text[i + 1] === '(') {
      i += 2;
      let depth = 1;
      let inner = '';
      while (i < text.length) {
        if (text[i] === '(') { depth++; inner += text[i++]; }
        else if (text[i] === ')') {
          depth--;
          if (depth === 0) { i++; break; }
          inner += text[i++];
        } else {
          inner += text[i++];
        }
      }
      const rows = splitMatrixRows(inner);
      result += `\\begin{pmatrix} ${rows.join(' \\\\ ')} \\end{pmatrix}`;
    } else {
      result += text[i++];
    }
  }
  // Strip redundant outer () wrapping a matrix: (\begin{pmatrix}...\end{pmatrix}) → \begin{...}...\end{...}
  result = result.replace(/\(\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}\)/g, '\\begin{$1}$2\\end{$1}');
  return result;
}

/** Full pipeline: Word linear text → LaTeX with $...$ wrapping. */
function wordMathToLatex(text: string): string {
  // 1. _(parens) → _{curly}, ^(parens) → ^{curly}
  text = convertSubSupParens(text);
  // 2. Word prime notation: ^' → '
  text = text.replace(/\^'/g, "'");
  // 3. Unicode math symbols → LaTeX macros
  for (const [from, to] of UNICODE_TO_LATEX) text = text.split(from).join(to);
  // 4. Trim spaces inside {} (Word sometimes adds spacing there)
  text = text.replace(/\{([^{}]*)\}/g, (_, inner) => `{${inner.trim()}}`);
  // 5. Capital set letters before ^ → \mathbb: C^n → \mathbb{C}^n, R^n, Z^n, etc.
  text = text.replace(/\b([CRNZQ])\^/g, '\\mathbb{$1}^');
  // Also after \in without ^: \in C → \in \mathbb{C}
  text = text.replace(/\\in\s+([CRNZQ])(?=[^a-zA-Z0-9]|$)/g, '\\in \\mathbb{$1}');
  // 6. Word matrix/vector notation: █(r1@r2@r3) → \begin{pmatrix}...\end{pmatrix}
  text = convertWordMatrices(text);
  // 7. Remove spaces before ) – Word formatting artifact (e.g. P(\omega_n ) → P(\omega_n))
  text = text.replace(/ +\)/g, ')');
  // 8. Convert fractions: a/b → \frac{a}{b}
  text = convertFractions(text);
  // 9. Wrap math islands in $...$ (or $$...$$ for block environments)
  return wrapMathIslands(text);
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

interface Btn {
  label: string;
  title: string;
  insert: string;
  wrapWith?: [string, string];
}

const GROUPS: { name: string; buttons: Btn[] }[] = [
  {
    name: 'Aa',
    buttons: [
      { label: 'B', title: 'Bold **...**', insert: '****', wrapWith: ['**', '**'] },
      { label: 'I', title: 'Italic *...*', insert: '**', wrapWith: ['*', '*'] },
      { label: 'U', title: 'Underline __...__', insert: '____', wrapWith: ['__', '__'] },
      { label: 'S', title: 'Strikethrough ~~...~~', insert: '~~~~', wrapWith: ['~~', '~~'] },
    ],
  },
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
  const [wordMathEnabled, setWordMathEnabled] = useState(false);
  const [dir, setDir] = useState<'ltr' | 'rtl'>(() =>
    /[\u0590-\u05FF\u0600-\u06FF]/.test(value) ? 'rtl' : 'ltr'
  );

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

    if (e.key === 'Tab') {
      e.preventDefault();
      const div = divRef.current;
      if (!div) return;
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!range.collapsed) range.deleteContents();
      const spaces = '\u00a0\u00a0';
      let newRange: Range;
      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer as Text;
        const offset = range.startOffset;
        textNode.nodeValue = (textNode.nodeValue ?? '').slice(0, offset) + spaces + (textNode.nodeValue ?? '').slice(offset);
        newRange = document.createRange();
        newRange.setStart(textNode, offset + spaces.length);
        newRange.collapse(true);
      } else {
        const textNode = document.createTextNode(spaces);
        const ref = range.startContainer.childNodes[range.startOffset] ?? null;
        range.startContainer.insertBefore(textNode, ref);
        newRange = document.createRange();
        newRange.setStart(textNode, spaces.length);
        newRange.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(newRange);
      onChange(divToValue(div));
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

  // ── Paste: convert Word math (MathML or linear notation) to $latex$ ──
  function pasteText(text: string) {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    const newRange = document.createRange();
    newRange.setStartAfter(node);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    onChange(divToValue(divRef.current!));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');

    // Case 1: Word equation objects → MathML in HTML
    if (wordMathEnabled && html?.includes('<math')) {
      e.preventDefault();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('math').forEach((math) => {
        try { math.replaceWith(`$${MathMLToLaTeX.convert(math.outerHTML)}$`); }
        catch { math.replaceWith(math.textContent ?? ''); }
      });
      pasteText(doc.body.innerText ?? doc.body.textContent ?? '');
      return;
    }

    // Case 2: Word linear/UnicodeMath notation (x_(y), Δ, ⟹, etc.)
    if (wordMathEnabled && plain && hasMathContent(plain)) {
      e.preventDefault();
      pasteText(wordMathToLatex(plain));
      return;
    }

    // Case 3: plain text / non-math — let browser handle
  }

  function handleInput() {
    if (divRef.current) {
      const val = divToValue(divRef.current);
      onChange(val);
      setDir(/[\u0590-\u05FF\u0600-\u06FF]/.test(val) ? 'rtl' : 'ltr');
    }
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
        <button
          type="button"
          title={wordMathEnabled ? 'Auto-convert math when pasting from Word (click to disable)' : 'Auto-convert math when pasting from Word (click to enable)'}
          onMouseDown={(e) => { e.preventDefault(); setWordMathEnabled(v => !v); }}
          className={`ml-auto mr-2 mb-0.5 px-2 py-0.5 text-xs rounded border transition-colors whitespace-nowrap ${
            wordMathEnabled
              ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
              : 'bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200'
          }`}
        >
          W→𝑥
        </button>
      </div>

      {/* Buttons */}
      <div className="bg-gray-50 border-b border-gray-200 px-2 py-1.5 flex flex-wrap gap-1">
        {GROUPS[activeGroup].buttons.map((btn) => (
          <button
            key={btn.title}
            type="button"
            title={btn.title}
            onMouseDown={(e) => { e.preventDefault(); insertSnippet(btn); }}
            className={`px-1.5 py-0.5 text-sm bg-white border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 text-gray-700 min-w-[2rem] text-center leading-tight ${
              btn.title.startsWith('Bold') ? 'font-bold' :
              btn.title.startsWith('Italic') ? 'italic font-serif' :
              btn.title.startsWith('Underline') ? 'underline' :
              btn.title.startsWith('Strikethrough') ? 'line-through' :
              'font-mono'
            }`}
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
        onPaste={handlePaste}
        onClick={handleClick}
        dir={dir}
        data-placeholder={placeholder}
        style={{ minHeight: `${rows * 1.6}rem`, whiteSpace: 'pre-wrap' }}
        className="px-3 py-2 text-sm focus:outline-none leading-relaxed
          before:content-[attr(data-placeholder)] before:text-gray-400 before:pointer-events-none
          [&:not(:empty)]:before:hidden
          [&_.math-span]:cursor-pointer [&_.math-span]:inline-block [&_.math-span]:align-middle
          [&_.math-span:hover]:outline [&_.math-span:hover]:outline-1 [&_.math-span:hover]:outline-blue-300 [&_.math-span:hover]:rounded"
      />
    </div>
  );
}
