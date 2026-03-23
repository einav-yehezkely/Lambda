'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useUserProfile, useUserVersions, useUserStats, useUserSolutions, useCurrentUser } from '@/hooks/useUsers';
import { LatexContent } from '@/components/content/latex-content';
import { usersApi } from '@/lib/api/users';
import type { CourseVersionWithTemplate } from '@lambda/shared';
import type { UserSolution } from '@/lib/api/users';

const SEMESTER_LABEL: Record<string, string> = {
  A: 'Semester A', B: 'Semester B', Summer: 'Summer',
  'א': 'Semester A', 'ב': 'Semester B', 'קיץ': 'Summer',
};

function formatVersionLabel(version: CourseVersionWithTemplate): string {
  const parts = [
    version.institution,
    version.year,
    version.semester ? (SEMESTER_LABEL[version.semester] ?? `Semester ${version.semester}`) : null,
  ].filter(Boolean);
  return parts.join(' · ') || version.title;
}

const SUBJECT_LABEL: Record<string, string> = {
  cs: 'CS',
  math: 'Math',
  other: 'Other',
};

const SUBJECT_COLOR: Record<string, string> = {
  cs: 'bg-blue-100 text-blue-700',
  math: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-600',
};

function VersionRow({ version }: { version: CourseVersionWithTemplate }) {
  const template = version.course_templates;
  return (
    <Link
      href={`/courses/${version.template_id}/versions/${version.id}`}
      className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-md transition-colors"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{formatVersionLabel(version)}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {template?.title}
          {version.institution && ` · ${version.institution}`}
          {version.year && ` · ${version.year}`}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {version.is_recommended && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            Recommended
          </span>
        )}
        {template && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${SUBJECT_COLOR[template.subject]}`}>
            {SUBJECT_LABEL[template.subject]}
          </span>
        )}
        {version.visibility === 'private' && (
          <span className="text-xs text-gray-400">Private</span>
        )}
      </div>
    </Link>
  );
}

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

function UserSolutionRow({ solution }: { solution: UserSolution }) {
  const [expanded, setExpanded] = useState(false);
  const ci = solution.content_item;

  const firstVersion = ci?.version_content_items?.[0];
  const versionLink =
    firstVersion?.course_version && ci
      ? `/courses/${firstVersion.course_version.template_id}/versions/${firstVersion.version_id}?item=${ci.id}`
      : null;

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 mb-1">
        {ci && (
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLOR[ci.type] ?? 'bg-gray-100 text-gray-600'}`}>
            {TYPE_LABEL[ci.type] ?? ci.type}
          </span>
        )}
        <span
          className="text-sm font-medium text-gray-900 truncate flex-1 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          {ci ? <LatexContent content={ci.title} /> : 'Unknown question'}
        </span>
        {versionLink && (
          <Link
            href={versionLink}
            className="text-xs text-blue-600 hover:text-blue-800 shrink-0 px-2 py-0.5 rounded border border-blue-200 hover:border-blue-400 transition-colors"
          >
            View
          </Link>
        )}
        <span
          className="text-gray-300 shrink-0 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      {expanded && (
        <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 leading-relaxed">
          <LatexContent content={solution.content} />
        </div>
      )}
    </div>
  );
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const { data: profile, isLoading: profileLoading, error: profileError } = useUserProfile(username);
  const { data: versions, isLoading: versionsLoading } = useUserVersions(username);
  const { data: stats } = useUserStats(username);
  const { data: solutions, isLoading: solutionsLoading } = useUserSolutions(username);
  const { data: currentUser } = useCurrentUser();

  const [msgOpen, setMsgOpen] = useState(false);
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [msgSent, setMsgSent] = useState(false);

  async function handleSendMessage() {
    if (!msgSubject.trim() || !msgBody.trim()) return;
    setMsgSending(true);
    setMsgError(null);
    try {
      await usersApi.sendMessage(username, msgSubject.trim(), msgBody.trim());
      setMsgSent(true);
      setMsgSubject('');
      setMsgBody('');
      setTimeout(() => { setMsgOpen(false); setMsgSent(false); }, 1500);
    } catch (e: unknown) {
      setMsgError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setMsgSending(false);
    }
  }

  if (profileLoading) return <div className="text-sm text-gray-400">Loading...</div>;
  if (profileError || !profile) return <div className="text-sm text-red-500">User not found.</div>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-8">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.username}
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-full"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-500">
            {profile.username[0].toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">
              {profile.display_name ?? profile.username}
            </h1>
            {currentUser?.is_admin && (
              <button
                onClick={() => { setMsgOpen(true); setMsgSent(false); setMsgError(null); }}
                className="text-xs px-3 py-1 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
              >
                Send Message
              </button>
            )}
          </div>
          <p className="text-sm text-gray-400">@{profile.username}</p>
          {currentUser?.is_admin && profile.email && (
            <p className="text-xs text-gray-400 mt-0.5">{profile.email}</p>
          )}
          {stats && (
            <div className="flex gap-4 mt-2">
              <span className="text-xs text-gray-500">
                <span className="font-semibold text-gray-800">{stats.version_count}</span> versions
              </span>
              <span className="text-xs text-gray-500">
                <span className="font-semibold text-gray-800">{stats.solution_count}</span> solutions
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Versions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Versions {versions && `(${versions.length})`}
        </h2>

        {versionsLoading && <div className="text-sm text-gray-400">Loading...</div>}

        {versions && versions.length === 0 && (
          <div className="text-sm text-gray-400">No versions yet.</div>
        )}

        {versions && versions.length > 0 && (
          <div>
            {versions.map((v) => (
              <VersionRow key={v.id} version={v} />
            ))}
          </div>
        )}
      </div>

      {/* Solutions */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Solutions {solutions && solutions.length > 0 && `(${solutions.length})`}
        </h2>

        {solutionsLoading && <div className="text-sm text-gray-400">Loading...</div>}

        {!solutionsLoading && solutions && solutions.length === 0 && (
          <div className="text-sm text-gray-400">No solutions yet.</div>
        )}

        {solutions && solutions.length > 0 && (
          <div>
            {solutions.map((s) => (
              <UserSolutionRow key={s.id} solution={s} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← Home
        </Link>
      </div>

      {/* Send Message Modal (admin only) */}
      {msgOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setMsgOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Send message to @{username}
            </h2>

            {msgSent ? (
              <p className="text-sm text-green-600 text-center py-4">Message sent successfully!</p>
            ) : (
              <>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                  <input
                    type="text"
                    value={msgSubject}
                    onChange={(e) => setMsgSubject(e.target.value)}
                    placeholder="e.g. Your contribution to Lambda"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                  <textarea
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    rows={6}
                    placeholder="Write your message here..."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                  />
                </div>
                {msgError && (
                  <p className="text-xs text-red-500 mb-3">{msgError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setMsgOpen(false)}
                    className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={msgSending || !msgSubject.trim() || !msgBody.trim()}
                    className="text-sm px-4 py-2 rounded-lg bg-blue-900 text-white font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
                  >
                    {msgSending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
