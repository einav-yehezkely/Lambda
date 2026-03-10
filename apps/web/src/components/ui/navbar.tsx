'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import type { User as LambdaUser } from '@lambda/shared';

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
            <span className="text-2xl font-bold text-[#1e3a8a]">λ</span>
            <span className="text-xl font-bold tracking-tight text-slate-900">Lambda</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/courses"
              className="text-sm font-medium text-slate-600 hover:text-[#1e3a8a] transition-colors"
            >
              Courses
            </Link>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {loading ? null : user ? (
            <>
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
              {user.user_metadata?.avatar_url ? (
                <div className="w-9 h-9 rounded-full border-2 border-[#1e3a8a]/20 overflow-hidden">
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="avatar"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : null}
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
