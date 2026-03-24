'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCourse, useCourseVersions, useCreateVersion, useDeleteCourse, useActiveVersions, useEnrollCourse, useUnenrollCourse, useRateVersion, useUpdateCourse } from '@/hooks/useCourses';
import { useCurrentUser } from '@/hooks/useUsers';
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

function StarRating({ version, courseId, isLoggedIn }: { version: CourseVersion; courseId: string; isLoggedIn?: boolean }) {
  const [hover, setHover] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [rated, setRated] = useState(false);
  const rateVersion = useRateVersion(courseId);

  const filled = hover || userRating || Math.round(version.avg_rating ?? 0);

  const handleRate = (star: number) => {
    if (!isLoggedIn) return;
    rateVersion.mutate({ versionId: version.id, rating: star }, {
      onSuccess: () => { setUserRating(star); setRated(true); setTimeout(() => setRated(false), 2000); },
    });
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => handleRate(star)}
          onMouseEnter={() => isLoggedIn && setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`text-base leading-none transition-colors ${star <= filled ? 'text-yellow-400' : 'text-gray-200 dark:text-slate-700'} ${isLoggedIn ? 'cursor-pointer' : 'cursor-default'}`}
        >
          ★
        </button>
      ))}
      {version.avg_rating !== null && (
        <span className="text-xs text-gray-400 dark:text-slate-500 ml-0.5">
          {rated ? '✓' : `${version.avg_rating.toFixed(1)} (${version.rating_count})`}
        </span>
      )}
    </div>
  );
}

