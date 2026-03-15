'use client';

import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
} from '@/hooks/useAnnouncements';
import { useCurrentUser } from '@/hooks/useUsers';
import { useState } from 'react';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function AnnouncementsPage() {
  const { data: announcements = [], isLoading } = useAnnouncements();
  const { data: currentUser } = useCurrentUser();
  const createAnnouncement = useCreateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  const isAdmin = !!currentUser?.is_admin;
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createAnnouncement.mutateAsync({ title: newTitle.trim(), content: newContent.trim() || undefined });
    setNewTitle('');
    setNewContent('');
    setShowCreate(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showCreate ? 'Cancel' : '+ New announcement'}
          </button>
        )}
      </div>

      {showCreate && isAdmin && (
        <form onSubmit={handleCreate} className="mb-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">New announcement</h2>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Content (optional)"
            rows={4}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-sm px-4 py-2 border border-slate-300 rounded-lg hover:border-slate-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createAnnouncement.isPending}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createAnnouncement.isPending ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading...</div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">No announcements yet</div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`bg-white border rounded-xl p-5 shadow-sm ${!a.is_read ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!a.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <h2 className="font-semibold text-slate-900">{a.title}</h2>
                  </div>
                  {a.content && <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{a.content}</p>}
                  <p className="text-xs text-slate-400 mt-2">{formatDate(a.created_at)}</p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => deleteAnnouncement.mutate(a.id)}
                    disabled={deleteAnnouncement.isPending}
                    className="text-slate-300 hover:text-red-500 transition-colors text-xl leading-none shrink-0 mt-0.5"
                    aria-label="Delete"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
