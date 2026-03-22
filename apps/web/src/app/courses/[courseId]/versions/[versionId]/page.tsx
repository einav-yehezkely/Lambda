'use client';

import { use, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCourse, useVersion, useVersionProgress, useDeleteVersion, useUpdateVersion, useEnrollCourse, useActiveVersions } from '@/hooks/useCourses';
import { useQueryClient } from '@tanstack/react-query';
import { useTopics, useVersionContent, useCreateContent, useUpdateContent, useCreateTopic, useDeleteTopic } from '@/hooks/useTopics';
import { topicsApi, contentApi } from '@/lib/api/content';
import { compressImage } from '@/lib/compress-image';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfileById, useCurrentUser } from '@/hooks/useUsers';
import { ContentItemCard } from '@/components/content/content-item-card';
import { VersionDrive } from '@/components/version-drive';
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
  const [lecturerName, setLecturerName] = useState(version.lecturer_name ?? '');
  const [courseNumber, setCourseNumber] = useState(version.course_number ?? '');
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
          lecturer_name: lecturerName.trim() || undefined,
          course_number: courseNumber.trim() || undefined,
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lecturer</label>
            <input type="text" value={lecturerName} onChange={(e) => setLecturerName(e.target.value)} placeholder="e.g. Prof. Cohen" className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Number</label>
            <input type="text" value={courseNumber} onChange={(e) => setCourseNumber(e.target.value)} placeholder="e.g. 67101" className={INPUT_CLS} />
          </div>
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
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">Course progress</span>
        <span className="text-sm font-bold text-gray-900">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#1e3a8a] rounded-full transition-all" style={{ width: `${pct}%` }} />
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
  const queryClient = useQueryClient();
  const [orderedTopics, setOrderedTopics] = useState(() => [...topics]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const dragIndex = useRef<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => { setOrderedTopics([...topics]); }, [topics]);

  const handleRename = async (id: string) => {
    const trimmed = editingTitle.trim();
    setEditingId(null);
    if (!trimmed || trimmed === orderedTopics.find((t) => t.id === id)?.title) return;
    try {
      await topicsApi.updateTopic(id, { title: trimmed });
      queryClient.invalidateQueries({ queryKey: ['topics', versionId] });
    } catch {
      setError('Failed to rename topic');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setError('');
    try {
      await createTopic.mutateAsync({
        version_id: versionId,
        title: title.trim(),
        order_index: orderedTopics.length,
      });
      setTitle('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add topic');
    }
  };

  const handleDragStart = (i: number) => { dragIndex.current = i; };
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === i) return;
    const next = [...orderedTopics];
    const [item] = next.splice(from, 1);
    next.splice(i, 0, item);
    dragIndex.current = i;
    setOrderedTopics(next);
  };
  const handleDrop = async () => {
    dragIndex.current = null;
    const snapshot = [...orderedTopics];
    try {
      await Promise.all(snapshot.map((t, i) => topicsApi.updateTopic(t.id, { order_index: 10000 + i })));
      await Promise.all(snapshot.map((t, i) => topicsApi.updateTopic(t.id, { order_index: i })));
      queryClient.invalidateQueries({ queryKey: ['topics', versionId] });
    } catch {
      setError('Failed to reorder topics');
    }
  };

  return (
    <Modal title="Manage Topics" onClose={onClose}>
      <div className="space-y-4">
        {orderedTopics.length > 0 ? (
          <ul className="space-y-1">
            {orderedTopics.map((t, i) => (
              <li
                key={t.id}
                draggable={editingId !== t.id}
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={handleDrop}
                className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 cursor-grab active:cursor-grabbing select-none"
              >
                <span className="text-gray-300 text-sm">⠿</span>
                {editingId === t.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleRename(t.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRename(t.id); } if (e.key === 'Escape') setEditingId(null); }}
                    dir="auto"
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-text select-text"
                  />
                ) : (
                  <span
                    className="text-sm text-gray-700 flex-1"
                    onDoubleClick={() => { setEditingId(t.id); setEditingTitle(t.title); }}
                    title="Double-click to rename"
                  >{t.title}</span>
                )}
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

const EXAM_QUESTION_FORMATS = [
  { value: 'open', label: 'Open-ended' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
];

const EXERCISE_QUESTION_FORMATS = [
  { value: 'open', label: 'Open-ended' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'flashcard', label: 'Flashcard' },
  { value: 'other', label: 'Other' },
];

function getDefaultSections(type: string, format: string): Array<{ label: string; content: string }> {
  if (type === 'algorithm') {
    return [
      { label: 'Problem', content: '' },
      { label: 'Algorithm', content: '' },
      { label: 'Proof', content: '' },
      { label: 'Runtime', content: '' },
    ];
  }
  if (type === 'exam_question' || type === 'exercise_question') {
    if (format === 'multiple_choice') {
      return [
        { label: 'Content', content: '' },
        { label: 'Option A', content: '' },
        { label: 'Option B', content: '' },
        { label: 'Option C', content: '' },
        { label: 'Option D', content: '' },
      ];
    }
    if (format === 'flashcard') {
      return [
        { label: 'Front', content: '' },
        { label: 'Back', content: '' },
      ];
    }
    return [
      { label: 'Content', content: '' },
      { label: 'Solution', content: '' },
    ];
  }
  return [
    { label: 'Content', content: '' },
    { label: type === 'proof' ? 'Proof Sketch' : 'Solution', content: '' },
  ];
}

function AddContentModal({
  versionId,
  topics,
  activeTypes = BUILT_IN_TYPES,
  onSaveDefaultSections,
  onClose,
}: {
  versionId: string;
  topics: Topic[];
  activeTypes?: { label: string; value: string; default_sections?: { label: string; content: string }[] }[];
  onSaveDefaultSections?: (type: string, sections: { label: string; content: string }[]) => Promise<void>;
  onClose: () => void;
}) {
  const createContent = useCreateContent();
  const updateContent = useUpdateContent();
  const [type, setType] = useState(() => activeTypes?.[0]?.value ?? 'proof');
  const [questionFormat, setQuestionFormat] = useState('open');
  const [correctOptions, setCorrectOptions] = useState<string[]>([]);
  const [explanation, setExplanation] = useState('');
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [topicId, setTopicId] = useState('');
  const [formError, setFormError] = useState('');
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadingIdxRef = useRef<number>(-1);

  const getSections = (t: string, fmt: string) => {
    const saved = activeTypes?.find((at) => at.value === t)?.default_sections;
    if (saved && saved.length > 0) return saved.map((s) => ({ ...s, content: '', imageFiles: [] as File[] }));
    return getDefaultSections(t, fmt).map((s) => ({ ...s, imageFiles: [] as File[] }));
  };

  const [sections, setSections] = useState<Array<{ label: string; content: string; imageFiles: File[] }>>(() => getSections(activeTypes?.[0]?.value ?? 'proof', 'open'));
  const [savedDefault, setSavedDefault] = useState(false);
  const addSection = () => setSections((s) => [...s, { label: '', content: '', imageFiles: [] }]);
  const addMCQOption = () => {
    const used = new Set(sections.map((s) => s.label.match(/^Option ([A-Z])$/)?.[1]).filter(Boolean));
    const next = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((l) => !used.has(l)) ?? 'A';
    setSections((s) => [...s, { label: `Option ${next}`, content: '', imageFiles: [] }]);
  };
  const removeSection = (i: number) => {
    if (!window.confirm('Remove this section?')) return;
    setSections((s) => s.filter((_, idx) => idx !== i));
  };
  const updateSection = (i: number, field: 'label' | 'content', value: string) =>
    setSections((s) => s.map((sec, idx) => idx === i ? { ...sec, [field]: value } : sec));
  const moveSection = (i: number, dir: -1 | 1) =>
    setSections((s) => { const a = [...s]; [a[i], a[i + dir]] = [a[i + dir], a[i]]; return a; });

  const triggerImageUpload = (sectionIdx: number) => {
    uploadingIdxRef.current = sectionIdx;
    imageInputRef.current?.click();
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    imageInputRef.current!.value = '';
    const idx = uploadingIdxRef.current;
    uploadingIdxRef.current = -1;
    if (!file || idx < 0) return;
    if (!file.type.startsWith('image/')) { setFormError('Only image files are allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { setFormError('Image must be under 5 MB'); return; }
    if ((sections[idx]?.imageFiles?.length ?? 0) >= 3) { setFormError('Maximum 3 images per section'); return; }
    setUploadingIdx(idx);
    setFormError('');
    try {
      const compressed = await compressImage(file);
      setSections((s) => s.map((sec, i) => i === idx ? { ...sec, imageFiles: [...sec.imageFiles, compressed] } : sec));
    } catch {
      setFormError('Image compression failed');
    } finally {
      setUploadingIdx(null);
    }
  };

  const removeImageFile = (sectionIdx: number, fileIdx: number) =>
    setSections((s) => s.map((sec, i) => i === sectionIdx ? { ...sec, imageFiles: sec.imageFiles.filter((_, fi) => fi !== fileIdx) } : sec));

  const isAlgorithm = type === 'algorithm';
  const isQuestion = type === 'exam_question' || type === 'exercise_question';
  const isMultipleChoice = isQuestion && questionFormat === 'multiple_choice';
  const formatOptions = type === 'exam_question' ? EXAM_QUESTION_FORMATS : EXERCISE_QUESTION_FORMATS;
  const availableOptions = sections
    .map((s) => s.label.match(/^Option ([A-Z])$/)?.[1])
    .filter(Boolean) as string[];

  useEffect(() => {
    setQuestionFormat('open');
    setCorrectOptions([]);
    setExplanation('');
    setSections(getSections(type, 'open').map((s) => ({ ...s, imageFiles: [] })));
  }, [type]);

  useEffect(() => {
    if (isQuestion) {
      setCorrectOptions([]);
      setExplanation('');
      setSections(getSections(type, questionFormat).map((s) => ({ ...s, imageFiles: [] })));
    }
  }, [questionFormat]);

  useEffect(() => {
    setCorrectOptions((prev) => prev.filter((o) => availableOptions.includes(o)));
  }, [sections]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setFormError('Title is required'); return; }
    if (!sections[0]?.content.trim() && !sections[0]?.imageFiles?.length) { setFormError('Content is required'); return; }
    if (isMultipleChoice && correctOptions.length === 0) { setFormError('Please select the correct answer'); return; }
    setFormError('');
    try {
      const junction = await createContent.mutateAsync({
        version_id: versionId,
        topic_id: topicId || undefined,
        type,
        title: title.trim(),
        content: sections[0]?.content || title.trim(),
        tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [],
        metadata: {
          ...(isQuestion ? { question_format: questionFormat } : {}),
          ...(isMultipleChoice && correctOptions.length > 0 ? { correct_option: correctOptions } : {}),
          ...(isMultipleChoice && explanation.trim() ? { explanation: explanation.trim() } : {}),
          sections: sections.filter((s) => s.label.trim() || s.content.trim() || s.imageFiles?.length).map((s) => ({ label: s.label.trim() || 'Section', content: s.content })),
        },
      });

      // Upload images if any
      const hasImages = sections.some((s) => s.imageFiles?.length);
      if (hasImages) {
        const itemId = junction.content_item_id;
        const sectionsWithUrls = await Promise.all(sections.map(async (sec) => {
          if (!sec.imageFiles?.length) return { label: sec.label.trim() || 'Section', content: sec.content };
          const urls = await Promise.all(sec.imageFiles.map(async (f) => {
            const { url } = await contentApi.uploadImage(itemId, f);
            return url;
          }));
          return { label: sec.label.trim() || 'Section', content: sec.content, images: urls };
        }));
        await updateContent.mutateAsync({
          id: itemId,
          body: {
            version_id: versionId,
            metadata: {
              ...(isQuestion ? { question_format: questionFormat } : {}),
              ...(isMultipleChoice && correctOptions.length > 0 ? { correct_option: correctOptions } : {}),
              ...(isMultipleChoice && explanation.trim() ? { explanation: explanation.trim() } : {}),
              sections: sectionsWithUrls.filter((s) => s.label || s.content || (s as any).images?.length),
            },
          },
        });
      }

      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create item');
    }
  };

  const INPUT_CLS = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900';

  return (
    <Modal title="Add Content Item" onClose={onClose} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT_CLS}>
            {activeTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {isQuestion && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Format *</label>
            <div className="flex gap-2 flex-wrap">
              {formatOptions.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setQuestionFormat(f.value)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${questionFormat === f.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

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
                  {!isMultipleChoice && (
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none">▲</button>
                      <button type="button" onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none">▼</button>
                    </div>
                  )}
                  <input
                    type="text"
                    value={sec.label}
                    onChange={(e) => updateSection(i, 'label', e.target.value)}
                    placeholder="Section name"
                    dir="auto"
                    readOnly={isMultipleChoice}
                    className={`flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 ${isMultipleChoice ? 'bg-gray-50 text-gray-500 cursor-default' : ''}`}
                  />
                  {(!isMultipleChoice || i > 0) && (
                    <button type="button" onClick={() => removeSection(i)} className="text-xs text-gray-400 hover:text-red-500 shrink-0">
                      Remove
                    </button>
                  )}
                </div>
                <LatexEditor value={sec.content} onChange={(v) => updateSection(i, 'content', v)} rows={3} placeholder="Use $...$ for inline LaTeX." />
                <div className="flex flex-wrap gap-2 pt-1">
                  {sec.imageFiles.map((f, fi) => (
                    <div key={fi} className="relative group w-16 h-16 shrink-0">
                      <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 object-cover rounded border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => removeImageFile(i, fi)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >×</button>
                    </div>
                  ))}
                  {sec.imageFiles.length < 3 && (
                    <button
                      type="button"
                      onClick={() => triggerImageUpload(i)}
                      disabled={uploadingIdx === i}
                      className="w-16 h-16 border-2 border-dashed border-gray-300 rounded text-gray-400 hover:border-gray-400 hover:text-gray-600 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors disabled:opacity-50"
                    >
                      {uploadingIdx === i ? '...' : <><span className="text-lg leading-none">+</span><span>Image</span></>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            {isMultipleChoice && (
              <button type="button" onClick={addMCQOption} className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-2 py-0.5 hover:border-gray-500">
                + Add Option
              </button>
            )}
            {!isMultipleChoice && (
              <button type="button" onClick={addSection} className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-2 py-0.5 hover:border-gray-500">
                + Add Section
              </button>
            )}
          </div>
        </div>

        {isMultipleChoice && availableOptions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer *</label>
            <div className="flex gap-2 flex-wrap">
              {availableOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setCorrectOptions((prev) => prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt])}
                  className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-colors ${correctOptions.includes(opt) ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {isMultipleChoice && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (optional)</label>
            <LatexEditor value={explanation} onChange={setExplanation} rows={3} placeholder="Explain why the answer is correct..." />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
          <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="induction, graphs, BFS (comma-separated)" dir="auto" className={INPUT_CLS} />
        </div>

        {formError && <p className="text-sm text-red-500">{formError}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          {onSaveDefaultSections && (
            <button
              type="button"
              onClick={async () => {
                await onSaveDefaultSections(type, sections.filter((s) => s.label.trim() || s.content.trim()).map((s) => ({ label: s.label.trim() || 'Section', content: '' })));
                setSavedDefault(true);
                setTimeout(() => setSavedDefault(false), 2000);
              }}
              className={`text-xs border rounded-md px-3 py-1.5 transition-colors ${savedDefault ? 'border-green-300 text-green-600 bg-green-50' : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400'}`}
            >
              {savedDefault ? '✓ Saved as default' : 'Save sections as default for this type'}
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:border-gray-500">
              Cancel
            </button>
            <button type="submit" disabled={createContent.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
              {createContent.isPending ? 'Adding...' : 'Add'}
            </button>
          </div>
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
  const searchParams = useSearchParams();
  const openItemId = searchParams.get('item');
  const { user } = useAuth();
  const { data: currentUser } = useCurrentUser();
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'type' | 'alpha'>('default');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showAddContent, setShowAddContent] = useState(false);
  const [showManageTopics, setShowManageTopics] = useState(false);
  const [showManageTypes, setShowManageTypes] = useState(false);
  const [showEditVersion, setShowEditVersion] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDrive, setShowDrive] = useState(false);
  const deleteVersion = useDeleteVersion();
  const updateVersion = useUpdateVersion();

  const { data: course } = useCourse(courseId);
  const { data: version, isLoading: versionLoading } = useVersion(versionId);
  const { data: topics } = useTopics(versionId);
  const { data: items, isLoading: itemsLoading } = useVersionContent({
    version_id: versionId,
  });

  const isAdmin = !!currentUser?.is_admin;
  const isAuthor = !!user && !!version && (user.id === version.author_id || isAdmin);

  const { data: activeVersions } = useActiveVersions(!!user);
  const enrollCourse = useEnrollCourse();
  const isEnrolled = (activeVersions ?? []).some((v) => v.version_id === versionId && v.enrolled);

  const handlePractice = async () => {
    if (user && !isEnrolled) {
      await enrollCourse.mutateAsync(versionId).catch(() => {});
    }
    router.push(`/practice/${versionId}`);
  };

  const TYPE_ORDER: Record<string, number> = { exam_question: 0, exercise_question: 1, proof: 2, algorithm: 3, other: 4 };

  const allTags = Array.from(new Set(items?.flatMap((i) => i.content_item.tags) ?? [])).sort();
  const searchLower = search.toLowerCase();
  const filteredItems = (items ?? []).filter((i) => {
    if (selectedTopic && i.topic_id !== selectedTopic) return false;
    if (selectedType && i.content_item.type !== selectedType) return false;
    if (selectedTag && !i.content_item.tags.includes(selectedTag)) return false;
    if (searchLower && !i.content_item.title.toLowerCase().includes(searchLower) && !i.content_item.content.toLowerCase().includes(searchLower)) return false;
    return true;
  });
  const visibleItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'alpha') return a.content_item.title.localeCompare(b.content_item.title, undefined, { sensitivity: 'base' });
    if (sortBy === 'type') {
      const ta = TYPE_ORDER[a.content_item.type] ?? 5;
      const tb = TYPE_ORDER[b.content_item.type] ?? 5;
      return ta - tb;
    }
    // default: by creation time
    return new Date(a.content_item.created_at).getTime() - new Date(b.content_item.created_at).getTime();
  });

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

      {/* Header + Tab bar card */}
      <div className="mb-6 border border-gray-200 rounded-xl bg-white shadow-sm">
        {/* Header */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-5">
            {/* Course icon */}
            <div className="shrink-0 w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </div>

            {/* Title, meta, stats */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-400 mb-1">
                {[
                  version.institution,
                  version.year,
                  version.semester ? (SEMESTER_LABEL[version.semester] ?? `Semester ${version.semester}`) : null,
                ].filter(Boolean).join(' · ')}
              </p>
              <h1 className="text-2xl font-bold text-gray-900 mb-2.5">
                {course?.title ?? version.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                {items && items.length > 0 && (
                  <span className="text-sm text-gray-500">{items.length} items</span>
                )}
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${version.visibility === 'public' ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
                  {version.visibility === 'public' ? 'Public' : 'Private'}
                </span>
                {version.is_recommended && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                    Recommended
                  </span>
                )}
              </div>
              {(version.course_number || version.lecturer_name || version.description) && (
                <p className="text-gray-500 text-sm whitespace-pre-wrap mt-2">
                  {[
                    version.course_number ?? null,
                    version.lecturer_name ? `Lectures by ${version.lecturer_name}` : null,
                    version.description ?? null,
                  ].filter(Boolean).join('\n')}
                </p>
              )}
              <div className="mt-2">
                <VersionAuthor authorId={version.author_id} />
              </div>
            </div>

            {/* Progress + CTA */}
            <div className="shrink-0 flex flex-col gap-3 w-52">
              {user && <ProgressBar versionId={versionId} userId={user.id} />}
              <button
                onClick={handlePractice}
                disabled={enrollCourse.isPending}
                className="flex items-center justify-center gap-2 bg-[#1e3a8a] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50 w-full"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                {enrollCourse.isPending ? 'Enrolling...' : 'Practice now'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="border-t border-gray-100 flex items-center justify-between px-3">
          {/* Topic tabs */}
          <div className="flex flex-wrap">
            <button
              onClick={() => setSelectedTopic('')}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${selectedTopic === '' ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              All
            </button>
            {topics?.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTopic(t.id)}
                className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${selectedTopic === t.id ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {t.title}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 py-2 shrink-0">
            {isAuthor && (
              <>
                <button
                  onClick={() => setShowAddContent(true)}
                  className="text-sm text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap flex items-center gap-1"
                >
                  <span className="text-base leading-none">+</span> Add Content
                </button>
                <div className="w-px h-4 bg-gray-200 mx-0.5" />
              </>
            )}
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            {isAuthor && (
              <>
                <div className="w-px h-4 bg-gray-200 mx-0.5" />
                <div className="relative">
                  <button
                    onClick={() => setShowSettingsMenu((v) => !v)}
                    title="Settings"
                    className={`p-1.5 rounded-lg transition-colors ${showSettingsMenu ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-100'}`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.69.07-1.08s-.03-.73-.07-1.08l2.34-1.84c.2-.16.26-.46.13-.7l-2.22-3.86c-.12-.22-.39-.3-.61-.22l-2.77 1.12c-.57-.44-1.18-.81-1.86-1.09l-.42-2.95A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.42 2.95c-.68.28-1.29.65-1.86 1.09L4.46 5.34c-.22-.08-.49 0-.61.22L1.63 9.42c-.13.24-.07.54.13.7l2.34 1.84c-.04.35-.07.7-.07 1.08s.03.73.07 1.08l-2.34 1.84c-.2.16-.26.46-.13.7l2.22 3.86c.12.22.39.3.61.22l2.77-1.12c.57.44 1.18.81 1.86 1.09l.42 2.95c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.42-2.95c.68-.28 1.29-.65 1.86-1.09l2.77 1.12c.22.08.49 0 .61-.22l2.22-3.86c.13-.24.07-.54-.13-.7l-2.34-1.84z" />
                    </svg>
                  </button>
                  {showSettingsMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowSettingsMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm">
                        <button
                          onClick={() => { setShowEditVersion(true); setShowSettingsMenu(false); }}
                          className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Edit version
                        </button>
                        <button
                          onClick={() => { setShowManageTopics(true); setShowSettingsMenu(false); }}
                          className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Manage topics
                        </button>
                        <button
                          onClick={() => { setShowManageTypes(true); setShowSettingsMenu(false); }}
                          className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Manage content types
                        </button>
                        <div className="my-1 border-t border-gray-100" />
                        <button
                          onClick={async () => {
                            setShowSettingsMenu(false);
                            if (!window.confirm('Delete this version? This cannot be undone.')) return;
                            await deleteVersion.mutateAsync({ id: versionId, templateId: courseId });
                            router.push(`/courses/${courseId}`);
                          }}
                          disabled={deleteVersion.isPending}
                          className="w-full text-left px-4 py-2 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          {deleteVersion.isPending ? 'Deleting...' : 'Delete version'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div>
        {/* Type + tag filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {[{ value: '', label: 'All' }, ...getActiveTypes(version)].map((t) => (
            <button key={t.value} onClick={() => { setSelectedType(t.value); setShowDrive(false); }} className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${!showDrive && selectedType === t.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>
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
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${selectedTag === tag ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}`}
                >
                  {tag}
                </button>
              ))}
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowDrive(true)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showDrive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Study Materials
            </button>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white w-40"
              />
            </div>
            <div className="relative">
            <button
              onClick={() => setShowSortMenu((v) => !v)}
              title="Sort"
              className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 text-xs px-2.5 ${showSortMenu || sortBy !== 'default' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="9" y1="18" x2="15" y2="18" />
              </svg>
              {sortBy !== 'default' && <span>{sortBy === 'type' ? 'Type' : 'A–Z'}</span>}
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm">
                  {([['default', 'Date added'], ['type', 'Type'], ['alpha', 'A–Z']] as const).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => { setSortBy(val); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 transition-colors flex items-center justify-between ${sortBy === val ? 'text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {lbl}
                      {sortBy === val && <span className="text-gray-400">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
            </div>
          </div>
        </div>

        {showDrive ? (
          <VersionDrive versionId={versionId} isAuthor={isAuthor} />
        ) : (
          <>
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
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'flex flex-col gap-2'}>
                {visibleItems.map((item) => (
                  <ContentItemCard
                    key={item.content_item_id}
                    item={item}
                    userId={user?.id}
                    versionId={versionId}
                    isVersionAuthor={isAuthor}
                    isAdmin={isAdmin}
                    topics={topics ?? []}
                    activeTypes={getActiveTypes(version)}
                    initialOpen={openItemId === item.content_item_id}
                    onSaveDefaultSections={isAuthor ? async (type, sections) => {
                      const current = getActiveTypes(version);
                      await updateVersion.mutateAsync({
                        id: versionId,
                        body: {
                          content_types: current.map((t) =>
                            t.value === type ? { ...t, default_sections: sections } : t
                          ),
                        },
                      });
                    } : undefined}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showManageTopics && <ManageTopicsModal versionId={versionId} topics={topics ?? []} onClose={() => setShowManageTopics(false)} />}
      {showManageTypes && version && <ManageTypesModal version={version} onClose={() => setShowManageTypes(false)} />}
      {showAddContent && <AddContentModal versionId={versionId} topics={topics ?? []} activeTypes={getActiveTypes(version)} onSaveDefaultSections={async (type, sections) => { const current = getActiveTypes(version); await updateVersion.mutateAsync({ id: versionId, body: { content_types: current.map((t) => t.value === type ? { ...t, default_sections: sections } : t) } }); }} onClose={() => setShowAddContent(false)} />}
      {showEditVersion && version && <EditVersionModal version={version} onClose={() => setShowEditVersion(false)} />}
    </div>
  );
}
