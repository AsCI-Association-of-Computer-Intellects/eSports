import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://es.asci-gvpce.in' : origin)
  ).replace(/\/$/, '')
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/tickets'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const safeNext = next.startsWith('/') ? next : '/tickets'
      return NextResponse.redirect(`${siteUrl}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=google`)
}
