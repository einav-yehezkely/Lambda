'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usersApi } from '@/lib/api/users';
import { SuggestionBox } from './suggestion-box';

export function LeaderboardPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => usersApi.getLeaderboard(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <aside className="hidden lg:block w-64 shrink-0 ml-auto">
      <div className="glass-card rounded-xl border border-slate-200 dark:border-slate-700 p-4 sticky top-24">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🏆</span>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Top Contributors</h2>
        </div>

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
      </div>

      <SuggestionBox />
    </aside>
  );
}
