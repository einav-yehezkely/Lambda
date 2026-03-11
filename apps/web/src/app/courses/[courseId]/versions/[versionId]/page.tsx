'use client';

import { use, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCourse, useVersion, useVersionProgress, useDeleteVersion, useUpdateVersion, useEnrollCourse, useActiveVersions } from '@/hooks/useCourses';
import { useTopics, useVersionContent, useCreateContent, useCreateTopic, useDeleteTopic } from '@/hooks/useTopics';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfileById } from '@/hooks/useUsers';
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

const BUILT_IN_TYPES = [
  { value: 'proof', label: 'Proof' },
  { value: 'exam_question', label: 'Exam Question' },
  { value: 'exercise_question', label: 'Exercise' },
  { value: 'algorithm', label: 'Algorithm' },
  { value: 'other', label: 'Other' },
];

const PROTECTED_TYPES = new Set(['exam_question', 'exercise_question']);

function getActiveTypes(version: CourseVersion) {
  const types = version.content_types;
  return types && types.length > 0 ? types : BUILT_IN_TYPES;
}

function ManageTypesModal({
  version,
  onClose,
}: {
  version: CourseVersion;
  onClose: () => void;
}) {
  const updateVersion = useUpdateVersion();
  const [orderedTypes, setOrderedTypes] = useState(() => getActiveTypes(version));
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const dragIndex = useRef<number | null>(null);

  // Sync when version data changes (e.g. after add/remove)
  useEffect(() => {
    setOrderedTypes(getActiveTypes(version));
  }, [version.content_types]);

  const save = (types: typeof orderedTypes) =>
    updateVersion.mutateAsync({ id: version.id, body: { content_types: types } });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) { setError('Label is required'); return; }
    const value = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!value) { setError('Invalid label'); return; }
    if (orderedTypes.some((t) => t.value === value)) {
      setError('Type already exists'); return;
    }
    setError('');
    try {
      await save([...orderedTypes, { label: trimmed, value }]);
      setLabel('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add type');
    }
  };

  const handleRemove = async (value: string) => {
    try {
      await save(orderedTypes.filter((t) => t.value !== value));
    } catch {
      setError('Failed to remove type');
    }
  };

  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const startEdit = (t: { label: string; value: string }) => {
    setEditingValue(t.value);
    setEditingLabel(t.label);
  };

  const handleRename = async (value: string) => {
    const trimmed = editingLabel.trim();
    setEditingValue(null);
    if (!trimmed || trimmed === orderedTypes.find((t) => t.value === value)?.label) return;
    try {
      await save(orderedTypes.map((t) => t.value === value ? { ...t, label: trimmed } : t));
    } catch {
      setError('Failed to rename type');
    }
  };

  const handleDragStart = (i: number) => { dragIndex.current = i; };
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === i) return;
    const next = [...orderedTypes];
    const [item] = next.splice(from, 1);
    next.splice(i, 0, item);
    dragIndex.current = i;
    setOrderedTypes(next);
  };
  const handleDrop = async () => {
    dragIndex.current = null;
    try {
      await save(orderedTypes);
    } catch {
      setError('Failed to reorder types');
    }
  };

  return (
    <Modal title="Manage Content Types" onClose={onClose}>
      <div className="space-y-4">
        <ul className="space-y-1">
          {orderedTypes.map((t, i) => (
            <li
              key={t.value}
              draggable={editingValue !== t.value}
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={handleDrop}
              className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 cursor-grab active:cursor-grabbing select-none"
            >
              <span className="text-gray-300 text-sm">⠿</span>
              {editingValue === t.value ? (
                <input
                  autoFocus
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onBlur={() => handleRename(t.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRename(t.value); } if (e.key === 'Escape') setEditingValue(null); }}
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-text select-text"
                />
              ) : (
                <span
                  className="text-sm text-gray-700 flex-1"
                  onDoubleClick={() => !PROTECTED_TYPES.has(t.value) && startEdit(t)}
                  title={PROTECTED_TYPES.has(t.value) ? undefined : 'Double-click to rename'}
                >{t.label}</span>
              )}
              {PROTECTED_TYPES.has(t.value) ? (
                <span className="text-xs text-gray-300">protected</span>
              ) : (
                <button
                  onClick={() => handleRemove(t.value)}
                  disabled={updateVersion.isPending}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={handleAdd} className="flex gap-2 pt-2 border-t border-gray-100">
          <input
            autoFocus
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="New type label..."
            dir="auto"
            className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button
            type="submit"
            disabled={updateVersion.isPending}
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
  activeTypes = BUILT_IN_TYPES,
  onClose,
}: {
  versionId: string;
  topics: Topic[];
  activeTypes?: { label: string; value: string }[];
  onClose: () => void;
}) {
  const createContent = useCreateContent();
  const [type, setType] = useState('proof');
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [topicId, setTopicId] = useState('');
  const [formError, setFormError] = useState('');
  const [sections, setSections] = useState<Array<{ label: string; content: string }>>([
    { label: 'Content', content: '' },
    { label: 'Proof Sketch', content: '' },
  ]);
  const addSection = () => setSections((s) => [...s, { label: '', content: '' }]);
  const removeSection = (i: number) => {
    if (!window.confirm('Remove this section?')) return;
    setSections((s) => s.filter((_, idx) => idx !== i));
  };
  const updateSection = (i: number, field: 'label' | 'content', value: string) =>
    setSections((s) => s.map((sec, idx) => idx === i ? { ...sec, [field]: value } : sec));
  const moveSection = (i: number, dir: -1 | 1) =>
    setSections((s) => { const a = [...s]; [a[i], a[i + dir]] = [a[i + dir], a[i]]; return a; });

  const isAlgorithm = type === 'algorithm';

  useEffect(() => {
    if (type === 'algorithm') {
      setSections([
        { label: 'Problem', content: '' },
        { label: 'Algorithm', content: '' },
        { label: 'Proof', content: '' },
        { label: 'Runtime', content: '' },
      ]);
    } else {
      setSections([
        { label: 'Content', content: '' },
        { label: type === 'proof' ? 'Proof Sketch' : 'Solution', content: '' },
      ]);
    }
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setFormError('Title is required'); return; }
    if (!sections[0]?.content.trim()) { setFormError('Content is required'); return; }
    setFormError('');
    try {
      await createContent.mutateAsync({
        version_id: versionId,
        topic_id: topicId || undefined,
        type,
        title: title.trim(),
        content: sections[0]?.content.trim() || title.trim(),
        difficulty: difficulty || undefined,
        tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [],
        metadata: {
          sections: sections.filter((s) => s.label.trim() || s.content.trim()).map((s) => ({ label: s.label.trim() || 'Section', content: s.content.trim() })),
        },
      });
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create item');
    }
  };

  const INPUT_CLS = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900';

  return (
    <Modal title="Add Content Item" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT_CLS}>
              {activeTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
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
                <LatexEditor value={sec.content} onChange={(v) => updateSection(i, 'content', v)} rows={3} placeholder="Use $...$ for inline LaTeX." />
              </div>
            ))}
            <button type="button" onClick={addSection} className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-2 py-0.5 hover:border-gray-500">
              + Add Section
            </button>
          </div>
        </div>

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

function VersionAuthor({ authorId }: { authorId: string }) {
  const { data: author } = useUserProfileById(authorId);
  if (!author) return null;
  return (
    <p className="mt-2 text-xs text-gray-400">
      by{' '}
      <Link href={`/profile/${author.username}`} className="hover:text-gray-600 underline underline-offset-2">
        {author.display_name ?? author.username}
      </Link>
    </p>
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
  const [selectedTag, setSelectedTag] = useState('');
  const [showAddContent, setShowAddContent] = useState(false);
  const [showManageTopics, setShowManageTopics] = useState(false);
  const [showManageTypes, setShowManageTypes] = useState(false);
  const [showEditVersion, setShowEditVersion] = useState(false);
  const deleteVersion = useDeleteVersion();

  const { data: course } = useCourse(courseId);
  const { data: version, isLoading: versionLoading } = useVersion(versionId);
  const { data: topics } = useTopics(versionId);
  const { data: items, isLoading: itemsLoading } = useVersionContent({
    version_id: versionId,
    topic_id: selectedTopic || undefined,
    type: selectedType || undefined,
  });

  const isAuthor = !!user && !!version && user.id === version.author_id;

  const { data: activeVersions } = useActiveVersions(!!user);
  const enrollCourse = useEnrollCourse();
  const isEnrolled = (activeVersions ?? []).some((v) => v.version_id === versionId && v.enrolled);

  const handlePractice = async () => {
    if (user && !isEnrolled) {
      await enrollCourse.mutateAsync(versionId).catch(() => {});
    }
    router.push(`/practice/${versionId}`);
  };

  const allTags = Array.from(new Set(items?.flatMap((i) => i.content_item.tags) ?? [])).sort();
  const visibleItems = selectedTag ? (items ?? []).filter((i) => i.content_item.tags.includes(selectedTag)) : (items ?? []);

  if (versionLoading) return <div className="text-sm text-gray-400">Loading...</div>;
  if (!version) return <div className="text-sm text-red-500">Version not found.</div>;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 mb-5">
        <Link href="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-2">/</span>
        <Link href={`/courses/${courseId}`} className="hover:text-gray-600">{course?.title ?? 'Course'}</Link>
        <span className="mx-2">/</span>
        <span>{[version.institution, version.year].filter(Boolean).join(' · ') || version.title}</span>
      </div>

      {/* Version header card */}
      <div className="mb-8 border border-gray-200 rounded-xl p-6 bg-white">
        {course && <p className="text-sm text-gray-500 mb-1.5">{course.title}</p>}
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              {[
                version.institution,
                version.year,
                version.semester ? (SEMESTER_LABEL[version.semester] ?? `Semester ${version.semester}`) : null,
              ].filter(Boolean).join(' · ') || version.title}
            </h1>

            {/* Meta badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {version.institution && (
                <span className="text-xs border border-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full">{version.institution}</span>
              )}
              {version.year && (
                <span className="text-xs border border-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full">{version.year}</span>
              )}
              {version.semester && (
                <span className="text-xs border border-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full">{SEMESTER_LABEL[version.semester] ?? version.semester}</span>
              )}
              <span className={`text-xs px-2.5 py-0.5 rounded-full border ${version.visibility === 'public' ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
                {version.visibility === 'public' ? 'Public' : 'Private'}
              </span>
            </div>

            {version.description && (
              <p className="text-gray-500 text-sm whitespace-pre-wrap mb-3" dir={/[\u0590-\u05FF]/.test(version.description) ? 'rtl' : undefined}>{version.description}</p>
            )}
            <VersionAuthor authorId={version.author_id} />
            {user && <ProgressBar versionId={versionId} userId={user.id} />}
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            {/* Primary CTA */}
            <button
              onClick={handlePractice}
              disabled={enrollCourse.isPending}
              className="bg-[#1e3a8a] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50 whitespace-nowrap"
            >
              {enrollCourse.isPending ? 'Enrolling...' : 'Practice →'}
            </button>

            {/* Author actions */}
            {isAuthor && (
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setShowAddContent(true)} className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:border-gray-500 hover:bg-gray-50 transition-colors whitespace-nowrap">
                    + Add Content
                  </button>
                  <button onClick={() => setShowManageTopics(true)} className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:border-gray-500 hover:bg-gray-50 transition-colors">
                    Topics
                  </button>
                  <button onClick={() => setShowManageTypes(true)} className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:border-gray-500 hover:bg-gray-50 transition-colors">
                    Types
                  </button>
                  <button onClick={() => setShowEditVersion(true)} className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:border-gray-500 hover:bg-gray-50 transition-colors">
                    Edit Version
                  </button>
                </div>
                <button
                  onClick={async () => {
                    if (!window.confirm('Delete this version? This cannot be undone.')) return;
                    await deleteVersion.mutateAsync({ id: versionId, templateId: courseId });
                    router.push(`/courses/${courseId}`);
                  }}
                  disabled={deleteVersion.isPending}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                >
                  {deleteVersion.isPending ? 'Deleting...' : 'Delete version'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex gap-6">
        {topics && topics.length > 0 && (
          <aside className="w-52 shrink-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Topics</p>
            <nav className="space-y-0.5">
              <button
                onClick={() => setSelectedTopic('')}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${selectedTopic === '' ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                All
              </button>
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTopic(t.id)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${selectedTopic === t.id ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {t.title}
                </button>
              ))}
            </nav>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[{ value: '', label: 'All' }, ...getActiveTypes(version)].map((t) => (
              <button key={t.value} onClick={() => setSelectedType(t.value)} className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${selectedType === t.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {t.label}
              </button>
            ))}
            {allTags.length > 0 && (
              <>
                <span className="text-gray-200 self-center">|</span>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${selectedTag === tag ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
                  >
                    {tag}
                  </button>
                ))}
              </>
            )}
          </div>

          {itemsLoading && <div className="text-sm text-gray-400">Loading content...</div>}
          {!itemsLoading && visibleItems.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">No content items yet.</p>
              {isAuthor && (
                <button onClick={() => setShowAddContent(true)} className="mt-2 text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2">
                  Add the first item
                </button>
              )}
            </div>
          )}
          {visibleItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleItems.map((item) => (
                <ContentItemCard
                  key={item.content_item_id}
                  item={item}
                  userId={user?.id}
                  versionId={versionId}
                  isVersionAuthor={isAuthor}
                  topics={topics ?? []}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showManageTopics && <ManageTopicsModal versionId={versionId} topics={topics ?? []} onClose={() => setShowManageTopics(false)} />}
      {showManageTypes && version && <ManageTypesModal version={version} onClose={() => setShowManageTypes(false)} />}
      {showAddContent && <AddContentModal versionId={versionId} topics={topics ?? []} activeTypes={getActiveTypes(version)} onClose={() => setShowAddContent(false)} />}
      {showEditVersion && version && <EditVersionModal version={version} onClose={() => setShowEditVersion(false)} />}
    </div>
  );
}
