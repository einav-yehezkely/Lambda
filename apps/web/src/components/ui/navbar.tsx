'use client';

import Link from 'next/link';
// import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import type { User as LambdaUser } from '@lambda/shared';
import { NotificationBell } from './notification-bell';

export function Navbar() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [profile, setProfile] = useState<LambdaUser | null>(null);
  const [cachedUsername, setCachedUsername] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCachedUsername(localStorage.getItem('lambda_username'));
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LambdaUser | null) => {
        if (data) {
          setProfile(data);
          localStorage.setItem('lambda_username', data.username);
          setCachedUsername(data.username);
        }
      })
      .catch(() => {});
  }, [user]);

  const profileUsername = profile?.username ?? cachedUsername;
  const displayName = profile?.display_name ?? profile?.username
    ?? user?.user_metadata?.full_name ?? user?.email;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-[#f8f9fa]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <img src="/lambda_icon_black.svg" alt="Lambda" className="h-7 w-auto" />
            <span className="text-xl font-bold tracking-tight text-slate-900">Lambda</span>
          </Link>

        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {loading ? null : user ? (
            <>
              {user.user_metadata?.avatar_url && profileUsername ? (
                <Link href={`/profile/${profileUsername}`} className="w-9 h-9 rounded-full border-2 border-white/20 overflow-hidden hover:opacity-80 transition-opacity">
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="avatar"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </Link>
              ) : user.user_metadata?.avatar_url ? (
                <div className="w-9 h-9 rounded-full border-2 border-white/20 overflow-hidden">
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="avatar"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : null}
              {profileUsername ? (
                <Link
                  href={`/profile/${profileUsername}`}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {displayName}
                </Link>
              ) : (
                <span className="text-sm font-medium text-slate-600">{displayName}</span>
              )}
              {profile?.is_admin && (
                <Link
                  href="/admin/course-requests"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Admin
                </Link>
              )}
              <NotificationBell isAdmin={!!profile?.is_admin} />
              <button
                onClick={signOut}
                className="text-sm text-slate-400 hover:text-slate-700 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="text-sm bg-[#1e3a8a] text-white px-4 py-2 rounded-lg hover:bg-blue-900 transition-colors font-medium"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
