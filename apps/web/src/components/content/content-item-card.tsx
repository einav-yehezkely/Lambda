'use client';

import { useState, useRef, useEffect } from 'react';
import type { VersionContentItem, Topic, QuestionFormat } from '@lambda/shared';
import { LatexContent } from './latex-content';
import { CommunitySolutions } from './community-solutions';
import { ReportErrorButton } from './report-error';
import { LatexEditor } from '../ui/latex-editor';
import { Modal } from '../ui/modal';
import { FlashCard } from './flash-card';
import { useUpdateContent, useDeleteContent } from '@/hooks/useTopics';
import { contentApi } from '@/lib/api/content';
import { compressImage } from '@/lib/compress-image';

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

const TOPIC_STRIP_COLORS = [
  '#264653', // Charcoal Blue
  '#2a9d8f', // Verdigris
  '#e9c46a', // Tuscan Sun
  '#f4a261', // Sandy Brown
  '#e76f51', // Burnt Peach
  '#457b9d', // Steel Blue
  '#52796f', // Dark Verdigris
  '#d4956a', // Muted Peach
  '#6b705c', // Sage
  '#a98467', // Warm Taupe
];

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'text-green-600',
  medium: 'text-yellow-600',
  hard: 'text-red-600',
};

const INPUT_CLS = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900';

const HE_RE = /[\u0590-\u05FF]/;
const hDir = (s?: string | null): 'rtl' | undefined => HE_RE.test(s ?? '') ? 'rtl' : undefined;

// ─── Edit Modal ───────────────────────────────────────────────────────────────

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

