'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '@/hooks/useUsers';
import { useAllVersions } from '@/hooks/useCourses';
import type { CourseVersion } from '@lambda/shared';

const SUBJECT_LABEL: Record<string, string> = { cs: 'CS', math: 'Math', other: 'Other' };
const SUBJECT_COLOR: Record<string, string> = {
  cs: 'bg-blue-100 text-blue-700',
  math: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-600',
};

const SEMESTER_LABEL: Record<string, string> = {
  A: 'Sem A', B: 'Sem B', Summer: 'Summer',
  'א': 'Sem A', 'ב': 'Sem B', 'קיץ': 'Summer',
};

export default function AdminVersionsPage() {
  const router = useRouter();
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const { data: versions, isLoading } = useAllVersions();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!userLoading && !currentUser?.is_admin) router.replace('/');
  }, [userLoading, currentUser, router]);

  if (userLoading || !currentUser?.is_admin) return null;

  const filtered = query.trim()
    ? versions?.filter((v) => {
        const q = query.toLowerCase();
        const t = (v as any).course_templates;
        return (
          v.title.toLowerCase().includes(q) ||
          t?.title?.toLowerCase().includes(q) ||
          v.institution?.toLowerCase().includes(q) ||
          (v as any).author?.username?.toLowerCase().includes(q)
        );
      })
    : versions;

  const publicCount = versions?.filter((v) => v.visibility === 'public').length ?? 0;
  const privateCount = versions?.filter((v) => v.visibility === 'private').length ?? 0;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Versions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {versions
              ? `${versions.length} total · ${publicCount} public · ${privateCount} private`
              : 'Loading...'}
          </p>
        </div>
        <Link
          href="/admin/users"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          ← Users
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by course, version title, institution, or author..."
          autoFocus
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] dark:focus:ring-slate-500"
        />
      </div>

      {isLoading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>}

      {!isLoading && filtered?.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">No versions found.</p>
      )}

      {!isLoading && filtered && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((v) => <VersionRow key={v.id} version={v} />)}
        </div>
      )}
    </div>
  );
}

function VersionRow({ version }: { version: CourseVersion }) {
  const template = (version as any).course_templates;
  const author = (version as any).author;
  const parts = [version.institution, version.year, version.semester ? (SEMESTER_LABEL[version.semester] ?? version.semester) : null].filter(Boolean);

  return (
    <Link
      href={`/courses/${version.template_id}/versions/${version.id}`}
      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {template?.title ?? '—'}
          </p>
          {template?.subject && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${SUBJECT_COLOR[template.subject] ?? 'bg-gray-100 text-gray-600'}`}>
              {SUBJECT_LABEL[template.subject] ?? template.subject}
            </span>
          )}
          {version.visibility === 'private' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">Private</span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
          {parts.length ? parts.join(' · ') : version.title}
          {author ? ` · @${author.username}` : ''}
        </p>
      </div>
      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
