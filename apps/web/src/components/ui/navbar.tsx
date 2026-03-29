'use client';

import Link from 'next/link';
// import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import type { User as LambdaUser } from '@lambda/shared';
import { NotificationBell } from './notification-bell';
import { InfoButton } from './info-button';
import { useTheme } from '@/contexts/theme-context';

export function Navbar() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const { toggle } = useTheme();
  const [profile, setProfile] = useState<LambdaUser | null>(null);
  const [cachedUsername, setCachedUsername] = useState<string | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);

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
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-700 bg-[#f8f9fa]/80 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <img src="/lambda_icon_black.svg" alt="Lambda" className="h-7 w-auto dark:hidden" />
            <img src="/lambda_icon_white.svg" alt="Lambda" className="h-7 w-auto hidden dark:block" />
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Lambda</span>
          </Link>

        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Donate button – hidden on mobile (shown as FAB on homepage) */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setDonateOpen((o) => !o)}
              className="text-sm font-medium px-3 py-1.5 rounded-lg bg-[#1e3a8a] hover:bg-blue-900 text-white transition-colors"
            >
              <span className="hidden sm:inline">Donate </span>♥
            </button>
            {donateOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDonateOpen(false)} />
                <div className="absolute left-0 mt-2 w-44 rounded-xl shadow-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                  <a
                    href="https://www.bitpay.co.il/app/me/7255F29B-B884-D411-4FD8-1DAFC99F491FC4A6"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setDonateOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>💳</span> Bit
                  </a>
                  <a
                    href="https://paypal.me/einavye?locale.x=he_IL&country.x=IL"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setDonateOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>🅿️</span> PayPal
                  </a>
                </div>
              </>
            )}
          </div>

          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {/* Moon icon – visible in light mode */}
            <svg className="w-5 h-5 dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            {/* Sun icon – visible in dark mode */}
            <svg className="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
          <InfoButton isAdmin={!!profile?.is_admin} />
          {loading ? null : user ? (
            <>
              <NotificationBell isAdmin={!!profile?.is_admin} />
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
                  className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {displayName}
                </Link>
              ) : (
                <span className="hidden sm:inline text-sm font-medium text-slate-600">{displayName}</span>
              )}
              {profile?.is_admin && (
                <>
                  <Link
                    href="/admin/users"
                    className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Users
                  </Link>
                  <Link
                    href="/admin/course-requests"
                    className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Requests
                  </Link>
                </>
              )}
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
