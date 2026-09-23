'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.3 5.3C39.2 36.3 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  )
}

function LoginPanel() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/tickets'
  const authError = searchParams.get('error')
  const [error, setError] = useState<string | null>(authError ? 'Google sign-in did not complete. Try again.' : null)
  const [loading, setLoading] = useState(false)

  const handleGoogle = async () => {
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (
        process.env.NODE_ENV === 'production' ? 'https://es.asci-gvpce.in' : window.location.origin
      )
      const redirectTo = `${siteUrl.replace(/\/$/, '')}/auth/callback?next=${encodeURIComponent(next)}`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (oauthError) {
        setError(oauthError.message)
        setLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in')
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="mb-5 rounded-control border border-[rgba(255,90,120,0.28)] bg-[rgba(255,90,120,0.1)] px-3.5 py-2.5 text-sm text-[#ff8fa3]">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-border-strong bg-white px-6 py-3.5 font-display text-[15px] font-semibold text-[#1f1f1f] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        <GoogleIcon />
        {loading ? 'Redirecting to Google…' : 'Continue with Google'}
      </button>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md rounded-panel border border-border bg-surface p-7 sm:p-10">
          <div className="font-display text-[13px] font-semibold tracking-widest text-accent-bright">ACCOUNT</div>
          <h1 className="mt-2 text-[28px] leading-tight">Sign in with Google.</h1>
          <p className="mb-6 mt-2 text-sm">
            Use your Gmail to view tickets registered to that address, or register a team as leader.
          </p>
          <Suspense>
            <LoginPanel />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
