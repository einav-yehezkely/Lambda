'use client';

import { useState } from 'react';
import type { VersionContentItem } from '@lambda/shared';
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

function EditModal({ item, onClose }: { item: VersionContentItem; onClose: () => void }) {
  const ci = item.content_item;
  const isAlgorithm = ci.type === 'algorithm';
  const updateContent = useUpdateContent();

  const [title, setTitle] = useState(ci.title);
  const [content, setContent] = useState(ci.content);
  const [solution, setSolution] = useState(ci.solution ?? '');
  const [difficulty, setDifficulty] = useState(ci.difficulty ?? '');
  const [tagsInput, setTagsInput] = useState(ci.tags.join(', '));
  const [algoSteps, setAlgoSteps] = useState(ci.metadata?.algorithm ?? '');
  const [algoProof, setAlgoProof] = useState(ci.metadata?.proof ?? '');
  const [algoRuntime, setAlgoRuntime] = useState(ci.metadata?.runtime ?? '');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setError('');
    try {
      await updateContent.mutateAsync({
        id: item.content_item_id,
        body: {
          title: title.trim(),
          content: isAlgorithm ? (content.trim() || title.trim()) : content.trim(),
          solution: !isAlgorithm && solution.trim() ? solution.trim() : undefined,
          difficulty: difficulty || undefined,
          tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [],
          metadata: isAlgorithm ? {
            ...(algoSteps.trim() && { algorithm: algoSteps.trim() }),
            ...(algoProof.trim() && { proof: algoProof.trim() }),
            ...(algoRuntime.trim() && { runtime: algoRuntime.trim() }),
          } : undefined,
        },
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  return (
    <Modal title="Edit Content Item" onClose={onClose}>
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

        {isAlgorithm ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Problem</label>
              <LatexEditor value={content} onChange={setContent} rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Algorithm</label>
              <LatexEditor value={algoSteps} onChange={setAlgoSteps} rows={4} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proof</label>
              <LatexEditor value={algoProof} onChange={setAlgoProof} rows={3} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Runtime</label>
              <LatexEditor value={algoRuntime} onChange={setAlgoRuntime} rows={1} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
              <LatexEditor value={content} onChange={setContent} rows={4} />
            </div>
            <div>
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                {ci.type === 'proof' ? (
                  <>
                    Proof Sketch
                    <span className="relative group cursor-help inline-flex">
                      {INFO_ICON}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-gray-800 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                        A condensed outline of the main proof steps
                      </span>
                    </span>
                  </>
                ) : 'Solution'}
              </label>
              <LatexEditor value={solution} onChange={setSolution} rows={3} />
            </div>
          </>
        )}

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

// ─── Card ─────────────────────────────────────────────────────────────────────

export function ContentItemCard({
  item,
  userId,
  versionId,
  isVersionAuthor,
}: {
  item: VersionContentItem;
  userId?: string;
  versionId?: string;
  isVersionAuthor?: boolean;
}) {
  const { content_item } = item;
  const isAlgorithm = content_item.type === 'algorithm';
  const meta = content_item.metadata;
  const [showEdit, setShowEdit] = useState(false);
  const deleteContent = useDeleteContent();

  const canEdit = !!userId && userId === content_item.author_id;
  const canDelete = !!userId && !!versionId && (userId === content_item.author_id || !!isVersionAuthor);

  const handleDelete = () => {
    if (!versionId || !window.confirm('Remove this item from the version?')) return;
    deleteContent.mutate({ contentItemId: item.content_item_id, versionId });
  };

  return (
    <>
      <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors" dir={hDir(content_item.title)}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-gray-900 text-sm">
            <LatexContent content={content_item.title} />
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {content_item.difficulty && (
              <span className={`text-xs font-medium ${DIFFICULTY_COLOR[content_item.difficulty]}`}>
                {content_item.difficulty}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[content_item.type]}`}>
              {TYPE_LABEL[content_item.type]}
            </span>
          </div>
        </div>

        {isAlgorithm ? (
          <div className="mt-2 space-y-2 text-sm">
            {content_item.content && content_item.content !== content_item.title && (
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Problem</span>
                <div className="text-gray-600 mt-0.5" dir={hDir(content_item.content)}><LatexContent content={content_item.content} /></div>
              </div>
            )}
            {meta?.algorithm && (
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Algorithm</span>
                <div className="text-gray-600 mt-0.5" dir={hDir(meta.algorithm)}><LatexContent content={meta.algorithm} /></div>
              </div>
            )}
            {meta?.proof && (
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Proof</span>
                <div className="text-gray-600 mt-0.5" dir={hDir(meta.proof)}><LatexContent content={meta.proof} /></div>
              </div>
            )}
            {meta?.runtime && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Runtime</span>
                <span className="text-gray-700 font-mono text-xs"><LatexContent content={meta.runtime} /></span>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2 space-y-2 text-sm">
            <div className="text-gray-600" dir={hDir(content_item.content)}><LatexContent content={content_item.content} /></div>
            {content_item.type === 'proof' && content_item.solution && (
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Proof Sketch</span>
                  <span className="relative group cursor-help inline-flex">
                    {INFO_ICON}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-gray-800 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                      A condensed outline of the main proof steps
                    </span>
                  </span>
                </div>
                <div className="text-gray-600 mt-0.5" dir={hDir(content_item.solution)}><LatexContent content={content_item.solution} /></div>
              </div>
            )}
          </div>
        )}

        {content_item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {content_item.tags.map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

        {(canEdit || canDelete) && (
          <div className="mt-3 flex gap-3 pt-2 border-t border-gray-100">
            {canEdit && (
              <button
                onClick={() => setShowEdit(true)}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Edit
              </button>
            )}
            {canDelete && (
              <button
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

      {showEdit && <EditModal item={item} onClose={() => setShowEdit(false)} />}
    </>
  );
}
