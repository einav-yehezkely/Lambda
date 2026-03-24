'use client';

import { useState } from 'react';
import { api } from '@/lib/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';

export function ReportErrorButton({ contentItemId }: { contentItemId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const { data: profile } = useQuery({
    queryKey: ['profile-by-id', user?.id],
    queryFn: () => usersApi.getProfileById(user!.id),
    enabled: !!user,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setStatus('loading');
    try {
      await api.post(`/api/content/${contentItemId}/report`, {
        error_text: text.trim(),
        reporter_username: profile?.username,
      });
      setStatus('success');
      setText('');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="mt-4 text-xs text-green-600 font-medium">
        Report sent. Thank you!
      </div>
    );
  }

  return (
    <div className="mt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 transition-colors"
        >
          Report a mistake
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <p className="text-xs font-medium text-gray-600 dark:text-slate-300">What is the mistake?</p>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => { setText(e.target.value); if (status === 'error') setStatus('idle'); }}
            placeholder="Describe the mistake..."
            rows={3}
            dir="auto"
            className="w-full text-xs border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
          {status === 'error' && (
            <p className="text-xs text-red-500">Failed to send. Please try again.</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={status === 'loading' || !text.trim()}
              className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {status === 'loading' ? 'Sending...' : 'Send report'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setText(''); setStatus('idle'); }}
              className="text-xs px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-md hover:border-gray-500 dark:text-slate-300 dark:hover:border-slate-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