function EditModal({ item, topics, activeTypes, onSaveDefaultSections, onClose }: { item: VersionContentItem; topics: Topic[]; activeTypes?: { label: string; value: string }[]; onSaveDefaultSections?: (type: string, sections: { label: string; content: string }[]) => Promise<void>; onClose: () => void }) {
  const ci = item.content_item;
  const isAlgorithm = ci.type === 'algorithm';
  const updateContent = useUpdateContent();

  const [title, setTitle] = useState(ci.title);
  const [contentType, setContentType] = useState(ci.type);
  const [tagsInput, setTagsInput] = useState(ci.tags.join(', '));
  const [topicId, setTopicId] = useState(item.topic_id ?? '');
  const [questionFormat, setQuestionFormat] = useState<QuestionFormat>((ci.metadata?.question_format ?? 'open') as QuestionFormat);
  const [correctOptions, setCorrectOptions] = useState<string[]>(() => {
    const v = ci.metadata?.correct_option;
    return Array.isArray(v) ? v : v ? [v] : [];
  });
  const [explanation, setExplanation] = useState(ci.metadata?.explanation ?? '');
  const isCurrentQuestion = contentType === 'exam_question' || contentType === 'exercise_question';
  const isCurrentAlgorithm = contentType === 'algorithm';
  const isMultipleChoice = isCurrentQuestion && questionFormat === 'multiple_choice';
  const [sections, setSections] = useState<Array<{ label: string; content: string; images?: string[] }>>(() => {
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

  const isQuestionType = (t: string) => t === 'exam_question' || t === 'exercise_question';

  const handleTypeChange = (newType: string) => {
    const stayingQuestion = isQuestionType(contentType) && isQuestionType(newType);
    if (!stayingQuestion && sections.some((s) => s.content.trim())) {
      if (!window.confirm('Changing type will reset all sections. Continue?')) return;
    }
    setContentType(newType as typeof contentType);
    if (!stayingQuestion) {
      setQuestionFormat('open');
      setCorrectOptions([]);
      setSections(getDefaultSections(newType, 'open'));
    }
  };
  const [error, setError] = useState('');
  const [savedDefault, setSavedDefault] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadingIdxRef = useRef<number>(-1);

  const triggerImageUpload = (sectionIdx: number) => {
    uploadingIdxRef.current = sectionIdx;
    imageInputRef.current?.click();
  };

  const handleImageAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    imageInputRef.current!.value = '';
    const idx = uploadingIdxRef.current;
    uploadingIdxRef.current = -1;
    if (!file || idx < 0) return;
    if (!file.type.startsWith('image/')) { setError('Only image files are allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB'); return; }
    if ((sections[idx]?.images?.length ?? 0) >= 3) { setError('Maximum 3 images per section'); return; }
    setUploadingIdx(idx);
    setError('');
    try {
      const compressed = await compressImage(file);
      const { url } = await contentApi.uploadImage(ci.id, compressed);
      setSections((s) => s.map((sec, i) => i === idx ? { ...sec, images: [...(sec.images ?? []), url] } : sec));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed');
    } finally {
      setUploadingIdx(null);
    }
  };

  const removeImageFromSection = (sectionIdx: number, url: string) => {
    setSections((s) => s.map((sec, i) => i === sectionIdx ? { ...sec, images: (sec.images ?? []).filter((u) => u !== url) } : sec));
    contentApi.deleteImage(ci.id, url).catch(() => {/* ignore — orphan cleaned on item delete */});
  };

  const formatOptions = contentType === 'exam_question' ? EXAM_QUESTION_FORMATS : EXERCISE_QUESTION_FORMATS;
  const availableOptions = sections
    .map((s) => s.label.match(/^Option ([A-Z])$/)?.[1])
    .filter(Boolean) as string[];

  useEffect(() => {
    setCorrectOptions((prev) => prev.filter((o) => availableOptions.includes(o)));
  }, [sections]);

  const handleFormatChange = (fmt: QuestionFormat) => {
    if (sections.some((s) => s.content.trim())) {
      if (!window.confirm('Changing format will reset all sections. Continue?')) return;
    }
    setQuestionFormat(fmt);
    setCorrectOptions([]);
    setExplanation('');
    setSections(getDefaultSections(contentType, fmt));
  };

  const addSection = () => setSections((s) => [...s, { label: '', content: '' }]);
  const addMCQOption = () => {
    const used = new Set(sections.map((s) => s.label.match(/^Option ([A-Z])$/)?.[1]).filter(Boolean));
    const next = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((l) => !used.has(l)) ?? 'A';
    setSections((s) => [...s, { label: `Option ${next}`, content: '' }]);
  };
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
    if (!sections[0]?.content.trim() && !sections[0]?.images?.length) { setError('Content is required'); return; }
    if (isMultipleChoice && correctOptions.length === 0) { setError('Please select the correct answer'); return; }
    setError('');
    try {
      await updateContent.mutateAsync({
        id: item.content_item_id,
        body: {
          version_id: item.version_id,
          type: contentType,
          title: title.trim(),
          content: sections[0]?.content || title.trim(),
          tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [],
          topic_id: topicId || null,
          metadata: {
            ...(isCurrentQuestion ? { question_format: questionFormat } : {}),
            ...(isMultipleChoice && correctOptions.length > 0 ? { correct_option: correctOptions } : {}),
            ...(isMultipleChoice && explanation.trim() ? { explanation: explanation.trim() } : {}),
            sections: sections.filter((s) => s.label.trim() || s.content.trim() || s.images?.length).map((s) => ({ label: s.label.trim() || 'Section', content: s.content, ...(s.images?.length ? { images: s.images } : {}) })),
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
            {isCurrentAlgorithm ? 'Algorithm Name *' : 'Title *'}
          </label>
          <input autoFocus type="text" value={title} onChange={(e) => setTitle(e.target.value)} dir={hDir(title)} className={INPUT_CLS} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select value={contentType} onChange={(e) => handleTypeChange(e.target.value)} className={INPUT_CLS}>
            {(activeTypes ?? Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {isCurrentQuestion && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Format *</label>
            <div className="flex gap-2 flex-wrap">
              {formatOptions.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => handleFormatChange(f.value as QuestionFormat)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${questionFormat === f.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

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
                  {!isCurrentQuestion && (
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
                    dir={hDir(sec.label)}
                    readOnly={isCurrentQuestion}
                    className={`flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 ${isCurrentQuestion ? 'bg-gray-50 text-gray-500 cursor-default' : ''}`}
                  />
                  {(!isCurrentQuestion || (isMultipleChoice && i > 0)) && (
                    <button type="button" onClick={() => removeSection(i)} className="text-xs text-gray-400 hover:text-red-500 shrink-0">
                      Remove
                    </button>
                  )}
                </div>
                <LatexEditor value={sec.content} onChange={(v) => updateSection(i, 'content', v)} rows={3} />
                {/* Per-section images */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {(sec.images ?? []).map((url) => (
                    <div key={url} className="relative group w-16 h-16 shrink-0">
                      <img src={url} alt="" className="w-16 h-16 object-cover rounded border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => removeImageFromSection(i, url)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(sec.images?.length ?? 0) < 3 && (
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
            {isMultipleChoice && (
              <button type="button" onClick={addMCQOption} className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-2 py-0.5 hover:border-gray-500">
                + Add Option
              </button>
            )}
            {!isCurrentQuestion && (
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
          <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="comma-separated" dir="auto" className={INPUT_CLS} />
        </div>

        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageAdd} />

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          {onSaveDefaultSections && (
            <button
              type="button"
              onClick={async () => {
                await onSaveDefaultSections(ci.type, sections.filter((s) => s.label.trim() || s.content.trim()).map((s) => ({ label: s.label.trim() || 'Section', content: '' })));
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
            <button type="submit" disabled={updateContent.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
              {updateContent.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
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
  const isQuestion = content_item.type === 'exam_question' || content_item.type === 'exercise_question';
  const meta = content_item.metadata;
  const questionFormat = meta?.question_format;
  const isMultiChoice = questionFormat === 'multiple_choice';
  const isFlashcard = questionFormat === 'flashcard';
  const showCommunitySolutions = isQuestion && questionFormat !== 'multiple_choice' && questionFormat !== 'flashcard';
  const flashcardFront = meta?.sections?.find((s) => s.label === 'Front')?.content ?? content_item.content;
  const flashcardBack = meta?.sections?.find((s) => s.label === 'Back')?.content ?? content_item.solution ?? '';
  const [page, setPage] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    update();
    el.addEventListener('scroll', update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, []);

  const scrollTabs = (dir: -1 | 1) => tabsRef.current?.scrollBy({ left: dir * 120, behavior: 'smooth' });

  useEffect(() => {
    let el: HTMLElement | null = contentRef.current?.parentElement ?? null;
    while (el) {
      if (window.getComputedStyle(el).position === 'fixed') break;
      if (el.scrollHeight > el.clientHeight) { el.scrollTo(0, 0); break; }
      el = el.parentElement;
    }
  }, [page]);

  const isSolutionTab = (label?: string) =>
    !!label && (label.toLowerCase().includes('solution') || label === 'Proof Sketch');

  const renderSectionImages = (imgs?: string[]) =>
    imgs?.length ? (
      <div className="flex flex-col gap-2 mb-3">
        {imgs.map((url) => (
          <img key={url} src={url} alt="" onClick={() => setLightboxUrl(url)}
            className="w-full rounded border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity" />
        ))}
      </div>
    ) : null;

  const sections: { label: string; content: React.ReactNode }[] =
    (content_item.metadata?.sections?.length ?? 0) > 0
      ? content_item.metadata!.sections!.map((s) => ({
          label: s.label,
          content: <>{renderSectionImages(s.images)}<div className="text-gray-600" dir={hDir(s.content)}><LatexContent content={s.content} /></div></>,
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
    <Modal title={<LatexContent content={content_item.title} />} onClose={onClose} className="max-w-2xl">
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-full max-h-full rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div ref={contentRef} className="text-sm">
        {/* Type + difficulty */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[content_item.type] ?? 'bg-gray-100 text-gray-600'}`}>
            {TYPE_LABEL[content_item.type] ?? content_item.type}
          </span>
          {content_item.difficulty && (
            <span className={`text-xs font-medium ${DIFFICULTY_COLOR[content_item.difficulty]}`}>
              {content_item.difficulty}
            </span>
          )}
        </div>

        {/* Flashcard layout */}
        {isFlashcard ? (
          <FlashCard front={flashcardFront} back={flashcardBack} />
        ) : isMultiChoice ? (
          <div>
            {(() => {
              const raw = meta?.correct_option;
              const correctOpts = Array.isArray(raw) ? raw : raw ? [raw] : [];
              const rawSections = content_item.metadata?.sections ?? [];
              const optionRawSections = rawSections.filter((s) => /^Option [A-Z]$/.test(s.label));
              return (
                <>
                  <div className="mb-4">{sections[0]?.content}</div>
                  <div className="space-y-2 mb-4">
                    {optionRawSections.map((s) => {
                      const letter = s.label.replace('Option ', '');
                      const isCorrect = showSolution && correctOpts.includes(letter);
                      return (
                        <div
                          key={s.label}
                          className={`flex items-start gap-3 p-3 rounded-lg border text-sm transition-colors ${
                            isCorrect ? 'border-green-500 bg-green-50' : 'border-gray-200'
                          }`}
                        >
                          <span className={`font-semibold shrink-0 ${isCorrect ? 'text-green-600' : 'text-gray-500'}`}>
                            {letter}.
                          </span>
                          <div className={`flex-1 ${isCorrect ? 'text-green-700' : 'text-gray-600'}`} dir={hDir(s.content)}>
                            <LatexContent content={s.content} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!showSolution ? (
                    <button
                      type="button"
                      onClick={() => setShowSolution(true)}
                      className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                    >
                      Show solution
                    </button>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-green-600">
                        Correct answer{correctOpts.length > 1 ? 's' : ''}: {correctOpts.join(', ')}
                      </p>
                      {meta?.explanation && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-xs font-semibold text-blue-700 mb-1">Explanation</p>
                          <div className="text-sm text-blue-800" dir={hDir(meta.explanation)}>
                            <LatexContent content={meta.explanation} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <>
            {/* Section tabs */}
            {total > 1 && (
              <div className="relative flex items-end mb-4 border-b border-gray-100">
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={() => scrollTabs(-1)}
                    className="absolute left-0 bottom-0 z-10 h-full px-1.5 bg-gradient-to-r from-white from-60% to-transparent text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    ‹
                  </button>
                )}
                <div
                  ref={tabsRef}
                  className="flex gap-1 overflow-x-auto"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
                >
                  {sections.map((s, i) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setPage(i)}
                      className={`text-xs px-3 py-1.5 rounded-t-md border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                        i === page
                          ? 'border-gray-900 text-gray-900 font-medium'
                          : 'border-transparent text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {canScrollRight && (
                  <button
                    type="button"
                    onClick={() => scrollTabs(1)}
                    className="absolute right-0 bottom-0 z-10 h-full px-1.5 bg-gradient-to-l from-white from-60% to-transparent text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    ›
                  </button>
                )}
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
          </>
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

        {showCommunitySolutions && isSolutionTab(current?.label) && <CommunitySolutions contentItemId={item.content_item_id} />}

        <ReportErrorButton contentItemId={item.content_item_id} />

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
  isAdmin,
  topics = [],
  activeTypes,
  onSaveDefaultSections,
  initialOpen,
}: {
  item: VersionContentItem;
  userId?: string;
  versionId?: string;
  isVersionAuthor?: boolean;
  isAdmin?: boolean;
  topics?: Topic[];
  activeTypes?: { label: string; value: string }[];
  onSaveDefaultSections?: (type: string, sections: { label: string; content: string }[]) => Promise<void>;
  initialOpen?: boolean;
}) {
  const { content_item } = item;
  const [showView, setShowView] = useState(initialOpen ?? false);
  const [showEdit, setShowEdit] = useState(false);
  const deleteContent = useDeleteContent();

  const canEdit = !!userId && (userId === content_item.author_id || !!isAdmin);
  const canDelete = !!userId && !!versionId && (userId === content_item.author_id || !!isVersionAuthor || !!isAdmin);
  const topicIndex = item.topic_id ? topics.findIndex((t) => t.id === item.topic_id) : -1;
  const topicName = topicIndex >= 0 ? topics[topicIndex]?.title : undefined;
  const stripColor = topicIndex >= 0 ? TOPIC_STRIP_COLORS[topicIndex % TOPIC_STRIP_COLORS.length] : '#e5e7eb';

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!versionId || !window.confirm('Remove this item from the version?')) return;
    deleteContent.mutate({ contentItemId: item.content_item_id, versionId });
  };

  return (
    <>
      <div
        className="bg-white border border-gray-200 rounded-lg hover:shadow-sm hover:border-gray-300 transition-all flex flex-col overflow-hidden"
      >
        <div className="h-1" style={{ backgroundColor: stripColor }} />
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
            <span className="text-xs text-gray-400" dir={hDir(topicName)}>{topicName}</span>
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
      {showEdit && <EditModal item={item} topics={topics} activeTypes={activeTypes} onSaveDefaultSections={onSaveDefaultSections} onClose={() => setShowEdit(false)} />}
    </>
  );
}
