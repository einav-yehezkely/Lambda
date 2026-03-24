'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  useAnnouncements,
  useMarkAllAnnouncementsRead,
  useCreateAnnouncement,
  useDeleteAnnouncement,
} from '@/hooks/useAnnouncements';

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

import type { Announcement } from '@lambda/shared';

function NotificationModal({ notification, onClose }: { notification: Announcement; onClose: () => void }) {
  const content = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{notification.title}</h2>
            {notification.target_user_id && (
              <span className="text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full shrink-0">
                Personal
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-xl leading-none shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {notification.content && (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-4">
            {notification.content}
          </p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(notification.created_at)}</p>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export function NotificationBell({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selected, setSelected] = useState<Announcement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: announcements = [] } = useAnnouncements();
  const markAllRead = useMarkAllAnnouncementsRead();
  const createAnnouncement = useCreateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  const unreadCount = announcements.filter((a) => !a.is_read).length;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Mark all read when opening
  useEffect(() => {
    if (open && unreadCount > 0) {
      markAllRead.mutate();
    }
  }, [open]);

  const handleOpen = () => setOpen((v) => !v);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createAnnouncement.mutateAsync({ title: newTitle.trim(), content: newContent.trim() || undefined });
    setNewTitle('');
    setNewContent('');
    setShowCreate(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        aria-label="Announcements"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Notifications</span>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowCreate((v) => !v)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {showCreate ? 'Cancel' : '+ New'}
              </button>
            )}
          </div>

          {showCreate && isAdmin && (
            <form onSubmit={handleCreate} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-2 bg-slate-50 dark:bg-slate-800">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title"
                className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Content (optional)"
                rows={3}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={createAnnouncement.isPending}
                className="w-full py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {createAnnouncement.isPending ? 'Sending...' : 'Post'}
              </button>
            </form>
          )}

          <div className="max-h-72 overflow-y-auto">
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No notifications</p>
            ) : (
              announcements.slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${!a.is_read ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100/60 dark:hover:bg-blue-900/30' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        {!a.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{a.title}</p>
                        {a.target_user_id && (
                          <span className="text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full shrink-0">
                            Personal
                          </span>
                        )}
                      </div>
                      {a.content && <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">{a.content}</p>}
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{formatDate(a.created_at)}</p>
                    </div>
                    {isAdmin && !a.target_user_id && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteAnnouncement.mutate(a.id); }}
                        className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors shrink-0 text-lg leading-none"
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/announcements"
              onClick={() => setOpen(false)}
              className="block w-full text-center text-xs text-blue-600 hover:text-blue-800 hover:bg-slate-50 dark:hover:bg-slate-800 py-2.5 transition-colors"
            >
              All notifications
            </Link>
          </div>
        </div>
      )}

      {selected && (
        <NotificationModal notification={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
