'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCourses, useCreateCourse, useActiveVersions } from '@/hooks/useCourses';
import { useAuth } from '@/hooks/useAuth';
import { CourseCard } from '@/components/course/course-card';
import { Modal } from '@/components/ui/modal';

const SUBJECTS = [
  { value: '', label: 'All' },
  { value: 'cs', label: 'Computer Science' },
  { value: 'math', label: 'Mathematics' },
  { value: 'other', label: 'Other' },
];

export default function CoursesPage() {
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

  const { data: courses, isLoading, error } = useCourses({
    search: debouncedSearch || undefined,
    subject: subject || undefined,
    sort: 'recent',
  });

  const createCourse = useCreateCourse();
  const { data: activeVersions } = useActiveVersions(!!user);
  const progressByCourseId = new Map((activeVersions ?? []).map((v) => [v.course_id, v]));

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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Courses</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          dir="auto"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <div className="flex gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSubject(s.value)}
              className={`text-sm px-3 py-2 rounded-md border transition-colors ${
                subject === s.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-300 text-gray-600 hover:border-gray-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="text-sm text-gray-400">Loading courses...</div>}
      {error && <div className="text-sm text-red-500">Failed to load courses.</div>}
      {courses && courses.length === 0 && <div className="text-sm text-gray-400">No courses found.</div>}
      {courses && courses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              progress={progressByCourseId.get(course.id)}
            />
          ))}
        </div>
      )}

      {/* Create course CTA */}
      {user && !isLoading && (
        <div className="mt-16 text-center">
          <p className="text-sm text-slate-500">
            Didn&apos;t find the course you were looking for?{' '}
            <button
              onClick={() => setShowModal(true)}
              className="text-[#1e3a8a] font-semibold hover:underline"
            >
              Create a new course
            </button>
          </p>
        </div>
      )}

      {showModal && (
        <Modal title="New Course" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreateCourse} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                autoFocus
                type="text"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="e.g. Algorithms"
                dir="auto"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={courseDesc}
                onChange={(e) => setCourseDesc(e.target.value)}
                rows={2}
                placeholder="Optional"
                dir="auto"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:border-gray-500">
                Cancel
              </button>
              <button type="submit" disabled={createCourse.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                {createCourse.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
