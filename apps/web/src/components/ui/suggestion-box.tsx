'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuth } from '@/hooks/useAuth';
import { usersApi } from '@/lib/api/users';

export function SuggestionBox() {
  const { user } = useAuth();
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
      await api.post('/api/feedback/suggest', {
        text: text.trim(),
        username: profile?.username ?? undefined,
      });
      setStatus('success');
      setText('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="glass-card rounded-xl border border-slate-200 p-4 mt-4">
      <h2 className="text-sm font-bold text-slate-900 mb-1">Suggest an Improvement</h2>
      <p className="text-[11px] text-slate-400 mb-3">
        Have an idea that could make the site better? We'd love to hear it.
      </p>

      {status === 'success' ? (
        <div className="text-center py-3">
          <p className="text-xs font-semibold text-green-600">Thanks for your feedback!</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); if (status === 'error') setStatus('idle'); }}
            placeholder="Write your idea here..."
            rows={3}
            dir="auto"
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] resize-none bg-white text-slate-800 placeholder:text-slate-300"
          />
          {status === 'error' && (
            <p className="text-[10px] text-red-500">Failed to send. Please try again.</p>
          )}
          <button
            type="submit"
            disabled={status === 'loading' || !text.trim()}
            className="w-full text-xs font-semibold py-2 rounded-lg bg-[#1e3a8a] text-white hover:bg-blue-900 disabled:opacity-40 transition-colors"
          >
            {status === 'loading' ? 'Sending...' : 'Submit'}
          </button>
        </form>
      )}
    </div>
  );
}
