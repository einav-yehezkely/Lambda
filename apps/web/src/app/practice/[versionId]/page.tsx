'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { practiceApi, type PracticeOptions, type ProgressCounts } from '@/lib/api/practice';
import { useAuth } from '@/hooks/useAuth';
import { LatexContent } from '@/components/content/latex-content';
import { FlashCard } from '@/components/content/flash-card';
import { CommunitySolutions } from '@/components/content/community-solutions';
import { ReportErrorButton } from '@/components/content/report-error';
import type { VersionContentItem, PracticeMode, ProgressStatus } from '@lambda/shared';
import type { TopicCounts } from '@/lib/api/practice';
import { sendGAEvent } from '@next/third-parties/google';

// ─── Content type definitions (what to practice) ──────────────────────────────

interface ContentType {
  id: string;
  label: string;
  description: string;
  icon: string;
  mode: PracticeMode;
  type?: string;
}

const CONTENT_TYPES: ContentType[] = [
  { id: 'exam',    label: 'Exam Questions',     description: 'Past exam questions only',                   icon: '📝', mode: 'exam',              type: 'exam_question' },
  { id: 'practice',label: 'Practice Questions', description: 'Exercise questions only',                     icon: '✏️', mode: 'random',            type: 'exercise_question' },
  { id: 'mixed',   label: 'Mixed Questions',    description: 'All exam & practice questions, random order', icon: '🔀', mode: 'random',            type: 'exam_question,exercise_question' },
  { id: 'review',  label: 'General Review',     description: 'All materials — prioritizes items that need review', icon: '🔁', mode: 'spaced_repetition' },
];

function getContentTypeCount(ct: ContentType, counts: PracticeOptions['counts']): number {
  if (ct.id === 'exam')     return counts.exam_question;
  if (ct.id === 'practice') return counts.exercise_question;
  if (ct.id === 'mixed')    return counts.exam_question + counts.exercise_question;
  return counts.total; // review
}

// ─── Format filter definitions (multi-select) ─────────────────────────────────

const FORMAT_OPTIONS = [
  { id: 'flashcard',       label: 'Flashcards',     icon: '🃏' },
  { id: 'multiple_choice', label: 'Multiple Choice', icon: '🔘' },
  { id: 'open',            label: 'Open',            icon: '📄' },
] as const;

type FormatId = typeof FORMAT_OPTIONS[number]['id'];

// ─── Progress filter definitions ──────────────────────────────────────────────

const EXAM_PROGRESS_FILTERS = [
  { id: 'unseen',    label: 'Unseen' },
  { id: 'incorrect', label: 'Not Solved' },
  { id: 'solved',    label: 'Solved' },
] as const;

const PRACTICE_PROGRESS_FILTERS: { id: string; label: string; statusId?: string }[] = [
  { id: 'unseen',       label: 'Unseen' },
  { id: 'incorrect',    label: 'Not Solved' },
  { id: 'solved',       label: 'Solved' },
  { id: 'needs_review', label: 'Hard' },
  { id: 'ok',           label: 'OK' },
  { id: 'easy',         label: 'Easy' },
];

const MIXED_PROGRESS_FILTERS: { id: string; label: string; statusId?: string }[] = [
  { id: 'unseen',       label: 'Unseen' },
  { id: 'incorrect',    label: 'Not Solved' },
  { id: 'solved',       label: 'Solved' },
  { id: 'needs_review', label: 'Hard' },
  { id: 'ok',           label: 'OK' },
  { id: 'easy',         label: 'Easy' },
];

function getTopicFmtCount(id: FormatId, t: PracticeOptions['topics'][number], selectedContentType: string): number {
  if (selectedContentType === 'review') return t.counts[id];
  if (selectedContentType === 'mixed') return t.counts.format_by_type.exam_question[id] + t.counts.format_by_type.exercise_question[id];
  const tk = selectedContentType === 'exam' ? 'exam_question' : 'exercise_question';
  return t.counts.format_by_type[tk][id];
}

function getGlobalFmtCount(id: FormatId, counts: PracticeOptions['counts'], selectedContentType: string): number {
  if (selectedContentType === 'review') return counts[id];
  if (selectedContentType === 'mixed') return counts.format_by_type.exam_question[id] + counts.format_by_type.exercise_question[id];
  const tk = selectedContentType === 'exam' ? 'exam_question' : 'exercise_question';
  return counts.format_by_type[tk][id];
}

function getFormatCount(
  id: FormatId,
  counts: PracticeOptions['counts'],
  topics: PracticeOptions['topics'],
  selectedContentType: string,
  selectedTopicIds: Set<string>,
  selectedNoTopic = false,
): number {
  const noTopicCount = selectedNoTopic
    ? Math.max(0, getGlobalFmtCount(id, counts, selectedContentType) - topics.reduce((s, t) => s + getTopicFmtCount(id, t, selectedContentType), 0))
    : 0;
  if (selectedTopicIds.size > 0) {
    const sel = topics.filter((t) => selectedTopicIds.has(t.id));
    return sel.reduce((s, t) => s + getTopicFmtCount(id, t, selectedContentType), 0) + noTopicCount;
  }
  if (selectedNoTopic) return noTopicCount;
  return getGlobalFmtCount(id, counts, selectedContentType);
}

