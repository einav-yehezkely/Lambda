'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { practiceApi } from '@/lib/api/practice';
import { useAuth } from '@/hooks/useAuth';
import { LatexContent } from '@/components/content/latex-content';
import { CommunitySolutions } from '@/components/content/community-solutions';
import { ReportErrorButton } from '@/components/content/report-error';
import type { VersionContentItem, PracticeMode, ProgressStatus } from '@lambda/shared';

interface SessionType {
  id: string;
  label: string;
  description: string;
  mode: PracticeMode;
  type?: string;
  icon: string;
}

const SESSION_TYPES: SessionType[] = [
  { id: 'exam_questions',     label: 'Exam Questions',     description: 'Exam-style questions only, in random order',           mode: 'exam',              type: 'exam_question', icon: '📝' },
  { id: 'exercise_questions', label: 'Practice Questions', description: 'Exercise questions only, in random order',             mode: 'random',            type: 'exercise_question', icon: '✏️' },
  { id: 'mixed',              label: 'Mixed Questions',    description: 'All question types in random order',                   mode: 'random',            icon: '🔀' },
  { id: 'review',             label: 'General Review',     description: 'All content — prioritizes items that need review',     mode: 'spaced_repetition', icon: '🔁' },
];

const TYPE_LABEL: Record<string, string> = {
  proof: 'Proof',
  exam_question: 'Exam',
  exercise_question: 'Exercise',
  algorithm: 'Algorithm',
  other: 'Other',
};

const TYPE_COLOR: Record<string, string> = {
  proof:             'bg-purple-100 text-purple-700',
  exam_question:     'bg-blue-100 text-blue-700',
  exercise_question: 'bg-amber-100 text-amber-700',
  algorithm:         'bg-teal-100 text-teal-700',
  other:             'bg-slate-100 text-slate-600',
};

const DIFFICULTY_DOT: Record<string, string> = {
  easy:   'bg-emerald-400',
  medium: 'bg-amber-400',
  hard:   'bg-red-400',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy:   'Easy',
  medium: 'Medium',
  hard:   'Hard',
};

type Phase = 'setup' | 'loading' | 'active' | 'done';

interface SessionResult {
  content_item_id: string;
  outcome: ProgressStatus;
}

