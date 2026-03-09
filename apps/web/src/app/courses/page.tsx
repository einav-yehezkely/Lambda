'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCourses, useCreateCourse } from '@/hooks/useCourses';
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
  const [courseSubject, setCourseSubject] = useState<'cs' | 'math' | 'other'>('cs');
  const [courseDesc, setCourseDesc] = useState('');
  const [formError, setFormError] = useState('');

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
      const course = await createCourse.mutateAsync({
        title: courseTitle.trim(),
        subject: courseSubject,
        description: courseDesc.trim() || undefined,
      });
      setShowModal(false);
      setCourseTitle(''); setCourseSubject('cs'); setCourseDesc('');
      router.push(`/courses/${course.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create course');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
        {user && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700"
          >
            + New Course
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
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
            <CourseCard key={course.id} course={course} />
          ))}
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <select
                value={courseSubject}
                onChange={(e) => setCourseSubject(e.target.value as 'cs' | 'math' | 'other')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="cs">Computer Science</option>
                <option value="math">Mathematics</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={courseDesc}
                onChange={(e) => setCourseDesc(e.target.value)}
                rows={2}
                placeholder="Optional"
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
