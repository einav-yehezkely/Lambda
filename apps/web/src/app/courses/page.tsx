'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCourses, useCourseSubjects, useCreateCourse, useActiveVersions } from '@/hooks/useCourses';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUser } from '@/hooks/useUsers';
import { useCreateCourseRequest } from '@/hooks/useCourseRequests';
import { CourseCard } from '@/components/course/course-card';
import { Modal } from '@/components/ui/modal';

const SUBJECT_LABELS: Record<string, string> = {
  cs: 'Computer Science',
  math: 'Mathematics',
};

function formatSubject(s: string) {
  return SUBJECT_LABELS[s] ?? (s.charAt(0).toUpperCase() + s.slice(1));
}

export default function CoursesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = !!currentUser?.is_admin;

  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Admin: create course modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseSubject, setCourseSubject] = useState('cs');
  const [courseSubjectCustom, setCourseSubjectCustom] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [createError, setCreateError] = useState('');

  // Regular user: request course modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqSubject, setReqSubject] = useState('cs');
  const [reqSubjectCustom, setReqSubjectCustom] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqInstitution, setReqInstitution] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [reqError, setReqError] = useState('');
  const [reqSuccess, setReqSuccess] = useState(false);

  const { data: courses, isLoading, error } = useCourses({
    search: debouncedSearch || undefined,
    subject: subject || undefined,
    sort: 'recent',
  });

  const { data: uniqueSubjects = [] } = useCourseSubjects();
  const createCourse = useCreateCourse();
  const createRequest = useCreateCourseRequest();
  const { data: activeVersions } = useActiveVersions(!!user);
  const progressByCourseId = new Map((activeVersions ?? []).map((v) => [v.course_id, v]));

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim()) { setCreateError('Title is required'); return; }
    setCreateError('');
    try {
      const subj = courseSubject === 'custom' ? courseSubjectCustom.trim() : courseSubject;
      if (!subj) { setCreateError('Subject is required'); return; }
      const course = await createCourse.mutateAsync({
        title: courseTitle.trim(),
        subject: subj,
        description: courseDesc.trim() || undefined,
      });
      setShowCreateModal(false);
      setCourseTitle(''); setCourseSubject('cs'); setCourseSubjectCustom(''); setCourseDesc('');
      router.push(`/courses/${course.id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create course');
    }
  };

  const handleRequestCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqName.trim()) { setReqError('Course name is required'); return; }
    setReqError('');
    try {
      const subj = reqSubject === 'custom' ? reqSubjectCustom.trim() : reqSubject;
      await createRequest.mutateAsync({
        course_name: reqName.trim(),
        subject: subj || undefined,
        description: reqDesc.trim() || undefined,
        institution: reqInstitution.trim() || undefined,
        notes: reqNotes.trim() || undefined,
      });
      setReqSuccess(true);
    } catch (e) {
      setReqError(e instanceof Error ? e.message : 'Failed to submit request');
    }
  };

  const closeRequestModal = () => {
    setShowRequestModal(false);
    setReqName(''); setReqSubject('cs'); setReqSubjectCustom('');
    setReqDesc(''); setReqInstitution(''); setReqNotes('');
    setReqError(''); setReqSuccess(false);
  };

  // Subject options for the request form: existing subjects + "Other..."
  const knownSubjects = uniqueSubjects.length > 0
    ? uniqueSubjects
    : ['cs', 'math'];

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
          className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSubject('')}
            className={`text-sm px-3 py-2 rounded-md border transition-colors ${
              subject === ''
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white border-gray-300 text-gray-600 hover:border-gray-500'
            }`}
          >
            All
          </button>
          {uniqueSubjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`text-sm px-3 py-2 rounded-md border transition-colors ${
                subject === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-gray-500'
              }`}
            >
              {formatSubject(s)}
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
            />
          ))}
        </div>
      )}

      {/* CTA */}
      {user && !isLoading && (
        <div className="mt-16 text-center">
          <p className="text-sm text-slate-500">
            Didn&apos;t find the course you were looking for?{' '}
            {isAdmin ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-[#1e3a8a] font-semibold hover:underline"
              >
                Create a new course
              </button>
            ) : (
              <button
                onClick={() => setShowRequestModal(true)}
                className="text-[#1e3a8a] font-semibold hover:underline"
              >
                Request a course
              </button>
            )}
          </p>
        </div>
      )}

      {/* Admin: Create Course Modal */}
      {showCreateModal && (
        <Modal title="New Course" onClose={() => setShowCreateModal(false)}>
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
              <div className="flex flex-wrap gap-2 mb-2">
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
            {createError && <p className="text-sm text-red-500">{createError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:border-gray-500">
                Cancel
              </button>
              <button type="submit" disabled={createCourse.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                {createCourse.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* User: Request Course Modal */}
      {showRequestModal && (
        <Modal title="Request a Course" onClose={closeRequestModal}>
          {reqSuccess ? (
            <div className="py-4 text-center space-y-3">
              <p className="text-sm text-slate-700 font-medium">Your request has been submitted!</p>
              <p className="text-sm text-slate-500">We&apos;ll notify you by email once the course is added.</p>
              <div className="flex justify-center pt-2">
                <button onClick={closeRequestModal} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRequestCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course name *</label>
                <input
                  autoFocus
                  type="text"
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  placeholder="e.g. Algorithms"
                  dir="auto"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {knownSubjects.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReqSubject(s)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                        reqSubject === s
                          ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {formatSubject(s)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setReqSubject('custom')}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      reqSubject === 'custom'
                        ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    Other...
                  </button>
                </div>
                {reqSubject === 'custom' && (
                  <input
                    type="text"
                    value={reqSubjectCustom}
                    onChange={(e) => setReqSubjectCustom(e.target.value)}
                    placeholder="e.g. Physics, Biology, Economics..."
                    dir="auto"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Short description</label>
                <textarea
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                  rows={2}
                  placeholder="What is this course about?"
                  dir="auto"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                <input
                  type="text"
                  value={reqInstitution}
                  onChange={(e) => setReqInstitution(e.target.value)}
                  placeholder="e.g. Tel Aviv University"
                  dir="auto"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional notes</label>
                <textarea
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  rows={2}
                  placeholder="Any other details..."
                  dir="auto"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
              </div>
              {reqError && <p className="text-sm text-red-500">{reqError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeRequestModal} className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:border-gray-500">
                  Cancel
                </button>
                <button type="submit" disabled={createRequest.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                  {createRequest.isPending ? 'Submitting...' : 'Submit request'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