function isTopicDisabled(
  tc: TopicCounts,
  selectedContentType: string,
  selectedFormats: Set<FormatId>,
): boolean {
  // Content-type effective count
  let ctCount: number;
  if (selectedContentType === 'exam')     ctCount = tc.exam_question;
  else if (selectedContentType === 'practice') ctCount = tc.exercise_question;
  else if (selectedContentType === 'mixed')    ctCount = tc.exam_question + tc.exercise_question;
  else ctCount = tc.total; // review

  if (ctCount === 0) return true;

  // Format effective count (OR across selected formats), filtered by content type
  if (selectedFormats.size === 0) return false;
  const fmtCount = [...selectedFormats].reduce((sum, fmt) => {
    if (selectedContentType === 'review') {
      return sum + tc[fmt];
    }
    if (selectedContentType === 'mixed') {
      return sum + tc.format_by_type.exam_question[fmt] + tc.format_by_type.exercise_question[fmt];
    }
    const tk = selectedContentType === 'exam' ? 'exam_question' : 'exercise_question';
    return sum + tc.format_by_type[tk][fmt];
  }, 0);
  return fmtCount === 0;
}

function computeProgressCounts(
  counts: PracticeOptions['counts'],
  topics: PracticeOptions['topics'],
  selectedContentType: string,
  selectedTopicIds: Set<string>,
  selectedFormats: Set<FormatId>,
  selectedNoTopic = false,
): ProgressCounts {
  const emptyP = (): ProgressCounts => ({ unseen: 0, incorrect: 0, needs_review: 0, solved: 0, ok: 0, easy: 0 });
  const addP = (a: ProgressCounts, b: ProgressCounts): ProgressCounts => ({
    unseen: a.unseen + b.unseen,
    incorrect: a.incorrect + b.incorrect,
    needs_review: a.needs_review + b.needs_review,
    solved: a.solved + b.solved,
    ok: a.ok + b.ok,
    easy: a.easy + b.easy,
  });
  const subP = (a: ProgressCounts, b: ProgressCounts): ProgressCounts => ({
    unseen: Math.max(0, a.unseen - b.unseen),
    incorrect: Math.max(0, a.incorrect - b.incorrect),
    needs_review: Math.max(0, a.needs_review - b.needs_review),
    solved: Math.max(0, a.solved - b.solved),
    ok: Math.max(0, a.ok - b.ok),
    easy: Math.max(0, a.easy - b.easy),
  });

  // Returns global progress for given content type + format
  const getByTypeFormat = (fmt: FormatId): ProgressCounts => {
    const ptf = counts.progress_by_type_format;
    if (selectedContentType === 'exam')     return ptf.exam_question[fmt];
    if (selectedContentType === 'practice') return ptf.exercise_question[fmt];
    return addP(ptf.exam_question[fmt], ptf.exercise_question[fmt]);
  };

  // Returns global progress for given content type (no format filter)
  const getByType = (): ProgressCounts => {
    if (selectedContentType === 'exam')     return counts.progress_by_type.exam_question;
    if (selectedContentType === 'practice') return counts.progress_by_type.exercise_question;
    if (selectedContentType === 'mixed')    return addP(counts.progress_by_type.exam_question, counts.progress_by_type.exercise_question);
    return counts.progress;
  };

  // Returns per-topic progress for given content type
  const getTopicByType = (t: PracticeOptions['topics'][number]): ProgressCounts => {
    if (selectedContentType === 'exam')     return t.counts.progress_by_type.exam_question;
    if (selectedContentType === 'practice') return t.counts.progress_by_type.exercise_question;
    if (selectedContentType === 'mixed')    return addP(t.counts.progress_by_type.exam_question, t.counts.progress_by_type.exercise_question);
    return t.counts.progress;
  };

  // "No topic" progress = global - sum(all topics)
  const getNoTopicByType = (): ProgressCounts =>
    subP(getByType(), topics.reduce((sum, t) => addP(sum, getTopicByType(t)), emptyP()));

  // Splits a raw ProgressCounts (where 'solved' = all solved) into ok+solved by format.
  // ok = flashcard solved, solved = non-flashcard solved.
  const splitOkSolved = (raw: ProgressCounts, flashcardSolved: number): ProgressCounts => {
    const ok = Math.min(flashcardSolved, raw.solved);
    return { ...raw, ok, solved: raw.solved - ok };
  };

  if (selectedTopicIds.size > 0 || selectedNoTopic) {
    let result = emptyP();
    if (selectedTopicIds.size > 0) {
      result = topics
        .filter((t) => selectedTopicIds.has(t.id))
        .reduce((sum, t) => addP(sum, getTopicByType(t)), result);
    }
    if (selectedNoTopic) result = addP(result, getNoTopicByType());
    // No per-topic flashcard breakdown available — use global flashcard solved as best estimate
    const flashcardSolved = selectedFormats.size > 0 && !selectedFormats.has('flashcard')
      ? 0
      : getByTypeFormat('flashcard').solved;
    return splitOkSolved(result, flashcardSolved);
  }

  // No filter — use precise global counts
  if (selectedFormats.size > 0) {
    const raw = [...selectedFormats].reduce((sum, fmt) => addP(sum, getByTypeFormat(fmt)), emptyP());
    const flashcardSolved = selectedFormats.has('flashcard') ? getByTypeFormat('flashcard').solved : 0;
    return splitOkSolved(raw, flashcardSolved);
  }

  const raw = getByType();
  return splitOkSolved(raw, getByTypeFormat('flashcard').solved);
}

