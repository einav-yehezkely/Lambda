'use client';

import { useState, useRef, useEffect } from 'react';
import type { VersionContentItem, Topic } from '@lambda/shared';
import { LatexContent } from './latex-content';
import { LatexEditor } from '../ui/latex-editor';
import { Modal } from '../ui/modal';
import { useUpdateContent, useDeleteContent } from '@/hooks/useTopics';

const TYPE_LABEL: Record<string, string> = {
  proof: 'Proof',
  exam_question: 'Exam',
  coding_question: 'Code',
  algorithm: 'Algorithm',
};

const TYPE_COLOR: Record<string, string> = {
  proof: 'bg-purple-100 text-purple-700',
  exam_question: 'bg-blue-100 text-blue-700',
  coding_question: 'bg-orange-100 text-orange-700',
  algorithm: 'bg-teal-100 text-teal-700',
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'text-green-600',
  medium: 'text-yellow-600',
  hard: 'text-red-600',
};

const INFO_ICON = (
  <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
);

const INPUT_CLS = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900';

const HE_RE = /[\u0590-\u05FF]/;
const hDir = (s?: string | null): 'rtl' | undefined => HE_RE.test(s ?? '') ? 'rtl' : undefined;

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ item, topics, onClose }: { item: VersionContentItem; topics: Topic[]; onClose: () => void }) {
  const ci = item.content_item;
  const isAlgorithm = ci.type === 'algorithm';
  const updateContent = useUpdateContent();

  const [title, setTitle] = useState(ci.title);
  const [difficulty, setDifficulty] = useState(ci.difficulty ?? '');
  const [tagsInput, setTagsInput] = useState(ci.tags.join(', '));
  const [topicId, setTopicId] = useState(item.topic_id ?? '');
  const [sections, setSections] = useState<Array<{ label: string; content: string }>>(() => {
    const meta = ci.metadata?.sections ?? [];
    if (meta.length > 0) return meta;
    if (isAlgorithm) return [
      { label: 'Problem', content: ci.content ?? '' },
      ...(ci.metadata?.algorithm ? [{ label: 'Algorithm', content: ci.metadata.algorithm }] : []),
      ...(ci.metadata?.proof ? [{ label: 'Proof', content: ci.metadata.proof }] : []),
      ...(ci.metadata?.runtime ? [{ label: 'Runtime', content: ci.metadata.runtime }] : []),
    ];
    return [
      { label: 'Content', content: ci.content },
      ...(ci.solution ? [{ label: ci.type === 'proof' ? 'Proof Sketch' : 'Solution', content: ci.solution }] : []),
    ];
  });
  const [error, setError] = useState('');

  const addSection = () => setSections((s) => [...s, { label: '', content: '' }]);
  const removeSection = (i: number) => {
    if (!window.confirm('Remove this section?')) return;
    setSections((s) => s.filter((_, idx) => idx !== i));
  };
  const updateSection = (i: number, field: 'label' | 'content', value: string) =>
    setSections((s) => s.map((sec, idx) => idx === i ? { ...sec, [field]: value } : sec));
  const moveSection = (i: number, dir: -1 | 1) =>
    setSections((s) => { const a = [...s]; [a[i], a[i + dir]] = [a[i + dir], a[i]]; return a; });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (!sections[0]?.content.trim()) { setError('Content is required'); return; }
    setError('');
    try {
      await updateContent.mutateAsync({
        id: item.content_item_id,
        body: {
          title: title.trim(),
          content: sections[0]?.content.trim() || title.trim(),
          solution: null,
          difficulty: difficulty || undefined,
          tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [],
          topic_id: topicId || null,
          metadata: {
            sections: sections.filter((s) => s.label.trim() || s.content.trim()).map((s) => ({ label: s.label.trim() || 'Section', content: s.content.trim() })),
          },
        },
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  return (
    <Modal title="Edit Content Item" onClose={onClose} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isAlgorithm ? 'Algorithm Name *' : 'Title *'}
          </label>
          <input autoFocus type="text" value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" className={INPUT_CLS} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={INPUT_CLS}>
            <option value="">None</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        {topics.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className={INPUT_CLS}>
              <option value="">No topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sections</label>
          <div className="space-y-3">
            {sections.map((sec, i) => (
              <div key={i} className="border border-gray-200 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none">▲</button>
                    <button type="button" onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none">▼</button>
                  </div>
                  <input
                    type="text"
                    value={sec.label}
                    onChange={(e) => updateSection(i, 'label', e.target.value)}
                    placeholder="Section name"
                    dir="auto"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <button type="button" onClick={() => removeSection(i)} className="text-xs text-gray-400 hover:text-red-500 shrink-0">
                    Remove
                  </button>
                </div>
                <LatexEditor value={sec.content} onChange={(v) => updateSection(i, 'content', v)} rows={3} />
              </div>
            ))}
            <button type="button" onClick={addSection} className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-2 py-0.5 hover:border-gray-500">
              + Add Section
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
          <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="comma-separated" dir="auto" className={INPUT_CLS} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:border-gray-500">
            Cancel
          </button>
          <button type="submit" disabled={updateContent.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
            {updateContent.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewModal({ item, onClose }: {
  item: VersionContentItem;
  onClose: () => void;
}) {
  const { content_item } = item;
  const isAlgorithm = content_item.type === 'algorithm';
  const meta = content_item.metadata;
  const [page, setPage] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let el: HTMLElement | null = contentRef.current?.parentElement ?? null;
    while (el) {
      if (el.scrollHeight > el.clientHeight) { el.scrollTo(0, 0); break; }
      el = el.parentElement;
    }
  }, [page]);

  const sections: { label: string; content: React.ReactNode }[] =
    (content_item.metadata?.sections?.length ?? 0) > 0
      ? content_item.metadata!.sections!.map((s) => ({
          label: s.label,
          content: <div className="text-gray-600" dir={hDir(s.content)}><LatexContent content={s.content} /></div>,
        }))
      : isAlgorithm
        ? [
            ...(content_item.content && content_item.content !== content_item.title
              ? [{ label: 'Problem', content: <div className="text-gray-600" dir={hDir(content_item.content)}><LatexContent content={content_item.content} /></div> }]
              : []),
            ...(meta?.algorithm ? [{ label: 'Algorithm', content: <div className="text-gray-600" dir={hDir(meta.algorithm)}><LatexContent content={meta.algorithm} /></div> }] : []),
            ...(meta?.proof ? [{ label: 'Proof', content: <div className="text-gray-600" dir={hDir(meta.proof)}><LatexContent content={meta.proof} /></div> }] : []),
            ...(meta?.runtime ? [{ label: 'Runtime', content: <span className="text-gray-700 font-mono text-xs"><LatexContent content={meta.runtime} /></span> }] : []),
          ]
        : [
            { label: 'Content', content: <div className="text-gray-600" dir={hDir(content_item.content)}><LatexContent content={content_item.content} /></div> },
            ...(content_item.solution
              ? [{ label: content_item.type === 'proof' ? 'Proof Sketch' : 'Solution', content: <div className="text-gray-600" dir={hDir(content_item.solution)}><LatexContent content={content_item.solution} /></div> }]
              : []),
          ];

  const current = sections[page];
  const total = sections.length;

  return (
    <Modal title={content_item.title} onClose={onClose} className="max-w-2xl">
      <div ref={contentRef} className="text-sm">
        {/* Type + difficulty */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[content_item.type]}`}>
            {TYPE_LABEL[content_item.type]}
          </span>
          {content_item.difficulty && (
            <span className={`text-xs font-medium ${DIFFICULTY_COLOR[content_item.difficulty]}`}>
              {content_item.difficulty}
            </span>
          )}
        </div>

        {/* Section tabs */}
        {total > 1 && (
          <div className="flex gap-1 mb-4 border-b border-gray-100 pb-0">
            {sections.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setPage(i)}
                className={`text-xs px-3 py-1.5 rounded-t-md border-b-2 transition-colors ${
                  i === page
                    ? 'border-gray-900 text-gray-900 font-medium'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Section content */}
        {total > 0 && (
          <div className="min-h-[120px]">
            {total === 1 && (
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                {current.label}
              </span>
            )}
            {current.content}
          </div>
        )}

        {/* Pagination nav */}
        {total > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-md text-gray-500 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Back
            </button>
            <span className="text-xs text-gray-400">
              {page + 1} / {total}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === total - 1}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-md text-gray-500 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}

        {content_item.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {content_item.tags.map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

      </div>
    </Modal>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function ContentItemCard({
  item,
  userId,
  versionId,
  isVersionAuthor,
  topics = [],
}: {
  item: VersionContentItem;
  userId?: string;
  versionId?: string;
  isVersionAuthor?: boolean;
  topics?: Topic[];
}) {
  const { content_item } = item;
  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const deleteContent = useDeleteContent();

  const canEdit = !!userId && userId === content_item.author_id;
  const canDelete = !!userId && !!versionId && (userId === content_item.author_id || !!isVersionAuthor);
  const topicName = item.topic_id ? topics.find((t) => t.id === item.topic_id)?.title : undefined;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!versionId || !window.confirm('Remove this item from the version?')) return;
    deleteContent.mutate({ contentItemId: item.content_item_id, versionId });
  };

  return (
    <>
      <div
        className="w-64 border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors flex flex-col"
      >
        {/* Clickable area */}
        <button
          type="button"
          onClick={() => setShowView(true)}
          className="text-start px-4 pt-4 pb-3 flex flex-col gap-2 flex-1"
        >
          <span className="font-semibold text-gray-900 text-base leading-snug" dir={hDir(content_item.title)}>
            <LatexContent content={content_item.title} />
          </span>
          {topicName && (
            <span className="text-xs text-gray-400" dir="auto">{topicName}</span>
          )}
          <div className="flex items-end justify-between gap-2 mt-auto">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[content_item.type]}`}>
                {TYPE_LABEL[content_item.type]}
              </span>
              {content_item.difficulty && (
                <span className={`text-xs font-medium ${DIFFICULTY_COLOR[content_item.difficulty]}`}>
                  {content_item.difficulty}
                </span>
              )}
            </div>
            {content_item.tags.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1">
                {content_item.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>

        {/* Edit / Remove row */}
        {(canEdit || canDelete) && (
          <div className="flex gap-3 px-4 pb-3">
            {canEdit && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowEdit(true); }}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteContent.isPending}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
              >
                {deleteContent.isPending ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
        )}
      </div>

      {showView && (
        <ViewModal
          item={item}
          onClose={() => setShowView(false)}
        />
      )}
      {showEdit && <EditModal item={item} topics={topics} onClose={() => setShowEdit(false)} />}
    </>
  );
}