export default function PracticePage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = use(params);
  const { user, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<Phase>('setup');
  const [sessionType, setSessionType] = useState<SessionType>(SESSION_TYPES[0]);
  const [withSolution, setWithSolution] = useState(false);
  const [items, setItems] = useState<VersionContentItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [revealedSections, setRevealedSections] = useState<Set<number>>(new Set());
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [error, setError] = useState('');

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-slate-500 mb-4">Sign in to start a practice session.</p>
        <Link href="/" className="text-sm text-[#1e3a8a] hover:underline font-medium">
          Go home
        </Link>
      </div>
    );
  }

  // ─── Start session ────────────────────────────────────────────────────────────

  const startSession = async () => {
    setPhase('loading');
    setError('');
    try {
      const data = await practiceApi.getSession({ version_id: versionId, mode: sessionType.mode, type: sessionType.type, with_solution: withSolution || undefined });
      if (data.length === 0) {
        setError('No items found for this version.');
        setPhase('setup');
        return;
      }
      setItems(data);
      setIndex(0);
      setResults([]);
      setRevealed(false);
      setSelectedOption(null);
      setStartedAt(Date.now());
      setPhase('active');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session');
      setPhase('setup');
    }
  };

  // ─── Submit outcome ───────────────────────────────────────────────────────────

  const submitOutcome = async (outcome: ProgressStatus) => {
    const item = items[index];
    const timeSpent = Math.round((Date.now() - startedAt) / 1000);

    setResults((prev) => [...prev, { content_item_id: item.content_item_id, outcome }]);

    try {
      await practiceApi.submitAttempt({
        version_id: versionId,
        content_item_id: item.content_item_id,
        is_correct: outcome === 'solved',
        status: outcome,
        time_spent_seconds: timeSpent,
      });
    } catch {
      // Non-blocking
    }

    if (index + 1 >= items.length) {
      setPhase('done');
    } else {
      setIndex((i) => i + 1);
      setRevealed(false);
      setRevealedSections(new Set());
      setSelectedOption(null);
      setStartedAt(Date.now());
    }
  };

  // ─── Setup screen ─────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Practice Session</h1>
          <p className="text-slate-500 mt-1 text-sm">Choose a session type to get started</p>
        </div>

        <div className="space-y-3 mb-8">
          {SESSION_TYPES.map((s) => {
            const active = sessionType.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSessionType(s)}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                  active
                    ? 'border-[#1e3a8a] bg-[#1e3a8a]/5 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <span className="text-2xl">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${active ? 'text-[#1e3a8a]' : 'text-slate-900'}`}>{s.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.description}</div>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                  active ? 'border-[#1e3a8a]' : 'border-slate-300'
                }`}>
                  {active && <div className="w-2 h-2 rounded-full bg-[#1e3a8a]" />}
                </div>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-3 mb-6 cursor-pointer select-none">
          <div
            onClick={() => setWithSolution((v) => !v)}
            className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 ${withSolution ? 'bg-[#1e3a8a]' : 'bg-slate-200'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${withSolution ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <span className="text-sm text-slate-700">Only questions with solutions</span>
        </label>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <button
          onClick={startSession}
          className="w-full bg-[#1e3a8a] text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-900 transition-colors shadow-sm"
        >
          Start session
        </button>
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1e3a8a] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading session...</p>
        </div>
      </div>
    );
  }

  // ─── Done screen ──────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const total = results.length;
    const solved = results.filter((r) => r.outcome === 'solved').length;
    const incorrect = results.filter((r) => r.outcome === 'incorrect').length;
    const review = results.filter((r) => r.outcome === 'needs_review').length;
    const skipped = results.filter((r) => r.outcome === 'skipped').length;
    const pct = total > 0 ? Math.round((solved / total) * 100) : 0;

    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8 mt-6">
          <div className="w-20 h-20 rounded-full bg-[#1e3a8a]/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">{pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Session complete</h1>
          <p className="text-slate-500 text-sm">{total} items reviewed · {pct}% correct</p>
        </div>

        {/* Score ring / progress */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-500 font-medium uppercase tracking-wide">
            <span>Score</span>
            <span className="text-[#1e3a8a] font-bold text-base">{pct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1e3a8a] rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { count: solved,    label: 'Correct',  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
            { count: incorrect, label: 'Incorrect', color: 'text-red-500',     bg: 'bg-red-50 border-red-100' },
            { count: review,    label: 'Review',    color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
            { count: skipped,   label: 'Skipped',   color: 'text-slate-400',   bg: 'bg-slate-50 border-slate-100' },
          ].map(({ count, label, color, bg }) => (
            <div key={label} className={`border rounded-xl p-3 text-center ${bg}`}>
              <div className={`text-2xl font-bold ${color}`}>{count}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setPhase('setup'); setItems([]); }}
            className="flex-1 bg-[#1e3a8a] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-900 transition-colors"
          >
            New session
          </button>
          <Link
            href="/"
            className="flex-1 text-center border border-slate-300 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:border-slate-400 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    );
  }

  // ─── Active session ───────────────────────────────────────────────────────────

  const current = items[index];
  const ci = current.content_item;
  const isQuestion = ci.type === 'exam_question' || ci.type === 'exercise_question';

  const nonQuestionSections: { label: string; content: string }[] = !isQuestion
    ? (ci.metadata?.sections?.length ?? 0) > 1
      ? ci.metadata!.sections!.slice(1)
      : ci.solution
        ? [{ label: ci.type === 'proof' ? 'Proof Sketch' : 'Solution', content: ci.solution }]
        : []
    : [];

  const progressPct = (index / items.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar + counter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1e3a8a] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-slate-400 font-medium shrink-0 tabular-nums">{index + 1} / {items.length}</span>
      </div>

      {/* Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold text-slate-900 leading-snug flex-1">
              <LatexContent content={ci.title} />
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              {ci.difficulty && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  <span className={`w-1.5 h-1.5 rounded-full ${DIFFICULTY_DOT[ci.difficulty]}`} />
                  {DIFFICULTY_LABEL[ci.difficulty]}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[ci.type]}`}>
                {TYPE_LABEL[ci.type]}
              </span>
            </div>
          </div>

          {ci.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {ci.tags.map((tag) => (
                <span key={tag} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="px-6 py-5">
          {/* Content */}
          <div
            className="text-slate-700 mb-6 leading-relaxed"
            dir={/[\u0590-\u05FF]/.test(ci.content) ? 'rtl' : undefined}
          >
            <LatexContent content={ci.content} />
          </div>

          {/* Solution / MC options */}
          {ci.metadata?.question_format === 'multiple_choice' ? (
            <div>
              {!revealed ? (
                <div className="space-y-2">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const sec = ci.metadata?.sections?.find((s) => s.label === `Option ${opt}`);
                    if (!sec) return null;
                    return (
                      <button
                        key={opt}
                        onClick={() => { setSelectedOption(opt); setRevealed(true); }}
                        className="w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border border-slate-200 text-sm hover:border-[#1e3a8a]/40 hover:bg-[#1e3a8a]/5 transition-all group"
                      >
                        <span className="font-bold text-slate-400 group-hover:text-[#1e3a8a] shrink-0 transition-colors">{opt}</span>
                        <div className="text-slate-700" dir={/[\u0590-\u05FF]/.test(sec.content) ? 'rtl' : undefined}>
                          <LatexContent content={sec.content} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <div className="space-y-2 mb-5">
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                      const sec = ci.metadata?.sections?.find((s) => s.label === `Option ${opt}`);
                      if (!sec) return null;
                      const isCorrect = ci.metadata?.correct_option === opt;
                      const isSelected = selectedOption === opt;
                      return (
                        <div
                          key={opt}
                          className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
                            isCorrect
                              ? 'border-emerald-400 bg-emerald-50'
                              : isSelected
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <span className={`font-bold shrink-0 ${isCorrect ? 'text-emerald-600' : isSelected ? 'text-red-500' : 'text-slate-400'}`}>
                            {opt}
                          </span>
                          <div className={isCorrect ? 'text-emerald-700' : isSelected ? 'text-red-700' : 'text-slate-600'} dir={/[\u0590-\u05FF]/.test(sec.content) ? 'rtl' : undefined}>
                            <LatexContent content={sec.content} />
                          </div>
                          {isCorrect && (
                            <span className="ml-auto shrink-0 text-emerald-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                          {isSelected && !isCorrect && (
                            <span className="ml-auto shrink-0 text-red-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <ReportErrorButton contentItemId={ci.id} />

                  <button
                    onClick={() => submitOutcome(selectedOption === ci.metadata?.correct_option ? 'solved' : 'incorrect')}
                    className="w-full mt-3 py-2.5 bg-[#1e3a8a] text-white rounded-xl text-sm font-semibold hover:bg-blue-900 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          ) : isQuestion ? (
            !revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-[#1e3a8a]/40 hover:text-[#1e3a8a] hover:bg-[#1e3a8a]/5 transition-all font-medium"
              >
                Reveal solution
              </button>
            ) : (
              <div>
                {ci.solution ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Solution</div>
                    <div className="text-sm text-slate-700 leading-relaxed" dir={/[\u0590-\u05FF]/.test(ci.solution ?? '') ? 'rtl' : undefined}>
                      <LatexContent content={ci.solution} />
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 text-sm text-slate-400">
                    No official solution available. Add your own below.
                  </div>
                )}
                {ci.metadata?.question_format !== 'flashcard' && <CommunitySolutions contentItemId={ci.id} />}
                <ReportErrorButton contentItemId={ci.id} />
                <OutcomeButtons isQuestion onSubmit={submitOutcome} />
              </div>
            )
          ) : (
            <div>
              {nonQuestionSections.map((sec, i) => (
                <div key={i} className="mb-3">
                  <button
                    onClick={() => {
                      setRevealedSections((prev) => {
                        const next = new Set(prev);
                        next.has(i) ? next.delete(i) : next.add(i);
                        return next;
                      });
                      setRevealed(true);
                    }}
                    className="w-full py-2.5 px-4 flex items-center justify-between border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all"
                  >
                    <span className="font-semibold">{sec.label}</span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${revealedSections.has(i) ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {revealedSections.has(i) && (
                    <div className="bg-slate-50 border border-slate-200 border-t-0 rounded-b-xl px-4 py-4">
                      <div className="text-sm text-slate-700 leading-relaxed" dir={/[\u0590-\u05FF]/.test(sec.content) ? 'rtl' : undefined}>
                        <LatexContent content={sec.content} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {(revealed || nonQuestionSections.length === 0) && (
                <>
                  <ReportErrorButton contentItemId={ci.id} />
                  <OutcomeButtons isQuestion={false} onSubmit={submitOutcome} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Outcome buttons ──────────────────────────────────────────────────────────

function OutcomeButtons({
  isQuestion,
  onSubmit,
}: {
  isQuestion: boolean;
  onSubmit: (outcome: ProgressStatus) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mt-4">
      <button
        onClick={() => onSubmit('solved')}
        className="py-2.5 px-3 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
      >
        {isQuestion ? 'Correct' : 'Knew it'}
      </button>
      <button
        onClick={() => onSubmit('incorrect')}
        className="py-2.5 px-3 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
      >
        {isQuestion ? 'Incorrect' : "Didn't know"}
      </button>
      <button
        onClick={() => onSubmit('needs_review')}
        className="py-2.5 px-3 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
      >
        Review later
      </button>
      <button
        onClick={() => onSubmit('skipped')}
        className="py-2.5 px-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 transition-colors"
      >
        Skip
      </button>
    </div>
  );
}