// ─── Display constants ────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  proof: 'Proof',
  exam_question: 'Exam',
  exercise_question: 'Exercise',
  algorithm: 'Algorithm',
  other: 'Other',
};

const TYPE_COLOR: Record<string, string> = {
  proof:             'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  exam_question:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  exercise_question: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  algorithm:         'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  other:             'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
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
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('setup');
  const [withSolution, setWithSolution] = useState(false);
  const [items, setItems] = useState<VersionContentItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [revealedSections, setRevealedSections] = useState<Set<number>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [mcqOutcome, setMcqOutcome] = useState<ProgressStatus | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [error, setError] = useState('');

  // Setup screen state
  const [versionOptions, setVersionOptions] = useState<PracticeOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [selectedContentType, setSelectedContentType] = useState<string>('mixed');
  const [selectedFormats, setSelectedFormats] = useState<Set<FormatId>>(new Set());
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [selectedNoTopic, setSelectedNoTopic] = useState(false);
  const [sessionLength, setSessionLength] = useState<number | null>(10);
  const [progressFilters, setProgressFilters] = useState<Set<string>>(new Set());
  const [reappearedIds, setReappearedIds] = useState<Set<string>>(new Set());
  const [originalItemCount, setOriginalItemCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const cacheKey = `practice_options_${versionId}_${user.id}_${withSolution}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try { setVersionOptions(JSON.parse(cached)); setOptionsLoading(false); } catch {}
    }
    practiceApi
      .getOptions(versionId, withSolution || undefined)
      .then((data) => {
        setVersionOptions(data);
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      })
      .catch(() => {})
      .finally(() => setOptionsLoading(false));
  }, [versionId, user, withSolution]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-slate-500 dark:text-slate-400 mb-4">Sign in to start a practice session.</p>
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
    const ct = CONTENT_TYPES.find((c) => c.id === selectedContentType)!;
    try {
      const data = await practiceApi.getSession({
        version_id: versionId,
        mode: ct.mode,
        type: ct.type,
        question_formats: selectedFormats.size > 0 ? [...selectedFormats] : undefined,
        topic_ids: selectedTopicIds.size > 0 ? [...selectedTopicIds] : undefined,
        no_topic: selectedNoTopic || undefined,
        with_solution: withSolution || undefined,
        limit: activeSessionLength ?? undefined,
        progress_filter: progressFilters.size > 0 ? [...progressFilters].join(',') : undefined,
      });
      if (data.length === 0) {
        setError('No items found for this selection.');
        setPhase('setup');
        return;
      }
      setItems(data);
      setIndex(0);
      setResults([]);
      setRevealed(false);
      setSelectedOptions([]);
      setReappearedIds(new Set());
      setOriginalItemCount(data.length);
      setStartedAt(Date.now());
      setPhase('active');
      sendGAEvent('event', 'practice_started', { version_id: versionId, content_type: selectedContentType, item_count: data.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session');
      setPhase('setup');
    }
  };

  // ─── Submit outcome ───────────────────────────────────────────────────────────

  const submitOutcome = async (outcome: ProgressStatus, requeue?: boolean) => {
    const item = items[index];
    const timeSpent = Math.round((Date.now() - startedAt) / 1000);

    setResults((prev) => [...prev, { content_item_id: item.content_item_id, outcome }]);
    sendGAEvent('event', 'question_answered', { version_id: versionId, outcome });

    // Fire-and-forget — don't await so the UI advances immediately
    practiceApi.submitAttempt({
      version_id: versionId,
      content_item_id: item.content_item_id,
      is_correct: outcome === 'solved' || outcome === 'easy',
      status: outcome,
      time_spent_seconds: timeSpent,
    }).catch(() => {});

    // "Again" → re-add item to end of queue and continue
    const shouldRequeue = requeue ?? (outcome === 'incorrect');
    if (shouldRequeue) {
      setReappearedIds((prev) => new Set([...prev, item.content_item_id]));
      setItems((prev) => [...prev, item]);
      setIndex((i) => i + 1);
      setRevealed(false);
      setRevealedSections(new Set());
      setSelectedOptions([]);
      setMcqOutcome(null);
      setStartedAt(Date.now());
    } else if (index + 1 >= items.length) {
      sendGAEvent('event', 'practice_completed', { version_id: versionId, items_completed: originalItemCount });
      setPhase('done');
    } else {
      setIndex((i) => i + 1);
      setRevealed(false);
      setRevealedSections(new Set());
      setSelectedOptions([]);
      setMcqOutcome(null);
      setStartedAt(Date.now());
    }
  };

  // ─── Advance without re-submitting (used after MCQ auto-submit) ───────────────

  const advanceItem = () => {
    if (index + 1 >= items.length) {
      sendGAEvent('event', 'practice_completed', { version_id: versionId, items_completed: originalItemCount });
      setPhase('done');
    } else {
      setIndex((i) => i + 1);
      setRevealed(false);
      setRevealedSections(new Set());
      setSelectedOptions([]);
      setMcqOutcome(null);
      setStartedAt(Date.now());
    }
  };

  // ─── Toggle format ────────────────────────────────────────────────────────────

  const toggleFormat = (id: FormatId) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTopic = (id: string) => {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ─── Progress counts (updates based on content type + topic selection) ────────
  const progressCounts: ProgressCounts | null = versionOptions
    ? computeProgressCounts(versionOptions.counts, versionOptions.topics, selectedContentType, selectedTopicIds, selectedFormats, selectedNoTopic)
    : null;

  // ─── Effective available count (for session length UI) ────────────────────────
  const effectiveCount: number | null = (() => {
    if (!versionOptions) return null;
    const ct = CONTENT_TYPES.find((c) => c.id === selectedContentType)!;
    let baseCount: number;
    if (selectedFormats.size > 0) {
      baseCount = [...selectedFormats].reduce(
        (sum, fmt) => sum + getFormatCount(fmt, versionOptions.counts, versionOptions.topics, selectedContentType, selectedTopicIds, selectedNoTopic),
        0,
      );
    } else if (selectedTopicIds.size > 0 || selectedNoTopic) {
      const topicSum = versionOptions.topics
        .filter((t) => selectedTopicIds.has(t.id))
        .reduce((sum, t) => {
          if (selectedContentType === 'exam')     return sum + t.counts.exam_question;
          if (selectedContentType === 'practice') return sum + t.counts.exercise_question;
          if (selectedContentType === 'mixed')    return sum + t.counts.exam_question + t.counts.exercise_question;
          return sum + t.counts.total;
        }, 0);
      let noTopicSum = 0;
      if (selectedNoTopic) {
        const allTopicsTotal = versionOptions.topics.reduce((sum, t) => {
          if (selectedContentType === 'exam')     return sum + t.counts.exam_question;
          if (selectedContentType === 'practice') return sum + t.counts.exercise_question;
          if (selectedContentType === 'mixed')    return sum + t.counts.exam_question + t.counts.exercise_question;
          return sum + t.counts.total;
        }, 0);
        noTopicSum = Math.max(0, getContentTypeCount(ct, versionOptions.counts) - allTopicsTotal);
      }
      baseCount = topicSum + noTopicSum;
    } else {
      baseCount = getContentTypeCount(ct, versionOptions.counts);
    }
    if (progressFilters.size > 0 && progressCounts) {
      const progressFilteredCount = [...progressFilters].reduce(
        (sum, f) => sum + (progressCounts[f as keyof ProgressCounts] ?? 0),
        0,
      );
      return Math.min(baseCount, progressFilteredCount);
    }
    return baseCount;
  })();

  // If the chosen session length exceeds what's available, treat it as "All"
  const activeSessionLength =
    sessionLength !== null && effectiveCount !== null && sessionLength > effectiveCount
      ? null
      : sessionLength;

  // ─── Setup screen ─────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Practice Session</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Choose what to practice</p>
        </div>

        {/* ── Content type selection ── */}
        <div className="mb-7">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Content</p>
          {optionsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[72px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {CONTENT_TYPES.map((ct) => {
                const count  = versionOptions ? getContentTypeCount(ct, versionOptions.counts) : null;
                const active = selectedContentType === ct.id;
                const disabled = count !== null && count === 0;
                return (
                  <button
                    key={ct.id}
                    onClick={() => { if (!disabled) { setSelectedContentType(ct.id); setProgressFilters(new Set()); if (ct.id === 'review') setSelectedFormats(new Set()); } }}
                    disabled={disabled}
                    className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 text-left transition-all ${
                      disabled
                        ? 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 opacity-40 cursor-not-allowed'
                        : active
                        ? 'border-[#1e3a8a] bg-[#1e3a8a]/5 shadow-sm'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'
                    }`}
                  >
                    <span className="text-2xl leading-none shrink-0">{ct.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold text-sm ${active && !disabled ? 'text-[#1e3a8a]' : 'text-slate-900 dark:text-white'}`}>
                        {ct.label}
                      </div>
                      {count !== null && (
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums">
                          {ct.id === 'review' ? 'All materials' : `${count} items`}
                        </div>
                      )}
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                      active && !disabled ? 'border-[#1e3a8a]' : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {active && !disabled && <div className="w-2 h-2 rounded-full bg-[#1e3a8a]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Format filter (multi-select) ── */}
        {selectedContentType !== 'review' && <div className="mb-7">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Question format</p>
          {optionsLoading ? (
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 w-24 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* All button */}
              <button
                onClick={() => setSelectedFormats(new Set())}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  selectedFormats.size === 0
                    ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 cursor-pointer'
                }`}
              >
                All
              </button>
              {FORMAT_OPTIONS.map((fmt) => {
                const count    = versionOptions ? getFormatCount(fmt.id, versionOptions.counts, versionOptions.topics, selectedContentType, selectedTopicIds, selectedNoTopic) : null;
                const disabled = count !== null && count === 0;
                const active   = selectedFormats.has(fmt.id);
                return (
                  <button
                    key={fmt.id}
                    onClick={() => !disabled && toggleFormat(fmt.id)}
                    disabled={disabled}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                      disabled
                        ? 'border-slate-100 bg-slate-50 text-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600 cursor-not-allowed'
                        : active
                        ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
                    <span>{fmt.icon}</span>
                    <span>{fmt.label}</span>
                    {count !== null && !disabled && (
                      <span className={`text-[11px] tabular-nums ${active ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>}

        {/* ── Topic filter (multi-select) ── */}
        {(versionOptions?.topics.length ?? 0) > 0 && (
          <div className="mb-7">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Topic</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setSelectedTopicIds(new Set()); setSelectedNoTopic(false); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  selectedTopicIds.size === 0 && !selectedNoTopic
                    ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                }`}
              >
                All topics
              </button>
              <button
                onClick={() => setSelectedNoTopic((v) => !v)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  selectedNoTopic
                    ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                }`}
              >
                No topic
              </button>
              {versionOptions!.topics.map((t) => {
                const disabled = isTopicDisabled(t.counts, selectedContentType, selectedFormats);
                const active   = selectedTopicIds.has(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => !disabled && toggleTopic(t.id)}
                    disabled={disabled}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                      disabled
                        ? 'border-slate-100 bg-slate-50 text-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600 cursor-not-allowed'
                        : active
                        ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Progress filter (exam + practice + mixed) ── */}
        {(selectedContentType === 'exam' || selectedContentType === 'practice' || selectedContentType === 'mixed') && (() => {
          const filters = selectedContentType === 'exam' ? EXAM_PROGRESS_FILTERS
            : selectedContentType === 'practice' ? PRACTICE_PROGRESS_FILTERS
            : MIXED_PROGRESS_FILTERS;
          return (
            <div className="mb-7">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">My progress</p>
              {optionsLoading ? (
                <div className="flex gap-2">
                  {Array.from({ length: filters.length }).map((_, i) => (
                    <div key={i} className="h-8 w-16 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setProgressFilters(new Set())}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                      progressFilters.size === 0
                        ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
                    All
                  </button>
                  {filters.map((pf) => {
                    const countKey = ('statusId' in pf && pf.statusId) ? pf.statusId : pf.id;
                    const count = progressCounts?.[countKey as keyof ProgressCounts] ?? 0;
                    const disabled = count === 0;
                    const active = progressFilters.has(pf.id);
                    return (
                      <button
                        key={pf.id}
                        onClick={() => {
                          if (disabled) return;
                          setProgressFilters((prev) => {
                            const next = new Set(prev);
                            next.has(pf.id) ? next.delete(pf.id) : next.add(pf.id);
                            return next;
                          });
                        }}
                        disabled={disabled}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                          disabled
                            ? 'border-slate-100 bg-slate-50 text-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600 cursor-not-allowed'
                            : active
                            ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 cursor-pointer'
                        }`}
                      >
                        <span>{pf.label}</span>
                        {!disabled && (
                          <span className={`text-[11px] tabular-nums ${active ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Session length ── */}
        <div className="mb-7">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Session length</p>
          <div className="flex flex-wrap gap-2">
            {([5, 10, 20, 50, null] as (number | null)[]).map((n) => {
              const disabled = n !== null && effectiveCount !== null && effectiveCount < n;
              const active   = !disabled && activeSessionLength === n;
              const label    = n === null
                ? effectiveCount !== null ? `All (${effectiveCount})` : 'All'
                : String(n);
              return (
                <button
                  key={n ?? 'all'}
                  onClick={() => !disabled && setSessionLength(n)}
                  disabled={disabled}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    disabled
                      ? 'border-slate-100 bg-slate-50 text-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600 cursor-not-allowed'
                      : active
                      ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Solution toggle ── */}
        <label className="flex items-center gap-3 mb-6 cursor-pointer select-none">
          <div
            onClick={() => setWithSolution((v) => !v)}
            className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 ${withSolution ? 'bg-[#1e3a8a]' : 'bg-slate-200 dark:bg-slate-700'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${withSolution ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <span className="text-sm text-slate-700 dark:text-slate-300">Only questions with solutions</span>
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
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading session...</p>
        </div>
      </div>
    );
  }

  // ─── Done screen ──────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const total = results.length;
    const nAgain    = results.filter((r) => r.outcome === 'incorrect').length;
    const nHard     = results.filter((r) => r.outcome === 'needs_review').length;
    const nOk       = results.filter((r) => r.outcome === 'solved').length;
    const nEasy     = results.filter((r) => r.outcome === 'easy').length;
    const nSkipped  = results.filter((r) => r.outcome === 'skipped').length;
    const pct = total > 0 ? Math.round(((nOk + nEasy) / total) * 100) : 0;

    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8 mt-6">
          <div className="w-20 h-20 rounded-full bg-[#1e3a8a]/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">{pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Session complete</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{total} items reviewed · {pct}% correct</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
            <span>Score</span>
            <span className="text-[#1e3a8a] font-bold text-base">{pct}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1e3a8a] rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-8">
          {[
            { count: nAgain,   label: 'Again',   color: 'text-red-600',     bg: 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/40' },
            { count: nHard,    label: 'Hard',    color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/40' },
            { count: nOk,      label: 'OK',      color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/40' },
            { count: nEasy,    label: 'Easy',    color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/40' },
            { count: nSkipped, label: 'Skipped', color: 'text-slate-400',   bg: 'bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700' },
          ].map(({ count, label, color, bg }) => (
            <div key={label} className={`border rounded-xl p-3 text-center ${bg}`}>
              <div className={`text-2xl font-bold ${color}`}>{count}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setPhase('setup');
              setItems([]);
              practiceApi.getOptions(versionId).then(setVersionOptions).catch(() => {});
            }}
            className="flex-1 bg-[#1e3a8a] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-900 transition-colors"
          >
            New session
          </button>
          <button
            onClick={() => router.back()}
            className="flex-1 text-center border border-slate-300 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:border-slate-400 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ─── Active session ───────────────────────────────────────────────────────────

  const current = items[index];
  const ci = current.content_item;
  const isQuestion = ci.type === 'exam_question' || ci.type === 'exercise_question';
  const isFlashcard = ci.metadata?.question_format === 'flashcard';
  const flashcardFront = ci.metadata?.sections?.find((s) => s.label === 'Front')?.content ?? ci.content;
  const flashcardBack = ci.metadata?.sections?.find((s) => s.label === 'Back')?.content ?? ci.solution ?? '';

  const nonQuestionSections: { label: string; content: string; images?: string[] }[] = !isQuestion
    ? (ci.metadata?.sections?.length ?? 0) > 1
      ? ci.metadata!.sections!.slice(1)
      : ci.solution
        ? [{ label: ci.type === 'proof' ? 'Proof Sketch' : 'Solution', content: ci.solution }]
        : []
    : [];

  const doneCount = results.filter((r) => r.outcome === 'solved' || r.outcome === 'easy').length;
  const progressPct = originalItemCount > 0 ? (doneCount / originalItemCount) * 100 : 0;

  return (
    <>
    <div className="max-w-2xl mx-auto">
      {/* Progress bar + counter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1e3a8a] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0 tabular-nums">{index + 1} / {items.length}</span>
      </div>

      {/* Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-snug flex-1" dir="auto">
              <LatexContent content={ci.title} />
            </h2>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {reappearedIds.has(current.content_item_id) && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-500 border border-red-200 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-400">
                  ↩ Again
                </span>
              )}
              {current.user_progress?.status === 'needs_review' && !reappearedIds.has(current.content_item_id) && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/40 dark:text-amber-400">
                  Hard
                </span>
              )}
              {current.user_progress?.status === 'solved' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/40 dark:text-emerald-400">
                  OK
                </span>
              )}
              {current.user_progress?.status === 'easy' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/40 dark:text-blue-400">
                  Easy
                </span>
              )}
              {ci.difficulty && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
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
                <span key={tag} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full dark:bg-slate-800 dark:text-slate-400">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Section 0 images — full-width above card body */}
        {!isFlashcard && (ci.metadata?.sections?.[0]?.images?.length ?? 0) > 0 && (
          <div className="border-b border-slate-200 dark:border-slate-700">
            {ci.metadata!.sections![0].images!.map((url) => (
              <img key={url} src={url} alt="" onClick={() => setLightboxUrl(url)}
                className="w-full block cursor-pointer hover:opacity-90 transition-opacity" />
            ))}
          </div>
        )}

        {/* Card body */}
        <div className="px-6 py-5">
          {!isFlashcard && (
            <div
              className="text-slate-700 dark:text-slate-300 mb-6 leading-relaxed"
              dir={/[\u0590-\u05FF]/.test(ci.content) ? 'rtl' : undefined}
            >
              <LatexContent content={ci.content} />
            </div>
          )}

          {isFlashcard ? (
            <div>
              <FlashCard key={index} front={flashcardFront} back={flashcardBack} onFirstFlip={() => { setRevealed(true); sendGAEvent('event', 'solution_revealed', { version_id: versionId }); }} />
              {revealed ? (
                <>
                  <ReportErrorButton contentItemId={ci.id} />
                  {ci.type === 'exam_question' ? <ExamOutcomeButtons onSubmit={submitOutcome} /> : <OutcomeButtons onSubmit={submitOutcome} />}
                </>
              ) : (
                <SkipButton onSubmit={submitOutcome} />
              )}
            </div>
          ) : ci.metadata?.question_format === 'multiple_choice' ? (
            <div>
              {(() => {
                const raw = ci.metadata?.correct_option;
                const correctOpts = Array.isArray(raw) ? raw : raw ? [raw] : [];
                const optionSecs = ci.metadata?.sections?.filter((s) => /^Option [A-Z]$/.test(s.label)) ?? [];
                return !revealed ? (
                  <div>
                    <div className="space-y-2">
                      {optionSecs.map((sec) => {
                        const letter = sec.label.replace('Option ', '');
                        const isSelected = selectedOptions.includes(letter);
                        return (
                          <button
                            key={letter}
                            onClick={() => setSelectedOptions((prev) => prev.includes(letter) ? prev.filter((o) => o !== letter) : [...prev, letter])}
                            className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl text-sm transition-all group text-start ${isSelected ? 'border-2 border-[#1e3a8a]/50 bg-[#1e3a8a]/5' : 'border border-slate-200 dark:border-slate-700 hover:border-[#1e3a8a]/40 hover:bg-[#1e3a8a]/5'}`}
                          >
                            <span className={`font-bold shrink-0 transition-colors ${isSelected ? 'text-[#1e3a8a]' : 'text-slate-400 dark:text-slate-500 group-hover:text-[#1e3a8a]'}`}>{letter}</span>
                            <div className="flex-1 text-slate-700 dark:text-slate-300" dir={/[\u0590-\u05FF]/.test(sec.content) ? 'rtl' : undefined}>
                              <LatexContent content={sec.content} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedOptions.length > 0 && (
                      <button
                        onClick={() => {
                          const isAnswerCorrect =
                            correctOpts.length > 0 &&
                            correctOpts.every((o) => selectedOptions.includes(o)) &&
                            selectedOptions.every((o) => correctOpts.includes(o));
                          const outcome: ProgressStatus = isAnswerCorrect ? 'solved' : 'incorrect';
                          const item = items[index];
                          const timeSpent = Math.round((Date.now() - startedAt) / 1000);
                          setResults((prev) => [...prev, { content_item_id: item.content_item_id, outcome }]);
                          practiceApi.submitAttempt({
                            version_id: versionId,
                            content_item_id: item.content_item_id,
                            is_correct: outcome === 'solved',
                            status: outcome,
                            time_spent_seconds: timeSpent,
                          }).catch(() => {});
                          setMcqOutcome(outcome);
                          setRevealed(true);
                          sendGAEvent('event', 'question_answered', { version_id: versionId, outcome });
                          sendGAEvent('event', 'solution_revealed', { version_id: versionId });
                        }}
                        className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold bg-[#1e3a8a] text-white hover:bg-[#1e3a8a]/90 transition-colors"
                      >
                        Check
                      </button>
                    )}
                    <SkipButton onSubmit={submitOutcome} />
                  </div>
                ) : (
                  <div>
                    {(() => {
                      const isAnswerCorrect =
                        correctOpts.length > 0 &&
                        correctOpts.every((o) => selectedOptions.includes(o)) &&
                        selectedOptions.every((o) => correctOpts.includes(o));
                      return (
                        <>
                          <div className="space-y-2 mb-5">
                            {optionSecs.map((sec) => {
                              const letter = sec.label.replace('Option ', '');
                              const isCorrect = correctOpts.includes(letter);
                              const isSelected = selectedOptions.includes(letter);
                              return (
                                <div
                                  key={letter}
                                  className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm ${
                                    isCorrect && isSelected ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' :
                                    isCorrect ? 'border border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20' :
                                    isSelected ? 'border-2 border-red-400 bg-red-50 dark:bg-red-900/20' :
                                    'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                                  }`}
                                >
                                  <span className={`font-bold shrink-0 ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : isSelected ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {letter}
                                  </span>
                                  <div className={`flex-1 ${isCorrect ? 'text-emerald-700 dark:text-emerald-300' : isSelected ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-300'}`} dir={/[\u0590-\u05FF]/.test(sec.content) ? 'rtl' : undefined}>
                                    <LatexContent content={sec.content} />
                                  </div>
                                  <div className="ml-auto flex items-center gap-1 shrink-0">
                                    {isCorrect && (
                                      <span className="text-emerald-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </span>
                                    )}
                                    {isSelected && !isCorrect && (
                                      <span className="text-red-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {ci.metadata?.explanation && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/40">
                              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Explanation</p>
                              <div className="text-sm text-blue-800 dark:text-blue-200" dir={/[\u0590-\u05FF]/.test(ci.metadata.explanation) ? 'rtl' : undefined}>
                                <LatexContent content={ci.metadata.explanation} />
                              </div>
                            </div>
                          )}
                          <ReportErrorButton contentItemId={ci.id} />
                          <div className="mt-4 flex items-center gap-3">
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${mcqOutcome === 'solved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40' : 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40'}`}>
                              {mcqOutcome === 'solved' ? (
                                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Solved</>
                              ) : (
                                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>Not Solved</>
                              )}
                            </div>
                            <button
                              onClick={advanceItem}
                              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                              Continue
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          ) : isQuestion ? (
            !revealed ? (
              <div>
                <button
                  onClick={() => { setRevealed(true); sendGAEvent('event', 'solution_revealed', { version_id: versionId }); }}
                  className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-400 dark:text-slate-500 hover:border-[#1e3a8a]/40 hover:text-[#1e3a8a] hover:bg-[#1e3a8a]/5 transition-all font-medium"
                >
                  Reveal solution
                </button>
                <SkipButton onSubmit={submitOutcome} />
              </div>
            ) : (
              <div>
                {(() => {
                  const solutionSection = ci.metadata?.sections?.find((s) => s.label === 'Solution');
                  const solutionText = ci.solution || solutionSection?.content || '';
                  const solutionImages = (ci.metadata?.sections?.slice(1) ?? []).flatMap((s) => s.images ?? []);
                  return solutionText || solutionImages.length > 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-5">
                      <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 pt-4 mb-2">Solution</div>
                      {solutionImages.map((url) => (
                        <img key={url} src={url} alt="" onClick={() => setLightboxUrl(url)}
                          className="max-w-full h-auto block cursor-pointer hover:opacity-90 transition-opacity" />
                      ))}
                      {solutionText && (
                        <div className="px-4 pb-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed" dir={/[\u0590-\u05FF]/.test(solutionText) ? 'rtl' : undefined}>
                          <LatexContent content={solutionText} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-5 text-sm text-slate-400 dark:text-slate-500">
                      No official solution available. Add your own below.
                    </div>
                  );
                })()}
                {ci.metadata?.question_format !== 'flashcard' && <CommunitySolutions contentItemId={ci.id} />}
                <ReportErrorButton contentItemId={ci.id} />
                {ci.type === 'exam_question' ? <ExamOutcomeButtons onSubmit={submitOutcome} /> : <OutcomeButtons onSubmit={submitOutcome} />}
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
                    className="w-full py-2.5 px-4 flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800 transition-all"
                  >
                    <span className="font-semibold">{sec.label}</span>
                    <svg
                      className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${revealedSections.has(i) ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {revealedSections.has(i) && (
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-t-0 rounded-b-xl overflow-hidden">
                      {(sec.images?.length ?? 0) > 0 && (
                        <div className="border-b border-slate-200 dark:border-slate-700">
                          {sec.images!.map((url) => (
                            <img key={url} src={url} alt="" onClick={() => setLightboxUrl(url)}
                              className="w-full block cursor-pointer hover:opacity-90 transition-opacity" />
                          ))}
                        </div>
                      )}
                      <div className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed" dir={/[\u0590-\u05FF]/.test(sec.content) ? 'rtl' : undefined}>
                        <LatexContent content={sec.content} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {revealed || nonQuestionSections.length === 0 ? (
                <>
                  <ReportErrorButton contentItemId={ci.id} />
                  {ci.type === 'exam_question' ? <ExamOutcomeButtons onSubmit={submitOutcome} /> : <OutcomeButtons onSubmit={submitOutcome} />}
                </>
              ) : (
                <SkipButton onSubmit={submitOutcome} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {lightboxUrl && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        onClick={() => setLightboxUrl(null)}
      >
        <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[90vh] rounded shadow-2xl" />
      </div>
    )}
    </>
  );
}

// ─── Outcome buttons ──────────────────────────────────────────────────────────

type OnSubmit = (outcome: ProgressStatus, requeue?: boolean) => void;

function OutcomeButtons({ onSubmit }: { onSubmit: OnSubmit }) {
  return (
    <div className="grid grid-cols-4 gap-2 mt-4">
      <button
        onClick={() => onSubmit('incorrect')}
        className="py-2.5 px-3 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 dark:border-red-900/40 transition-colors"
      >
        Again
      </button>
      <button
        onClick={() => onSubmit('needs_review')}
        className="py-2.5 px-3 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30 dark:border-amber-900/40 transition-colors"
      >
        Hard
      </button>
      <button
        onClick={() => onSubmit('solved')}
        className="py-2.5 px-3 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 dark:border-emerald-900/40 transition-colors"
      >
        OK
      </button>
      <button
        onClick={() => onSubmit('easy')}
        className="py-2.5 px-3 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:border-blue-900/40 transition-colors"
      >
        Easy
      </button>
    </div>
  );
}

function ExamOutcomeButtons({ onSubmit }: { onSubmit: OnSubmit }) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      <button
        onClick={() => onSubmit('incorrect', false)}
        className="py-2.5 px-3 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 dark:border-red-900/40 transition-colors"
      >
        Not Solved
      </button>
      <button
        onClick={() => onSubmit('solved', false)}
        className="py-2.5 px-3 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 dark:border-emerald-900/40 transition-colors"
      >
        Solved
      </button>
    </div>
  );
}

function SkipButton({ onSubmit }: { onSubmit: OnSubmit }) {
  return (
    <button
      onClick={() => onSubmit('skipped')}
      className="w-full mt-3 py-2 text-sm text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
    >
      Skip
    </button>
  );
}
