'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { useCurrentUser, useAllUsers, useSearchUsers } from '@/hooks/useUsers';
import type { User } from '@lambda/shared';

export default function AdminUsersPage() {
  const router = useRouter();
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    if (!userLoading && !currentUser?.is_admin) {
      router.replace('/');
    }
  }, [userLoading, currentUser, router]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: allUsers, isLoading: allLoading } = useAllUsers();
  const { data: searchResults, isLoading: searching } = useSearchUsers(debouncedQuery);

  const displayedUsers = debouncedQuery ? searchResults : allUsers;
  const isLoading = debouncedQuery ? searching : allLoading;

  if (userLoading || !currentUser?.is_admin) return null;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Users</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {allUsers
              ? debouncedQuery
                ? `${displayedUsers?.length ?? 0} of ${allUsers.length} users`
                : `${allUsers.length} users`
              : 'Loading...'}
          </p>
        </div>
        <Link
          href="/admin/course-requests"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          ← Course Requests
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username, name, or email..."
          autoFocus
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] dark:focus:ring-slate-500"
        />
      </div>

      {isLoading && (
        <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
      )}

      {!isLoading && debouncedQuery && displayedUsers?.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">No users found.</p>
      )}

      {!isLoading && displayedUsers && displayedUsers.length > 0 && (
        <div className="space-y-2">
          {displayedUsers.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ user }: { user: User }) {
  return (
    <Link
      href={`/profile/${user.username}`}
      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
    >
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.username}
          referrerPolicy="no-referrer"
          className="w-9 h-9 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm font-medium">
          {(user.display_name ?? user.username).charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
          {user.display_name ?? user.username}
          {user.is_admin && (
            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-normal">admin</span>
          )}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{user.username} · {user.email}</p>
      </div>
      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
