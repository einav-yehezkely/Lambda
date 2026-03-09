'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useVersion, useVersionProgress } from '@/hooks/useCourses';
import { useTopics, useVersionContent, useCreateContent, useCreateTopic, useDeleteTopic } from '@/hooks/useTopics';
import { useAuth } from '@/hooks/useAuth';
import { ContentItemCard } from '@/components/content/content-item-card';
import { Modal } from '@/components/ui/modal';
import type { Topic } from '@lambda/shared';

const CONTENT_TYPES = [
  { value: '', label: 'All' },
  { value: 'proof', label: 'Proofs' },
  { value: 'exam_question', label: 'Exam Questions' },
  { value: 'coding_question', label: 'Coding' },
];

function ProgressBar({ versionId, userId }: { versionId: string; userId: string }) {
  const { data: progress } = useVersionProgress(versionId, !!userId);
  if (!progress || progress.total === 0) return null;
  const pct = Math.round((progress.solved / progress.total) * 100);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
        <span>{progress.solved} / {progress.total} solved</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ManageTopicsModal({
  versionId,
  topics,
  onClose,
}: {
  versionId: string;
  topics: Topic[];
  onClose: () => void;
}) {
  const createTopic = useCreateTopic();
  const deleteTopic = useDeleteTopic(versionId);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setError('');
    try {
      await createTopic.mutateAsync({
        version_id: versionId,
        title: title.trim(),
        order_index: topics.length,
      });
      setTitle('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add topic');
    }
  };

  return (
    <Modal title="Manage Topics" onClose={onClose}>
      <div className="space-y-4">
        {topics.length > 0 ? (
          <ul className="space-y-1">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">{t.title}</span>
                <button
                  onClick={() => deleteTopic.mutate(t.id)}
                  disabled={deleteTopic.isPending}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No topics yet.</p>
        )}
        <form onSubmit={handleAdd} className="flex gap-2 pt-2 border-t border-gray-100">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New topic title..."
            className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button
            type="submit"
            disabled={createTopic.isPending}
            className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}

function AddContentModal({
  versionId,
  topics,
  onClose,
}: {
  versionId: string;
  topics: Topic[];
  onClose: () => void;
}) {
  const createContent = useCreateContent();
  const [type, setType] = useState<'proof' | 'exam_question' | 'coding_question'>('proof');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [solution, setSolution] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [topicId, setTopicId] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setFormError('Title and content are required'); return; }
    setFormError('');
    try {
      await createContent.mutateAsync({
        version_id: versionId,
        topic_id: topicId || undefined,
        type,
        title: title.trim(),
        content: content.trim(),
        solution: solution.trim() || undefined,
        difficulty: difficulty || undefined,
        tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create item');
    }
  };

  return (
    <Modal title="Add Content Item" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="proof">Proof</option>
              <option value="exam_question">Exam Question</option>
              <option value="coding_question">Coding Question</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">None</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Prove that √2 is irrational"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        {topics.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">No topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Use $...$ for inline LaTeX, $$...$$ for block."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Solution</label>
          <textarea
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            rows={3}
            placeholder="Optional. LaTeX supported."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="induction, graphs, NP (comma-separated)"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        {formError && <p className="text-sm text-red-500">{formError}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:border-gray-500">
            Cancel
          </button>
          <button type="submit" disabled={createContent.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
            {createContent.isPending ? 'Adding...' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function VersionPage({
  params,
}: {
  params: Promise<{ courseId: string; versionId: string }>;
}) {
  const { courseId, versionId } = use(params);
  const { user } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showAddContent, setShowAddContent] = useState(false);
  const [showManageTopics, setShowManageTopics] = useState(false);

  const { data: version, isLoading: versionLoading } = useVersion(versionId);
  const { data: topics } = useTopics(versionId);
  const { data: items, isLoading: itemsLoading } = useVersionContent({
    version_id: versionId,
    topic_id: selectedTopic || undefined,
    type: selectedType || undefined,
  });

  const isAuthor = !!user && !!version && user.id === version.author_id;

  if (versionLoading) return <div className="text-sm text-gray-400">Loading...</div>;
  if (!version) return <div className="text-sm text-red-500">Version not found.</div>;

  return (
    <div>
      <div className="text-sm text-gray-400 mb-4">
        <Link href="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-2">/</span>
        <Link href={`/courses/${courseId}`} className="hover:text-gray-600">Course</Link>
        <span className="mx-2">/</span>
        <span>{version.title}</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{version.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-400">
            {version.institution && <span>{version.institution}</span>}
            {version.year && <span>· {version.year}</span>}
          </div>
          {version.description && <p className="mt-2 text-gray-500 text-sm">{version.description}</p>}
          {user && <ProgressBar versionId={versionId} userId={user.id} />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAuthor && (
            <button onClick={() => setShowManageTopics(true)} className="text-sm border border-gray-300 text-gray-700 px-3 py-2 rounded-md hover:border-gray-500">
              Topics
            </button>
          )}
          {user && (
            <button onClick={() => setShowAddContent(true)} className="text-sm border border-gray-300 text-gray-700 px-3 py-2 rounded-md hover:border-gray-500">
              + Add Content
            </button>
          )}
          <Link href={`/practice/${versionId}`} className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700">
            Practice →
          </Link>
        </div>
      </div>

      <div className="flex gap-6">
        {topics && topics.length > 0 && (
          <aside className="w-48 shrink-0">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Topics</h2>
            <ul className="space-y-1">
              <li>
                <button onClick={() => setSelectedTopic('')} className={`w-full text-left text-sm px-2 py-1.5 rounded-md ${selectedTopic === '' ? 'bg-gray-100 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                  All topics
                </button>
              </li>
              {topics.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setSelectedTopic(t.id)} className={`w-full text-left text-sm px-2 py-1.5 rounded-md ${selectedTopic === t.id ? 'bg-gray-100 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex gap-2 mb-4">
            {CONTENT_TYPES.map((t) => (
              <button key={t.value} onClick={() => setSelectedType(t.value)} className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${selectedType === t.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {itemsLoading && <div className="text-sm text-gray-400">Loading content...</div>}
          {items && items.length === 0 && <div className="text-sm text-gray-400">No content items yet.</div>}
          {items && items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => (
                <ContentItemCard key={item.content_item_id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showManageTopics && <ManageTopicsModal versionId={versionId} topics={topics ?? []} onClose={() => setShowManageTopics(false)} />}
      {showAddContent && <AddContentModal versionId={versionId} topics={topics ?? []} onClose={() => setShowAddContent(false)} />}
    </div>
  );
}
