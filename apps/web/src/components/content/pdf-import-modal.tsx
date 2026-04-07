'use client';

import { useState, useRef } from 'react';
import { Modal } from '@/components/ui/modal';
import { LatexContent } from './latex-content';
import { contentApi } from '@/lib/api/content';
import { importPdf, type AiCard } from '@/lib/api/pdf-import';
import type { Topic } from '@lambda/shared';

const TYPE_COLOR: Record<string, string> = {
  proof: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  exam_question: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  exercise_question: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  algorithm: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  other: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400',
};

const TYPE_LABEL: Record<string, string> = {
  proof: 'Proof',
  exam_question: 'Exam',
  exercise_question: 'Exercise',
  algorithm: 'Algorithm',
  other: 'Other',
};

const TOPIC_STRIP_COLORS = [
  '#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51',
  '#457b9d', '#52796f', '#d4956a', '#6b705c', '#a98467',
];

const INPUT_CLS =
  'w-full border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-slate-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100';

const HE_RE = /[\u0590-\u05FF]/;
const hDir = (s?: string | null): 'rtl' | undefined => HE_RE.test(s ?? '') ? 'rtl' : undefined;

type Step = 'upload' | 'processing' | 'review' | 'confirming';
type CardStatus = 'pending' | 'saving' | 'saved' | 'failed';

interface DraftCard extends AiCard {
  id: string;
  removed: boolean;
  editing: boolean;
  editTitle: string;
  editContent: string;
  editSolution: string;
  editType: AiCard['type'];
  editTopicIndex: number | null;
}

