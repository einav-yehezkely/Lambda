'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCourses, useCourseSubjects, useCreateCourse, useActiveVersions } from '@/hooks/useCourses';
import { useAuth } from '@/hooks/useAuth';
import { CourseCard } from '@/components/course/course-card';
import { Modal } from '@/components/ui/modal';
import { LeaderboardPanel } from '@/components/ui/leaderboard-panel';

const SUBJECT_LABELS: Record<string, string> = {
  cs: 'Computer Science',
  math: 'Mathematics',
};

function formatSubject(s: string) {
  return SUBJECT_LABELS[s] ?? (s.charAt(0).toUpperCase() + s.slice(1));
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [courseTitle, setCourseTitle] = useState('');
  const [courseSubject, setCourseSubject] = useState('cs');
  const [courseSubjectCustom, setCourseSubjectCustom] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [formError, setFormError] = useState('');

  const { data: activeVersions } = useActiveVersions(!!user);
  const { data: uniqueSubjects = [] } = useCourseSubjects();

  const progressByCourseId = new Map((activeVersions ?? []).map((v) => [v.course_id, v]));

  const { data: courses, isLoading, error } = useCourses({
    search: debouncedSearch || undefined,
    subject: subject || undefined,
    sort: 'recent',
  });

  const createCourse = useCreateCourse();

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim()) { setFormError('Title is required'); return; }
    setFormError('');
    try {
      const subject = courseSubject === 'custom'
        ? courseSubjectCustom.trim()
        : courseSubject;
      if (!subject) { setFormError('Subject is required'); return; }
      const course = await createCourse.mutateAsync({
        title: courseTitle.trim(),
        subject,
        description: courseDesc.trim() || undefined,
      });
      setShowModal(false);
      setCourseTitle(''); setCourseSubject('cs'); setCourseSubjectCustom(''); setCourseDesc('');
      router.push(`/courses/${course.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create course');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_256px] gap-x-8">
      {/* Hero / Search Section - spans both columns */}
      <div className="lg:col-span-2 flex flex-col items-center text-center mb-14">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
          What will you master today?
        </h1>
        <div className="w-full max-w-2xl relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search courses, topics, or concepts..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            dir="auto"
            className="w-full h-14 pl-12 pr-4 rounded-xl border-none bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-200 focus:ring-2 focus:ring-[#1e3a8a] focus:outline-none transition-all text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Subject filter tags */}
        <div className="flex gap-2 mt-4 flex-wrap justify-center">
          <button
            onClick={() => setSubject('')}
            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
              subject === ''
                ? 'bg-[#1e3a8a]/10 text-[#1e3a8a] border-[#1e3a8a]/20'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {uniqueSubjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                subject === s
                  ? 'bg-[#1e3a8a]/10 text-[#1e3a8a] border-[#1e3a8a]/20'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {formatSubject(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Course content - left column */}
      <div className="min-w-0">
      {/* In Progress Section */}
      {user && activeVersions && activeVersions.some((v) => v.enrolled) && (
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">In Progress</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeVersions.filter((v) => v.enrolled).map((v) => {
              const pct = v.total > 0 ? Math.round((v.solved / v.total) * 100) : 0;
              return (
                <Link
                  key={v.version_id}
                  href={`/courses/${v.course_id}/versions/${v.version_id}`}
                  className="glass-card rounded-xl p-5 border border-slate-200 hover:shadow-lg transition-all group block"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                        {v.course_title}
                      </p>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#1e3a8a] transition-colors line-clamp-1">
                        {v.version_title}
                      </h3>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-[#1e3a8a]">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1e3a8a] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{v.solved} / {v.total} solved</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Course Grid */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-slate-900">
            {subject ? formatSubject(subject) : 'All Courses'}
          </h2>
          <a href="/courses" className="text-sm font-semibold text-[#1e3a8a] hover:underline">
            View all
          </a>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-white border border-slate-200 overflow-hidden animate-pulse">
                <div className="h-36 bg-slate-100" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500">Failed to load courses.</div>
        )}

        {!isLoading && courses && courses.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">∅</div>
            <p className="text-sm">No courses found.</p>
          </div>
        )}

        {!isLoading && courses && courses.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
              />
            ))}
          </div>
        )}
      </section>

      </div>

      {/* Leaderboard - right column */}
      <LeaderboardPanel />

      {/* New Course Modal */}
      {showModal && (
        <Modal title="New Course" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreateCourse} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input
                autoFocus
                type="text"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="e.g. Algorithms"
                dir="auto"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Subject *</label>
              <div className="flex gap-2 mb-2">
                {[{ value: 'cs', label: 'Computer Science' }, { value: 'math', label: 'Mathematics' }, { value: 'custom', label: 'Other...' }].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setCourseSubject(s.value)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      courseSubject === s.value
                        ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {courseSubject === 'custom' && (
                <input
                  type="text"
                  value={courseSubjectCustom}
                  onChange={(e) => setCourseSubjectCustom(e.target.value)}
                  placeholder="e.g. Physics, Biology, Economics..."
                  dir="auto"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={courseDesc}
                onChange={(e) => setCourseDesc(e.target.value)}
                rows={2}
                placeholder="Optional"
                dir="auto"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] resize-none"
              />
            </div>
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-sm px-4 py-2 border border-slate-300 rounded-lg hover:border-slate-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createCourse.isPending}
                className="text-sm px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-900 disabled:opacity-50 font-medium"
              >
                {createCourse.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
