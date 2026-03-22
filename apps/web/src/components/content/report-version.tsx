'use client';

import { useState } from 'react';
import { coursesApi } from '@/lib/api/courses';

export function ReportVersionButton({ versionId }: { versionId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setStatus('loading');
    try {
      await coursesApi.reportVersion(versionId, text.trim());
      setStatus('success');
      setText('');
      setTimeout(() => { setOpen(false); setStatus('idle'); }, 2000);
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Report version"
        className={`p-1.5 rounded-lg transition-colors ${open ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-400 hover:bg-red-50'}`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setText(''); setStatus('idle'); }} />
          <div className="absolute bottom-full right-0 mb-2 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
            {status === 'success' ? (
              <p className="text-xs text-green-600 font-medium py-1">Report sent. Thank you!</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-2">
                <p className="text-xs font-medium text-gray-700">Report an issue with this version</p>
                <textarea
                  autoFocus
                  value={text}
                  onChange={(e) => { setText(e.target.value); if (status === 'error') setStatus('idle'); }}
                  placeholder="Describe the issue..."
                  rows={3}
                  dir="auto"
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
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
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:border-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
