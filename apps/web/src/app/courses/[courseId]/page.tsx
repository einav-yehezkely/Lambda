'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCourse, useCourseVersions, useCreateVersion } from '@/hooks/useCourses';
import { useAuth } from '@/hooks/useAuth';
import { Modal } from '@/components/ui/modal';
import type { CourseVersion } from '@lambda/shared';

function VersionCard({
  version,
  courseId,
  onFork,
}: {
  version: CourseVersion;
  courseId: string;
  onFork: (v: CourseVersion) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/courses/${courseId}/versions/${version.id}`}
          className="flex-1 min-w-0"
        >
          <h3 className="font-medium text-gray-900 hover:underline">{version.title}</h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
            {version.institution && <span>{version.institution}</span>}
            {version.year && <span>· {version.year}</span>}
          </div>
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
        <p className="mt-2 text-sm text-gray-500 line-clamp-2">{version.description}</p>
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

  const [showModal, setShowModal] = useState(false);
  const [forkFrom, setForkFrom] = useState<CourseVersion | null>(null);

  // Version form state
  const [vTitle, setVTitle] = useState('');
  const [vInstitution, setVInstitution] = useState('');
  const [vYear, setVYear] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [vVisibility, setVVisibility] = useState<'public' | 'private'>('public');
  const [formError, setFormError] = useState('');

  const openNewVersion = () => {
    setForkFrom(null);
    setVTitle(''); setVInstitution(''); setVYear(''); setVDesc(''); setVVisibility('public');
    setFormError('');
    setShowModal(true);
  };

  const openFork = (v: CourseVersion) => {
    setForkFrom(v);
    setVTitle(`${v.title} (fork)`);
    setVInstitution(v.institution ?? '');
    setVYear(v.year ? String(v.year) : '');
    setVDesc('');
    setVVisibility('public');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vTitle.trim()) { setFormError('Title is required'); return; }
    setFormError('');
    try {
      const version = await createVersion.mutateAsync({
        template_id: courseId,
        title: vTitle.trim(),
        institution: vInstitution.trim() || undefined,
        year: vYear ? Number(vYear) : undefined,
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
            <p className="mt-2 text-gray-500">{course.description}</p>
          )}
        </div>
        {user && (
          <button
            onClick={openNewVersion}
            className="shrink-0 bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-700"
          >
            + New Version
          </button>
        )}
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
              <VersionCard key={v.id} version={v} courseId={courseId} onFork={openFork} />
            ))}
          </div>
        )}
      </div>

      {/* New Version / Fork Modal */}
      {showModal && (
        <Modal
          title={forkFrom ? `Fork: ${forkFrom.title}` : 'New Version'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                autoFocus
                type="text"
                value={vTitle}
                onChange={(e) => setVTitle(e.target.value)}
                placeholder="e.g. Algorithms – HUJI 2025"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                <input
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={vDesc}
                onChange={(e) => setVDesc(e.target.value)}
                rows={2}
                placeholder="Optional"
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
                Will fork topics and content references from "{forkFrom.title}"
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