interface Props {
  versionId: string;
  topics: Topic[];
  onClose: () => void;
  onImported: (savedTypes: string[]) => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PdfImportModal({ versionId, topics: existingTopics = [], onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [fallbackTopicId, setFallbackTopicId] = useState('');
  const [cards, setCards] = useState<DraftCard[]>([]);
  const [cardStatuses, setCardStatuses] = useState<Record<string, CardStatus>>({});
  const [savedCount, setSavedCount] = useState(0);
  const [failedCards, setFailedCards] = useState<DraftCard[]>([]);
  const [savedTypes, setSavedTypes] = useState<string[]>([]);
  const [importError, setImportError] = useState('');
  const [viewingCardId, setViewingCardId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFileError('');
    if (!f) return;
    if (f.type !== 'application/pdf') { setFileError('Only PDF files are accepted.'); return; }
    if (f.size > 20 * 1024 * 1024) { setFileError('File too large (max 20 MB).'); return; }
    setFile(f);
  }

  async function handleExtract() {
    if (!file) return;
    setImportError('');
    setStep('processing');
    try {
      const topicTitles = existingTopics.map((t) => t.title);
      const result = await importPdf(file, versionId, topicTitles);
      setCards(
        result.cards.map((c, i) => ({
          ...c,
          id: `card-${i}-${Date.now()}`,
          removed: false,
          editing: false,
          editTitle: c.title,
          editContent: c.content,
          editSolution: c.solution ?? '',
          editType: c.type,
          editTopicIndex: c.topic_index,
        })),
      );
      setStep('review');
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setStep('upload');
    }
  }

  function handleCancelProcessing() {
    abortRef.current?.abort();
    setStep('upload');
  }

  function toggleEdit(id: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, editing: !c.editing } : c)));
  }

  function saveEdit(id: string) {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          editing: false,
          title: c.editTitle,
          content: c.editContent,
          solution: c.editSolution || undefined,
          type: c.editType,
          topic_index: c.editTopicIndex,
        };
      }),
    );
  }

  function removeCard(id: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, removed: true } : c)));
  }

  async function handleSaveAll(cardsToSave: DraftCard[]) {
    setStep('confirming');
    setSavedCount(0);
    setFailedCards([]);
    const statuses: Record<string, CardStatus> = {};
    cardsToSave.forEach((c) => (statuses[c.id] = 'pending'));
    setCardStatuses({ ...statuses });

    const topicIdMap: Record<number, string> = {};
    existingTopics.forEach((t, i) => { topicIdMap[i] = t.id; });

    const failed: DraftCard[] = [];
    for (const card of cardsToSave) {
      setCardStatuses((s) => ({ ...s, [card.id]: 'saving' }));
      const resolvedTopicId =
        card.topic_index !== null && topicIdMap[card.topic_index]
          ? topicIdMap[card.topic_index]
          : fallbackTopicId || undefined;
      try {
        await contentApi.createItem({
          version_id: versionId,
          topic_id: resolvedTopicId,
          type: card.type,
          title: card.title,
          content: card.content,
          solution: card.solution,
          metadata: card.metadata,
        });
        setCardStatuses((s) => ({ ...s, [card.id]: 'saved' }));
        setSavedCount((n) => n + 1);
      } catch {
        setCardStatuses((s) => ({ ...s, [card.id]: 'failed' }));
        failed.push(card);
      }
    }
    setFailedCards(failed);
    const successIds = new Set(failed.map((c) => c.id));
    setSavedTypes([...new Set(cardsToSave.filter((c) => !successIds.has(c.id)).map((c) => c.type))]);
  }

  const activeCards = cards.filter((c) => !c.removed);

  // ── Step: upload ──────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <Modal title="Import from PDF" onClose={onClose} className="max-w-lg">
        <div className="space-y-5">
          {importError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {importError}
            </div>
          )}
          <div>
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileChange} />
            {file ? (
              <div className="flex items-center gap-3 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-3">
                <svg className="w-8 h-8 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{formatBytes(file.size)}</p>
                </div>
                <button type="button" onClick={() => { setFile(null); setFileError(''); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg px-6 py-8 text-center hover:border-gray-400 dark:hover:border-slate-500 transition-colors">
                <svg className="w-8 h-8 mx-auto text-gray-400 dark:text-slate-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-300">Click to select a PDF</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">PDF only · max 20 MB</p>
              </button>
            )}
            {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
          </div>

          {existingTopics.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Fallback Topic <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select value={fallbackTopicId} onChange={(e) => setFallbackTopicId(e.target.value)} className={INPUT_CLS}>
                <option value="">No topic</option>
                {existingTopics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Used for cards the AI could not assign to a topic</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
            <button type="button" disabled={!file} onClick={handleExtract} className="px-4 py-2 text-sm font-medium bg-[#1A365D] text-white rounded-lg hover:bg-[#1A365D]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              Extract Cards
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Step: processing ──────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <Modal title="Import from PDF" onClose={onClose} className="max-w-lg">
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="w-10 h-10 border-4 border-gray-200 dark:border-slate-700 border-t-[#1A365D] dark:border-t-blue-400 rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Extracting content with AI...</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">This may take 15–30 seconds for large PDFs.</p>
          </div>
          <button type="button" onClick={handleCancelProcessing} className="mt-2 px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
        </div>
      </Modal>
    );
  }

  // ── Step: review ──────────────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <Modal title={`Review Extracted Cards (${activeCards.length})`} onClose={onClose} className="max-w-2xl">
        <div className="space-y-4">
          {activeCards.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500 dark:text-slate-400">No cards remaining.</div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {cards.map((card) => {
                if (card.removed) return null;
                const topicName =
                  card.topic_index !== null ? (existingTopics[card.topic_index]?.title ?? null) : null;
                const stripColor =
                  card.topic_index !== null
                    ? TOPIC_STRIP_COLORS[card.topic_index % TOPIC_STRIP_COLORS.length]
                    : '#e5e7eb';

                return (
                  <div key={card.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg hover:shadow-sm hover:border-gray-300 dark:hover:border-slate-600 transition-all flex flex-col overflow-hidden">
                    {/* Color strip */}
                    <div className="h-1" style={{ backgroundColor: stripColor }} />

                    {/* Card body — clickable to open view */}
                    <button
                      type="button"
                      onClick={() => setViewingCardId(card.id)}
                      className="text-start px-4 pt-4 pb-3 flex flex-col gap-2 flex-1"
                    >
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-base leading-snug" dir={hDir(card.title)}>
                        {card.title}
                      </span>
                      {topicName && (
                        <span className="text-xs text-gray-400 dark:text-slate-500" dir={hDir(topicName)}>{topicName}</span>
                      )}
                      <div className="flex items-end justify-between gap-2 mt-auto pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[card.type] ?? TYPE_COLOR.other}`}>
                            {TYPE_LABEL[card.type] ?? card.type}
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* Edit / Remove row */}
                    <div className="flex gap-3 px-4 pb-3">
                      <button type="button" onClick={() => toggleEdit(card.id)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
                        {card.editing ? 'Cancel' : 'Edit'}
                      </button>
                      <button type="button" onClick={() => removeCard(card.id)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                        Remove
                      </button>
                    </div>

                    {/* Inline edit form */}
                    {card.editing && (
                      <div className="border-t border-gray-100 dark:border-slate-800 px-4 py-4 space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Type</label>
                            <select value={card.editType} onChange={(e) => setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, editType: e.target.value as AiCard['type'] } : c))} className={INPUT_CLS}>
                              <option value="proof">Proof</option>
                              <option value="exam_question">Exam Question</option>
                              <option value="exercise_question">Exercise</option>
                              <option value="algorithm">Algorithm</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        {existingTopics.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Topic</label>
                            <select
                              value={card.editTopicIndex ?? ''}
                              onChange={(e) => setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, editTopicIndex: e.target.value === '' ? null : Number(e.target.value) } : c))}
                              className={INPUT_CLS}
                            >
                              <option value="">No topic</option>
                              {existingTopics.map((t, i) => <option key={t.id} value={i}>{t.title}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Title</label>
                          <input value={card.editTitle} onChange={(e) => setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, editTitle: e.target.value } : c))} className={INPUT_CLS} dir={hDir(card.editTitle)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Content</label>
                          <textarea value={card.editContent} rows={4} onChange={(e) => setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, editContent: e.target.value } : c))} className={`${INPUT_CLS} resize-y`} dir={hDir(card.editContent)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Proof / Solution <span className="font-normal">(optional)</span></label>
                          <textarea value={card.editSolution} rows={3} onChange={(e) => setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, editSolution: e.target.value } : c))} className={`${INPUT_CLS} resize-y`} dir={hDir(card.editSolution)} />
                        </div>
                        <div className="flex justify-end">
                          <button type="button" onClick={() => saveEdit(card.id)} className="px-3 py-1.5 text-xs font-medium bg-[#1A365D] text-white rounded-md hover:bg-[#1A365D]/90 transition-colors">
                            Save Changes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-slate-800">
            <button type="button" onClick={() => setStep('upload')} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">← Back</button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 dark:text-slate-400">{activeCards.length} card{activeCards.length !== 1 ? 's' : ''}</span>
              <button type="button" disabled={activeCards.length === 0} onClick={() => handleSaveAll(activeCards)} className="px-4 py-2 text-sm font-medium bg-[#1A365D] text-white rounded-lg hover:bg-[#1A365D]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Confirm & Save All →
              </button>
            </div>
          </div>
        </div>

        {/* View modal */}
        {viewingCardId && (() => {
          const viewed = cards.find((c) => c.id === viewingCardId);
          if (!viewed) return null;
          const vTopicName = viewed.topic_index !== null ? (existingTopics[viewed.topic_index]?.title ?? null) : null;
          return (
            <Modal title={viewed.title} onClose={() => setViewingCardId(null)} className="max-w-2xl">
              <div className="space-y-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[viewed.type] ?? TYPE_COLOR.other}`}>
                    {TYPE_LABEL[viewed.type] ?? viewed.type}
                  </span>
                  {vTopicName && (
                    <span className="text-xs text-gray-400 dark:text-slate-500">{vTopicName}</span>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-slate-500 mb-2 uppercase tracking-wide">Content</p>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-slate-200" dir={hDir(viewed.content)}>
                    <LatexContent content={viewed.content} />
                  </div>
                </div>

                {viewed.solution && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-slate-500 mb-2 uppercase tracking-wide">Proof / Solution</p>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-slate-200 border-l-2 border-gray-200 dark:border-slate-700 pl-4" dir={hDir(viewed.solution)}>
                      <LatexContent content={viewed.solution} />
                    </div>
                  </div>
                )}

              </div>
            </Modal>
          );
        })()}
      </Modal>
    );
  }

  // ── Step: confirming ──────────────────────────────────────────────────────
  const savingCards = activeCards;
  const totalCount = savingCards.length;
  const isDone = Object.values(cardStatuses).every((s) => s === 'saved' || s === 'failed');
  const progressPct = totalCount > 0 ? Math.round((savedCount + failedCards.length) / totalCount * 100) : 0;

  return (
    <Modal title="Saving Cards" onClose={isDone ? onClose : undefined as any} className="max-w-lg">
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
            <span>
              {isDone
                ? failedCards.length === 0 ? `Done! ${savedCount}/${totalCount} saved.` : `${savedCount}/${totalCount} saved · ${failedCards.length} failed`
                : `Saving ${savedCount + failedCards.length + 1} of ${totalCount}...`}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5">
            <div className="bg-[#1A365D] dark:bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="space-y-1 max-h-60 overflow-y-auto">
          {savingCards.map((card) => {
            const status = cardStatuses[card.id] ?? 'pending';
            return (
              <div key={card.id} className="flex items-center gap-2 text-sm py-0.5">
                {status === 'saved' && <svg className="w-4 h-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                {status === 'saving' && <div className="w-4 h-4 border-2 border-gray-300 dark:border-slate-600 border-t-[#1A365D] dark:border-t-blue-400 rounded-full animate-spin shrink-0" />}
                {status === 'failed' && <svg className="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                {status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-200 dark:border-slate-700 shrink-0" />}
                <span dir={hDir(card.title)} className={`truncate ${status === 'failed' ? 'text-red-600 dark:text-red-400' : status === 'saved' ? 'text-gray-700 dark:text-slate-300' : 'text-gray-500 dark:text-slate-400'}`}>
                  {card.title}
                </span>
              </div>
            );
          })}
        </div>

        {isDone && (
          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 dark:border-slate-800">
            {failedCards.length > 0 && (
              <button type="button" onClick={() => { const r: Record<string, CardStatus> = { ...cardStatuses }; failedCards.forEach((c) => (r[c.id] = 'pending')); setCardStatuses(r); setFailedCards([]); handleSaveAll(failedCards); }} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                Retry Failed
              </button>
            )}
            <button type="button" onClick={() => { onImported(savedTypes); }} className="px-4 py-2 text-sm font-medium bg-[#1A365D] text-white rounded-lg hover:bg-[#1A365D]/90 transition-colors">
              {failedCards.length === 0 ? 'Done' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
