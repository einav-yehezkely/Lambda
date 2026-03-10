'use client';

import { use } from 'react';
import Link from 'next/link';
import { useUserProfile, useUserVersions } from '@/hooks/useUsers';
import type { CourseVersionWithTemplate } from '@lambda/shared';

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
        <div className="text-sm font-medium text-gray-900">{version.title}</div>
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

export default function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const { data: profile, isLoading: profileLoading, error: profileError } = useUserProfile(username);
  const { data: versions, isLoading: versionsLoading } = useUserVersions(username);

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
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {profile.display_name ?? profile.username}
          </h1>
          <p className="text-sm text-gray-400">@{profile.username}</p>
        </div>
      </div>

      {/* Versions */}
      <div>
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

      <div className="mt-8">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← Home
        </Link>
      </div>
    </div>
  );
}