function VersionRow({
  version,
  courseId,
  onFork,
  isEnrolled,
  onEnroll,
  onUnenroll,
  enrolling,
  parentVersion,
  isLoggedIn,
}: {
  version: CourseVersion;
  courseId: string;
  onFork: (v: CourseVersion) => void;
  isEnrolled?: boolean;
  onEnroll?: () => void;
  onUnenroll?: () => void;
  enrolling?: boolean;
  parentVersion?: CourseVersion;
  isLoggedIn?: boolean;
}) {
  const [showLoginMsg, setShowLoginMsg] = useState(false);
  return (
    <div className="relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl hover:shadow-sm hover:border-gray-300 dark:hover:border-slate-600 transition-all cursor-pointer">
      <Link href={`/courses/${courseId}/versions/${version.id}`} className="absolute inset-0 rounded-xl" aria-label={formatVersionLabel(version)} />
      <div className="px-5 py-4 flex items-start gap-4">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-slate-100">
              {formatVersionLabel(version)}
            </span>
            {version.is_recommended && (
              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                Recommended
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full border ${version.visibility === 'public' ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400'}`}>
              {version.visibility === 'public' ? 'Public' : 'Private'}
            </span>
            <span className="relative z-10"><StarRating version={version} courseId={courseId} isLoggedIn={isLoggedIn} /></span>
          </div>

          {version.author && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              by{' '}
              <Link href={`/profile/${version.author.username}`} className="relative z-10 hover:text-gray-600 dark:hover:text-slate-300 underline underline-offset-2">
                {version.author.display_name ?? version.author.username}
              </Link>
            </p>
          )}

          {parentVersion && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              forked from{' '}
              <Link
                href={`/courses/${courseId}/versions/${parentVersion.id}`}
                className="relative z-10 hover:text-gray-600 underline underline-offset-2"
              >
                {formatVersionLabel(parentVersion)}
              </Link>
            </p>
          )}

          {(version.course_number || version.lecturer_name || version.description) && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5 whitespace-pre-line">
              {[
                version.course_number ?? null,
                version.lecturer_name ? `Lectures by ${version.lecturer_name}` : null,
                version.description ?? null,
              ].filter(Boolean).join('\n')}
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="relative z-10 shrink-0 flex flex-col items-end gap-2">
          {(onEnroll || onUnenroll) && (
            <button
              onClick={isEnrolled ? onUnenroll : onEnroll}
              disabled={enrolling}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 whitespace-nowrap ${
                isEnrolled
                  ? 'border-green-200 text-green-600 bg-green-50 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                  : 'border-[#1e3a8a] text-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white'
              }`}
            >
              {enrolling ? '...' : isEnrolled ? 'Enrolled ✓' : 'Enroll'}
            </button>
          )}
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => {
                if (!isLoggedIn) { setShowLoginMsg(true); setTimeout(() => setShowLoginMsg(false), 3000); return; }
                onFork(version);
              }}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              Fork →
            </button>
            {showLoginMsg && (
              <p className="text-xs text-red-500 whitespace-nowrap">Sign in to fork</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = !!currentUser?.is_admin;
  const { data: course, isLoading: courseLoading } = useCourse(courseId);
  const { data: versions, isLoading: versionsLoading } = useCourseVersions(courseId);
  const createVersion = useCreateVersion();
  const deleteCourse = useDeleteCourse();
  const updateCourse = useUpdateCourse();

  // Edit course modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSubject, setEditSubject] = useState('cs');
  const [editSubjectCustom, setEditSubjectCustom] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState('');

  const openEdit = () => {
    if (!course) return;
    setEditTitle(course.title);
    const knownSubjects = ['cs', 'math'];
    if (knownSubjects.includes(course.subject)) {
      setEditSubject(course.subject);
      setEditSubjectCustom('');
    } else {
      setEditSubject('custom');
      setEditSubjectCustom(course.subject);
    }
    setEditDesc(course.description ?? '');
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) { setEditError('Title is required'); return; }
    const subj = editSubject === 'custom' ? editSubjectCustom.trim() : editSubject;
    if (!subj) { setEditError('Subject is required'); return; }
    setEditError('');
    try {
      await updateCourse.mutateAsync({
        id: courseId,
        body: { title: editTitle.trim(), subject: subj, description: editDesc.trim() || null },
      });
      setShowEditModal(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update course');
    }
  };
  const { data: activeVersions } = useActiveVersions(!!user);
  const enrollCourse = useEnrollCourse();
  const unenrollCourse = useUnenrollCourse();
  const enrolledVersionIds = new Set((activeVersions ?? []).filter((v) => v.enrolled).map((v) => v.version_id));
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const handleEnroll = (versionId: string) => {
    setEnrollingId(versionId);
    enrollCourse.mutate(versionId, { onSettled: () => setEnrollingId(null) });
  };

  const handleUnenroll = (versionId: string) => {
    setEnrollingId(versionId);
    unenrollCourse.mutate(versionId, { onSettled: () => setEnrollingId(null) });
  };

  const handleDeleteCourse = async () => {
    if (!window.confirm(`Delete course "${course?.title}"? This will not delete existing versions.`)) return;
    await deleteCourse.mutateAsync(courseId);
    router.push('/');
  };

  const [showModal, setShowModal] = useState(false);
  const [forkFrom, setForkFrom] = useState<CourseVersion | null>(null);

  const [vInstitution, setVInstitution] = useState('');
  const [vYear, setVYear] = useState('');
  const [vSemester, setVSemester] = useState('');
  const [vLecturer, setVLecturer] = useState('');
  const [vCourseNumber, setVCourseNumber] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [vVisibility, setVVisibility] = useState<'public' | 'private'>('public');
  const [formError, setFormError] = useState('');

  const resetForm = () => {
    setVInstitution(''); setVYear(''); setVSemester(''); setVLecturer(''); setVCourseNumber(''); setVDesc(''); setVVisibility('public');
    setFormError('');
  };

  const openNewVersion = () => { setForkFrom(null); resetForm(); setShowModal(true); };

  const openFork = (v: CourseVersion) => {
    setForkFrom(v);
    setVInstitution(v.institution ?? '');
    setVYear(v.year ? String(v.year) : '');
    setVSemester(v.semester ?? '');
    setVLecturer(v.lecturer_name ?? '');
    setVCourseNumber(v.course_number ?? '');
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
        lecturer_name: vLecturer.trim() || undefined,
        course_number: vCourseNumber.trim() || undefined,
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

  const INPUT_CLS = 'w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-slate-500';

  if (courseLoading) return <div className="text-sm text-gray-400 dark:text-slate-500">Loading...</div>;
  if (!course) return <div className="text-sm text-red-500">Course not found.</div>;

  const versionsById = new Map((versions ?? []).map((v) => [v.id, v]));

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 dark:text-slate-500 mb-5">
        <Link href="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-2">/</span>
        <span>{course.title}</span>
      </div>

      {/* Course header card */}
      <div className="mb-6 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
        <div className="px-6 py-6">
          <div className="flex items-start gap-5">
            {/* Course icon */}
            <div className="shrink-0 w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-gray-500 dark:text-slate-400">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </div>

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              {course.subject && (
                <p className="text-sm text-gray-400 dark:text-slate-500 mb-1">{course.subject}</p>
              )}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{course.title}</h1>
              {course.description && (
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-2" dir={/[\u0590-\u05FF]/.test(course.description) ? 'rtl' : undefined}>
                  {course.description}
                </p>
              )}
              {!versionsLoading && (
                <p className="text-sm text-gray-400 dark:text-slate-500">
                  {versions?.length ?? 0} {versions?.length === 1 ? 'version' : 'versions'}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="shrink-0 flex flex-col items-end gap-2">
              {user && (
                <button
                  onClick={openNewVersion}
                  className="flex items-center gap-1.5 bg-[#1e3a8a] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-900 transition-colors whitespace-nowrap"
                >
                  <span className="text-base leading-none">+</span> New Version
                </button>
              )}
              {(isAdmin || user?.id === course.created_by) && (
                <button
                  onClick={openEdit}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  Edit course
                </button>
              )}
              {(isAdmin || user?.id === course.created_by) && (
                <button
                  onClick={handleDeleteCourse}
                  disabled={deleteCourse.isPending}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                >
                  {deleteCourse.isPending ? 'Deleting...' : 'Delete course'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Versions list */}
      {versionsLoading && <div className="text-sm text-gray-400 dark:text-slate-500">Loading versions...</div>}

      {!versionsLoading && versions && versions.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500">
          <p className="text-sm">No versions yet.</p>
          {user && (
            <button onClick={openNewVersion} className="mt-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 underline underline-offset-2">
              Create the first version
            </button>
          )}
        </div>
      )}

      {versions && versions.length > 0 && (
        <div className="space-y-2">
          {versions.map((v) => (
            <VersionRow
              key={v.id}
              version={v}
              courseId={courseId}
              onFork={openFork}
              isLoggedIn={!!user}
              isEnrolled={enrolledVersionIds.has(v.id)}
              onEnroll={user ? () => handleEnroll(v.id) : undefined}
              onUnenroll={user ? () => handleUnenroll(v.id) : undefined}
              enrolling={enrollingId === v.id}
              parentVersion={v.based_on_version_id ? versionsById.get(v.based_on_version_id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Edit Course Modal */}
      {showEditModal && (
        <Modal title="Edit Course" onClose={() => setShowEditModal(false)}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Title *</label>
              <input
                autoFocus
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                dir="auto"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Subject *</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[{ value: 'cs', label: 'Computer Science' }, { value: 'math', label: 'Mathematics' }, { value: 'custom', label: 'Other...' }].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setEditSubject(s.value)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      editSubject === s.value
                        ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {editSubject === 'custom' && (
                <input
                  type="text"
                  value={editSubjectCustom}
                  onChange={(e) => setEditSubjectCustom(e.target.value)}
                  placeholder="e.g. Physics, Biology..."
                  dir="auto"
                  className={INPUT_CLS}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                placeholder="Optional"
                dir="auto"
                className={`${INPUT_CLS} resize-none`}
              />
            </div>
            {editError && <p className="text-sm text-red-500">{editError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowEditModal(false)} className="text-sm px-4 py-2 border border-gray-300 dark:border-slate-600 dark:text-slate-300 rounded-md hover:border-gray-500 dark:hover:border-slate-400">
                Cancel
              </button>
              <button type="submit" disabled={updateCourse.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                {updateCourse.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* New Version / Fork Modal */}
      {showModal && (
        <Modal
          title={forkFrom ? `Fork: ${formatVersionLabel(forkFrom)}` : 'New Version'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Institution</label>
                <input autoFocus type="text" value={vInstitution} onChange={(e) => setVInstitution(e.target.value)} placeholder="e.g. HUJI" className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Year</label>
                <input type="number" value={vYear} onChange={(e) => setVYear(e.target.value)} placeholder="2025" min={2000} max={2100} className={INPUT_CLS} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Semester</label>
              <select value={vSemester} onChange={(e) => setVSemester(e.target.value)} className={INPUT_CLS}>
                <option value="">—</option>
                <option value="A">Semester A</option>
                <option value="B">Semester B</option>
                <option value="Summer">Summer</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Lecturer</label>
                <input type="text" value={vLecturer} onChange={(e) => setVLecturer(e.target.value)} placeholder="e.g. Prof. Cohen" className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Course Number</label>
                <input type="text" value={vCourseNumber} onChange={(e) => setVCourseNumber(e.target.value)} placeholder="e.g. 67101" className={INPUT_CLS} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
              <textarea value={vDesc} onChange={(e) => setVDesc(e.target.value)} rows={2} placeholder="Optional" dir="auto" className={`${INPUT_CLS} resize-none`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Visibility</label>
              <select value={vVisibility} onChange={(e) => setVVisibility(e.target.value as 'public' | 'private')} className={INPUT_CLS}>
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
              <button type="button" onClick={() => setShowModal(false)} className="text-sm px-4 py-2 border border-gray-300 dark:border-slate-600 dark:text-slate-300 rounded-md hover:border-gray-500 dark:hover:border-slate-400">Cancel</button>
              <button type="submit" disabled={createVersion.isPending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                {createVersion.isPending ? 'Creating...' : forkFrom ? 'Fork' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
