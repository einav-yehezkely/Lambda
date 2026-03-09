'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVersion, useVersionProgress, useDeleteVersion, useUpdateVersion } from '@/hooks/useCourses';
import { useTopics, useVersionContent, useCreateContent, useCreateTopic, useDeleteTopic } from '@/hooks/useTopics';
import { useAuth } from '@/hooks/useAuth';
import { ContentItemCard } from '@/components/content/content-item-card';
import { Modal } from '@/components/ui/modal';
import { LatexEditor } from '@/components/ui/latex-editor';
import type { Topic, CourseVersion } from '@lambda/shared';

const SEMESTER_LABEL: Record<string, string> = {
  A: 'Semester A', B: 'Semester B', Summer: 'Summer',
  'א': 'Semester A', 'ב': 'Semester B', 'קיץ': 'Summer',
};

const INPUT_CLS = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900';

function EditVersionModal({ version, onClose }: { version: CourseVersion; onClose: () => void }) {
  const updateVersion = useUpdateVersion();
  const [institution, setInstitution] = useState(version.institution ?? '');
  const [year, setYear] = useState(version.year ? String(version.year) : '');
  const [semester, setSemester] = useState(version.semester ?? '');
  const [description, setDescription] = useState(version.description ?? '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(version.visibility);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await updateVersion.mutateAsync({
        id: version.id,
        body: {
          institution: institution.trim() || undefined,
          year: year ? Number(year) : undefined,
          semester: semester || undefined,
          description: description.trim() || undefined,
          visibility,
        },
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update version');
    }
  };

  return (
    <Modal title="Edit Version" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
            <input autoFocus type="text" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. HUJI" className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025" min={2000} max={2100} className={INPUT_CLS} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
          <select value={semester} onChange={(e) => setSemester(e.target.value)} className={INPUT_CLS}>
            <option value="">—</option>
            <option value="A">Semester A</option>
            <option value="B">Semester B</option>
            <option value="Summer">Summer</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" dir="auto" className={`${INPUT_CLS} resize-none`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')} className={INPUT_CLS}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:border-gray-500">Cancel</button>
          <button type="submit" disabled={updateVersion.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
            {updateVersion.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const CONTENT_TYPES = [
  { value: '', label: 'All' },
  { value: 'proof', label: 'Proofs' },
  { value: 'exam_question', label: 'Exam Questions' },
  { value: 'coding_question', label: 'Coding' },
  { value: 'algorithm', label: 'Algorithms' },
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
            dir="auto"
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
  const [type, setType] = useState<'proof' | 'exam_question' | 'coding_question' | 'algorithm'>('proof');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [solution, setSolution] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [topicId, setTopicId] = useState('');
  const [formError, setFormError] = useState('');
  // Algorithm-specific fields
  const [algoSteps, setAlgoSteps] = useState('');
  const [algoProof, setAlgoProof] = useState('');
  const [algoRuntime, setAlgoRuntime] = useState('');

  const isAlgorithm = type === 'algorithm';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setFormError('Title is required'); return; }
    if (!isAlgorithm && !content.trim()) { setFormError('Content is required'); return; }
    setFormError('');
    try {
      await createContent.mutateAsync({
        version_id: versionId,
        topic_id: topicId || undefined,
        type,
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
      });
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create item');
    }
  };

  const INPUT_CLS = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900';
  const TEXTAREA_CLS = `${INPUT_CLS} resize-none font-mono text-xs`;

  return (
    <Modal title="Add Content Item" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={INPUT_CLS}>
              <option value="proof">Proof</option>
              <option value="exam_question">Exam Question</option>
              <option value="coding_question">Coding Question</option>
              <option value="algorithm">Algorithm</option>
            </select>
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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isAlgorithm ? 'Algorithm Name *' : 'Title *'}
          </label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isAlgorithm ? 'e.g. BFS' : 'e.g. Prove that √2 is irrational'}
            dir="auto"
            className={INPUT_CLS}
          />
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

        {isAlgorithm ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Problem</label>
              <LatexEditor value={content} onChange={setContent} rows={2} placeholder="What problem does this solve?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Algorithm</label>
              <LatexEditor value={algoSteps} onChange={setAlgoSteps} rows={4} placeholder="Algorithm steps." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proof</label>
              <LatexEditor value={algoProof} onChange={setAlgoProof} rows={3} placeholder="Correctness proof. Optional." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Runtime</label>
              <LatexEditor value={algoRuntime} onChange={setAlgoRuntime} rows={1} placeholder="e.g. $O(V + E)$" />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
              <LatexEditor value={content} onChange={setContent} rows={4} placeholder="Use $...$ for inline LaTeX, $$...$$ for block." />
            </div>
            <div>
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                {type === 'proof' ? (
                  <>
                    Proof Sketch
                    <span className="relative group cursor-help inline-flex">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-gray-800 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                        A condensed outline of the main proof steps
                      </span>
                    </span>
                  </>
                ) : 'Solution'}
              </label>
              <LatexEditor value={solution} onChange={setSolution} rows={3} placeholder="Optional." />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
          <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="induction, graphs, BFS (comma-separated)" dir="auto" className={INPUT_CLS} />
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
  const router = useRouter();
  const { user } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showAddContent, setShowAddContent] = useState(false);
  const [showManageTopics, setShowManageTopics] = useState(false);
  const [showEditVersion, setShowEditVersion] = useState(false);
  const deleteVersion = useDeleteVersion();

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
        <span>{[version.institution, version.year].filter(Boolean).join(' · ') || version.title}</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            {[
              version.institution,
              version.year,
              version.semester ? (SEMESTER_LABEL[version.semester] ?? `Semester ${version.semester}`) : null,
            ].filter(Boolean).join(' · ') || version.title}
          </h1>
          {version.description && <p className="mt-2 text-gray-500 text-sm" dir={/[\u0590-\u05FF]/.test(version.description) ? 'rtl' : undefined}>{version.description}</p>}
          {user && <ProgressBar versionId={versionId} userId={user.id} />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAuthor && (
            <>
              <button onClick={() => setShowManageTopics(true)} className="text-sm border border-gray-300 text-gray-700 px-3 py-2 rounded-md hover:border-gray-500">
                Topics
              </button>
              <button onClick={() => setShowEditVersion(true)} className="text-sm border border-gray-300 text-gray-700 px-3 py-2 rounded-md hover:border-gray-500">
                Edit Version
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm('Delete this version? This cannot be undone.')) return;
                  await deleteVersion.mutateAsync({ id: versionId, templateId: courseId });
                  router.push(`/courses/${courseId}`);
                }}
                disabled={deleteVersion.isPending}
                className="text-sm border border-red-200 text-red-500 px-3 py-2 rounded-md hover:border-red-400 hover:text-red-700 disabled:opacity-40"
              >
                Delete Version
              </button>
            </>
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
                <ContentItemCard
                  key={item.content_item_id}
                  item={item}
                  userId={user?.id}
                  versionId={versionId}
                  isVersionAuthor={isAuthor}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showManageTopics && <ManageTopicsModal versionId={versionId} topics={topics ?? []} onClose={() => setShowManageTopics(false)} />}
      {showAddContent && <AddContentModal versionId={versionId} topics={topics ?? []} onClose={() => setShowAddContent(false)} />}
      {showEditVersion && version && <EditVersionModal version={version} onClose={() => setShowEditVersion(false)} />}
    </div>
  );
}
