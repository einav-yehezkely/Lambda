'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCourse, useCourseVersions, useCreateVersion, useDeleteCourse } from '@/hooks/useCourses';
import { useAuth } from '@/hooks/useAuth';
import { Modal } from '@/components/ui/modal';
import type { CourseVersion } from '@lambda/shared';

const SEMESTER_LABEL: Record<string, string> = {
  A: 'Semester A', B: 'Semester B', Summer: 'Summer',
  'א': 'Semester A', 'ב': 'Semester B', 'קיץ': 'Summer',
};

function formatVersionLabel(version: CourseVersion): string {
  const parts = [
    version.institution,
    version.year,
    version.semester ? (SEMESTER_LABEL[version.semester] ?? `Semester ${version.semester}`) : null,
  ].filter(Boolean);
  return parts.join(' · ') || version.title;
}

function VersionCard({
  version,
  courseId,
  userId,
  onFork,
}: {
  version: CourseVersion;
  courseId: string;
  userId?: string;
  onFork: (v: CourseVersion) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/courses/${courseId}/versions/${version.id}`}
          className="flex-1 min-w-0"
        >
          <h3 className="font-medium text-gray-900 hover:underline">{formatVersionLabel(version)}</h3>
        </Link>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {version.is_recommended && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Recommended
            </span>
          )}
          {version.based_on_version_id && (
            <span className="text-xs text-gray-400">Fork</span>
          )}
          <button
            onClick={() => onFork(version)}
            className="text-xs text-gray-400 hover:text-gray-700 mt-1"
          >
            Fork →
          </button>
        </div>
      </div>
      {version.description && (
        <p className="mt-2 text-sm text-gray-500 whitespace-pre-wrap">{version.description}</p>
      )}
      {version.author && (
        <p className="mt-2 text-xs text-gray-400">
          by{' '}
          <Link href={`/profile/${version.author.username}`} className="hover:text-gray-600 underline underline-offset-2">
            {version.author.display_name ?? version.author.username}
          </Link>
        </p>
      )}
    </div>
  );
}

export default function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { data: course, isLoading: courseLoading } = useCourse(courseId);
  const { data: versions, isLoading: versionsLoading } = useCourseVersions(courseId);
  const createVersion = useCreateVersion();

  const deleteCourse = useDeleteCourse();

  const handleDeleteCourse = async () => {
    if (!window.confirm(`Delete course "${course?.title}"? This will not delete existing versions.`)) return;
    await deleteCourse.mutateAsync(courseId);
    router.push('/');
  };

  const [showModal, setShowModal] = useState(false);
  const [forkFrom, setForkFrom] = useState<CourseVersion | null>(null);

  // Version form state
  const [vInstitution, setVInstitution] = useState('');
  const [vYear, setVYear] = useState('');
  const [vSemester, setVSemester] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [vVisibility, setVVisibility] = useState<'public' | 'private'>('public');
  const [formError, setFormError] = useState('');

  const resetForm = () => {
    setVInstitution(''); setVYear(''); setVSemester(''); setVDesc(''); setVVisibility('public');
    setFormError('');
  };

  const openNewVersion = () => {
    setForkFrom(null);
    resetForm();
    setShowModal(true);
  };

  const openFork = (v: CourseVersion) => {
    setForkFrom(v);
    setVInstitution(v.institution ?? '');
    setVYear(v.year ? String(v.year) : '');
    setVSemester(v.semester ?? '');
    setVDesc('');
    setVVisibility('public');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const autoTitle = [
      vInstitution.trim(),
      vYear,
      vSemester ? (SEMESTER_LABEL[vSemester] ?? `Semester ${vSemester}`) : '',
    ].filter(Boolean).join(' · ') || course?.title || 'Untitled';
    try {
      const version = await createVersion.mutateAsync({
        template_id: courseId,
        title: autoTitle,
        institution: vInstitution.trim() || undefined,
        year: vYear ? Number(vYear) : undefined,
        semester: vSemester || undefined,
        description: vDesc.trim() || undefined,
        visibility: vVisibility,
        based_on_version_id: forkFrom?.id,
      });
      setShowModal(false);
      router.push(`/courses/${courseId}/versions/${version.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create version');
    }
  };

  if (courseLoading) return <div className="text-sm text-gray-400">Loading...</div>;
  if (!course) return <div className="text-sm text-red-500">Course not found.</div>;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 mb-4">
        <Link href="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-2">/</span>
        <span>{course.title}</span>
      </div>

      {/* Course header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
          {course.description && (
            <p className="mt-2 text-gray-500" dir={/[\u0590-\u05FF]/.test(course.description) ? 'rtl' : undefined}>{course.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user?.id === course.created_by && (
            <button
              onClick={handleDeleteCourse}
              disabled={deleteCourse.isPending}
              className="text-sm border border-red-200 text-red-500 px-3 py-2 rounded-md hover:border-red-400 hover:text-red-700 disabled:opacity-40"
            >
              Delete Course
            </button>
          )}
          {user && (
            <button
              onClick={openNewVersion}
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700"
            >
              + New Version
            </button>
          )}
        </div>
      </div>

      {/* Versions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Versions {versions && `(${versions.length})`}
        </h2>

        {versionsLoading && <div className="text-sm text-gray-400">Loading versions...</div>}

        {versions && versions.length === 0 && (
          <div className="text-sm text-gray-400">No versions yet.</div>
        )}

        {versions && versions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {versions.map((v) => (
              <VersionCard key={v.id} version={v} courseId={courseId} userId={user?.id} onFork={openFork} />
            ))}
          </div>
        )}
      </div>

      {/* New Version / Fork Modal */}
      {showModal && (
        <Modal
          title={forkFrom ? `Fork: ${formatVersionLabel(forkFrom)}` : 'New Version'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                <input
                  autoFocus
                  type="text"
                  value={vInstitution}
                  onChange={(e) => setVInstitution(e.target.value)}
                  placeholder="e.g. HUJI"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  value={vYear}
                  onChange={(e) => setVYear(e.target.value)}
                  placeholder="2025"
                  min={2000}
                  max={2100}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <select
                value={vSemester}
                onChange={(e) => setVSemester(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">—</option>
                <option value="A">Semester A</option>
                <option value="B">Semester B</option>
                <option value="Summer">Summer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={vDesc}
                onChange={(e) => setVDesc(e.target.value)}
                rows={2}
                placeholder="Optional"
                dir="auto"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
              <select
                value={vVisibility}
                onChange={(e) => setVVisibility(e.target.value as 'public' | 'private')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            {forkFrom && (
              <p className="text-xs text-gray-400">
                Will fork topics and content references from "{formatVersionLabel(forkFrom)}"
              </p>
            )}
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:border-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createVersion.isPending}
                className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                {createVersion.isPending ? 'Creating...' : forkFrom ? 'Fork' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
