'use client';

import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useSiteInfo, useUpdateSiteInfo } from '@/hooks/useSiteInfo';

type Lang = 'en' | 'he';

interface Section {
  id: string;
  title: { en: string; he: string };
  body: { en: string; he: string };
}

function parseContent(content: string): Section[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="8" strokeWidth="3" strokeLinecap="round" />
      <line x1="12" y1="12" x2="12" y2="16" />
    </svg>
  );
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex items-center rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange('en')}
        className={`px-2.5 py-1 transition-colors ${lang === 'en' ? 'bg-slate-800 dark:bg-slate-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange('he')}
        className={`px-2.5 py-1 transition-colors ${lang === 'he' ? 'bg-slate-800 dark:bg-slate-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
      >
        HE
      </button>
    </div>
  );
}

export function InfoButton({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);

  const { data } = useSiteInfo();
  const update = useUpdateSiteInfo();

  const viewSections = parseContent(data?.content ?? '');

  const handleOpen = () => {
    setOpen(true);
    setEditing(false);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(false);
  };

  const handleEdit = () => {
    setSections(parseContent(data?.content ?? ''));
    setEditing(true);
  };

  const handleSave = async () => {
    await update.mutateAsync(JSON.stringify(sections));
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: { en: '', he: '' }, body: { en: '', he: '' } },
    ]);
  };

  const removeSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSection = (id: string, field: 'title' | 'body', lang: Lang, value: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, [field]: { ...s[field], [lang]: value } } : s,
      ),
    );
  };

  const modal = open ? (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">About Lambda</h2>
            {!editing && <LangToggle lang={lang} onChange={setLang} />}
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && !editing && (
              <button
                type="button"
                onClick={handleEdit}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Edit
              </button>
            )}
            {editing && (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={update.isPending}
                  className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1 rounded-md"
                >
                  {update.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {editing ? (
            <div className="space-y-3">
              {sections.map((s, i) => (
                <div key={s.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-3 bg-slate-50 dark:bg-slate-800">
                  {/* Section header row */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Section {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeSection(s.id)}
                      className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors text-xl leading-none"
                      aria-label="Remove section"
                    >
                      ×
                    </button>
                  </div>

                  {/* EN fields */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">EN</span>
                    <input
                      type="text"
                      value={s.title.en}
                      onChange={(e) => updateSection(s.id, 'title', 'en', e.target.value)}
                      placeholder="Title (English)"
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                    <textarea
                      value={s.body.en}
                      onChange={(e) => updateSection(s.id, 'body', 'en', e.target.value)}
                      placeholder="Content (English)"
                      rows={2}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {/* HE fields */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">HE</span>
                    <input
                      type="text"
                      value={s.title.he}
                      onChange={(e) => updateSection(s.id, 'title', 'he', e.target.value)}
                      placeholder="כותרת (עברית)"
                      dir="rtl"
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                    <textarea
                      value={s.body.he}
                      onChange={(e) => updateSection(s.id, 'body', 'he', e.target.value)}
                      placeholder="תוכן (עברית)"
                      dir="rtl"
                      rows={2}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addSection}
                className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Add section
              </button>
            </div>
          ) : viewSections.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">No content yet</p>
          ) : (
            <div className={`space-y-5 ${lang === 'he' ? 'text-right' : ''}`} dir={lang === 'he' ? 'rtl' : 'ltr'}>
              {viewSections.map((s) => (
                <div key={s.id}>
                  {s.title?.[lang] && (
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{s.title[lang]}</h3>
                  )}
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {s.body?.[lang]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        aria-label="Site info"
      >
        <InfoIcon />
      </button>
      {open && typeof document !== 'undefined' && createPortal(modal, document.body)}
    </>
  );
}
