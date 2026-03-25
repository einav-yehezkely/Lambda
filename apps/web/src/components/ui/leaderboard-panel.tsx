'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usersApi } from '@/lib/api/users';
import { SuggestionBox } from './suggestion-box';

function LeaderboardList({ data, isLoading }: { data: Awaited<ReturnType<typeof usersApi.getLeaderboard>> | undefined; isLoading: boolean }) {
  return (
    <>
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="w-6 h-4 bg-slate-100 dark:bg-slate-700 rounded" />
              <div className="w-7 h-7 bg-slate-100 dark:bg-slate-700 rounded-full shrink-0" />
              <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded flex-1" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">No contributors yet.</p>
      )}

      {!isLoading && data && data.length > 0 && (
        <ol className="space-y-2.5">
          {data.map((entry, index) => (
            <li key={entry.username} className="flex items-center gap-2 min-w-0">
              <span className={`text-xs font-bold w-5 text-center shrink-0 ${
                index === 0 ? 'text-yellow-500' :
                index === 1 ? 'text-slate-400' :
                index === 2 ? 'text-amber-600' :
                'text-slate-300'
              }`}>
                {index + 1}
              </span>
              {entry.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.avatar_url}
                  alt={entry.display_name ?? entry.username}
                  width={28}
                  height={28}
                  className="rounded-full shrink-0 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#1e3a8a]/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-[#1e3a8a]">
                    {(entry.display_name ?? entry.username)[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/profile/${entry.username}`}
                  className="text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-[#1e3a8a] dark:hover:text-blue-400 truncate block transition-colors"
                >
                  {entry.display_name ?? entry.username}
                </Link>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{entry.contribution_count} contribution{entry.contribution_count !== 1 ? 's' : ''}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function LeaderboardPanel() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => usersApi.getLeaderboard(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <>
      {/* ── Mobile: floating button + bottom drawer ── */}
      <div className="lg:hidden">
        {/* Floating button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-5 right-4 z-40 flex items-center gap-2 bg-[#1e3a8a] text-white pl-3 pr-4 py-2.5 rounded-full shadow-lg text-sm font-medium hover:bg-blue-900 transition-colors"
        >
          <span className="text-base leading-none">🏆</span>
          <span>Community</span>
        </button>

        {/* Bottom sheet */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            {/* Sheet */}
            <div className="relative bg-white dark:bg-slate-900 rounded-t-2xl max-h-[80vh] overflow-y-auto">
              {/* Drag handle */}
              <div className="sticky top-0 bg-white dark:bg-slate-900 pt-3 pb-2 px-4 border-b border-slate-100 dark:border-slate-800">
                <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏆</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Top Contributors</h2>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-4">
                <LeaderboardList data={data} isLoading={isLoading} />
              </div>
              <div className="px-4 pb-6">
                <SuggestionBox />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop: sticky sidebar ── */}
      <aside className="hidden lg:block w-64 shrink-0 ml-auto">
        <div className="glass-card rounded-xl border border-slate-200 dark:border-slate-700 p-4 sticky top-24">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🏆</span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Top Contributors</h2>
          </div>
          <LeaderboardList data={data} isLoading={isLoading} />
        </div>
        <SuggestionBox />
      </aside>
    </>
  );
}
