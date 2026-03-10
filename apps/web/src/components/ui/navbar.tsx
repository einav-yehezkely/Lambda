'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import type { User as LambdaUser } from '@lambda/shared';

export function Navbar() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [profile, setProfile] = useState<LambdaUser | null>(null);
  // Cached username so profile link works even if backend is temporarily down
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
      .catch(() => {}); // backend may not be running yet
  }, [user]);

  const profileUsername = profile?.username ?? cachedUsername;
  const displayName = profile?.display_name ?? profile?.username
    ?? user?.user_metadata?.full_name ?? user?.email;

  return (
    <nav className="sticky top-0 z-40 glass border-b border-white/30 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight text-[#1A365D]">
          λ Lambda
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/courses"
            className="text-sm text-[#1A365D]/70 hover:text-[#1A365D] transition-colors"
          >
            Courses
          </Link>

          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              {user.user_metadata?.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="avatar"
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full ring-2 ring-[#6366F1]/20"
                />
              )}
              {profileUsername ? (
                <Link
                  href={`/profile/${profileUsername}`}
                  className="text-sm text-[#1A365D]/80 hover:text-[#1A365D] transition-colors"
                >
                  {displayName}
                </Link>
              ) : (
                <span className="text-sm text-[#1A365D]/80">{displayName}</span>
              )}
              <button
                onClick={signOut}
                className="text-sm text-[#1A365D]/50 hover:text-[#1A365D] transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="text-sm bg-[#6366F1] text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
