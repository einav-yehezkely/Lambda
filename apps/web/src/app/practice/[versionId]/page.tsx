'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { practiceApi } from '@/lib/api/practice';
import { useAuth } from '@/hooks/useAuth';
import { LatexContent } from '@/components/content/latex-content';
import { CommunitySolutions } from '@/components/content/community-solutions';
import { ReportErrorButton } from '@/components/content/report-error';
import type { VersionContentItem, PracticeMode, ProgressStatus } from '@lambda/shared';

const MODES: { value: PracticeMode; label: string; description: string }[] = [
  { value: 'spaced_repetition', label: 'Spaced Repetition', description: 'Prioritizes items you need to review' },
  { value: 'random', label: 'Random', description: 'All items in random order' },
  { value: 'exam', label: 'Exam Mode', description: 'Shuffled, simulates exam conditions' },
  { value: 'topic', label: 'By Topic', description: 'Go through items in topic order' },
];

const TYPE_LABEL: Record<string, string> = {
  proof: 'Proof',
  exam_question: 'Exam',
  exercise_question: 'Exercise',
  algorithm: 'Algorithm',
  other: 'Other',
};

const TYPE_COLOR: Record<string, string> = {
  proof: 'bg-purple-100 text-purple-700',
  exam_question: 'bg-blue-100 text-blue-700',
  exercise_question: 'bg-orange-100 text-orange-700',
  algorithm: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-600',
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'text-green-600',
  medium: 'text-yellow-600',
  hard: 'text-red-600',
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
  const [mode, setMode] = useState<PracticeMode>('spaced_repetition');
  const [items, setItems] = useState<VersionContentItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [error, setError] = useState('');

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-gray-600 mb-4">Sign in to start a practice session.</p>
        <Link href="/" className="text-sm text-gray-900 underline">
          Go home
        </Link>
      </div>
    );
  }

  // ─── Start session ───────────────────────────────────────────────────────────

  const startSession = async () => {
    setPhase('loading');
    setError('');
    try {
      const data = await practiceApi.getSession({ version_id: versionId, mode });
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

  // ─── Submit outcome ──────────────────────────────────────────────────────────

  const submitOutcome = async (outcome: ProgressStatus) => {
    const item = items[index];
    const timeSpent = Math.round((Date.now() - startedAt) / 1000);

    setResults((prev) => [...prev, { content_item_id: item.content_item_id, outcome }]);

    try {
      await practiceApi.submitAttempt({
        content_item_id: item.content_item_id,
        is_correct: outcome === 'solved',
        status: outcome,
        time_spent_seconds: timeSpent,
      });
    } catch {
      // Non-blocking — don't interrupt the session
    }

    if (index + 1 >= items.length) {
      setPhase('done');
    } else {
      setIndex((i) => i + 1);
      setRevealed(false);
      setSelectedOption(null);
      setStartedAt(Date.now());
    }
  };

  // ─── Setup screen ────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <Link href={`/`} className="text-sm text-gray-400 hover:text-gray-600">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Practice Session</h1>
        </div>

        <div className="space-y-2 mb-6">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                mode === m.value
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm text-gray-900">{m.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{m.description}</div>
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <button
          onClick={startSession}
          className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700"
        >
          Start
        </button>
      </div>
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return <div className="text-sm text-gray-400">Loading session...</div>;
  }

  // ─── Done screen ─────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const total = results.length;
    const solved = results.filter((r) => r.outcome === 'solved').length;
    const incorrect = results.filter((r) => r.outcome === 'incorrect').length;
    const review = results.filter((r) => r.outcome === 'needs_review').length;
    const skipped = results.filter((r) => r.outcome === 'skipped').length;

    return (
      <div className="max-w-md mx-auto mt-10 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Session complete</h1>
        <p className="text-gray-500 text-sm mb-8">{total} items reviewed</p>

        <div className="grid grid-cols-2 gap-3 mb-8 text-left">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{solved}</div>
            <div className="text-xs text-gray-500 mt-0.5">Correct</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-500">{incorrect}</div>
            <div className="text-xs text-gray-500 mt-0.5">Incorrect</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-500">{review}</div>
            <div className="text-xs text-gray-500 mt-0.5">Needs Review</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-400">{skipped}</div>
            <div className="text-xs text-gray-500 mt-0.5">Skipped</div>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => { setPhase('setup'); setItems([]); }}
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            New session
          </button>
          <Link
            href={`/`}
            className="text-sm border border-gray-300 px-4 py-2 rounded-md hover:border-gray-500"
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-900 rounded-full transition-all"
            style={{ width: `${((index) / items.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 shrink-0">{index + 1} / {items.length}</span>
      </div>

      {/* Card */}
      <div className="border border-gray-200 rounded-xl p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 leading-snug"><LatexContent content={ci.title} /></h2>
          <div className="flex items-center gap-1.5 shrink-0">
            {ci.difficulty && (
              <span className={`text-xs font-medium ${DIFFICULTY_COLOR[ci.difficulty]}`}>
                {ci.difficulty}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[ci.type]}`}>
              {TYPE_LABEL[ci.type]}
            </span>
          </div>
        </div>

        {/* Tags */}
        {ci.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {ci.tags.map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="text-gray-700 mb-6 leading-relaxed">
          <LatexContent content={ci.content} />
        </div>

        {/* Solution / MC options */}
        {ci.metadata?.question_format === 'multiple_choice' ? (
          <div>
            {/* Option buttons — before selection */}
            {!revealed && (
              <div className="space-y-2">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                  const sec = ci.metadata?.sections?.find((s) => s.label === `Option ${opt}`);
                  if (!sec) return null;
                  return (
                    <button
                      key={opt}
                      onClick={() => { setSelectedOption(opt); setRevealed(true); }}
                      className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-gray-200 text-sm hover:border-gray-400 transition-colors"
                    >
                      <span className="font-semibold text-gray-500 shrink-0">{opt}.</span>
                      <div className="text-gray-700"><LatexContent content={sec.content} /></div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* After selection — highlighted options + outcome buttons */}
            {revealed && (
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
                        className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                          isCorrect
                            ? 'border-green-500 bg-green-50'
                            : isSelected
                            ? 'border-red-400 bg-red-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <span className={`font-semibold shrink-0 ${isCorrect ? 'text-green-600' : isSelected ? 'text-red-500' : 'text-gray-500'}`}>
                          {opt}.
                        </span>
                        <div className={isCorrect ? 'text-green-700' : isSelected ? 'text-red-700' : 'text-gray-600'}>
                          <LatexContent content={sec.content} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <ReportErrorButton contentItemId={ci.id} />

                <button
                  onClick={() => submitOutcome(selectedOption === ci.metadata?.correct_option ? 'solved' : 'incorrect')}
                  className="w-full mt-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        ) : !revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            Reveal solution
          </button>
        ) : (
          <div>
            {ci.solution ? (
              <div className="bg-gray-50 rounded-lg p-4 mb-5">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Solution
                </div>
                <div className="text-sm text-gray-700 leading-relaxed"><LatexContent content={ci.solution} /></div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 mb-5 text-sm text-gray-400">
                No official solution available. Add your own below.
              </div>
            )}

            {ci.metadata?.question_format !== 'flashcard' && (
              <CommunitySolutions contentItemId={ci.id} />
            )}

            <ReportErrorButton contentItemId={ci.id} />

            {/* Outcome buttons */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                onClick={() => submitOutcome('solved')}
                className="py-2 px-3 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                Correct
              </button>
              <button
                onClick={() => submitOutcome('incorrect')}
                className="py-2 px-3 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                Incorrect
              </button>
              <button
                onClick={() => submitOutcome('needs_review')}
                className="py-2 px-3 rounded-lg text-sm font-medium bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
              >
                Review later
              </button>
              <button
                onClick={() => submitOutcome('skipped')}
                className="py-2 px-3 rounded-lg text-sm font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
