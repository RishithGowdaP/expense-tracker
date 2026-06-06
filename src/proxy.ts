import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Sanitize Supabase URL: fixes common typos like prepended 'y' in 'yhttps://' 
// and trailing '/rest/v1' paths that break client requests.
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const sanitizedUrl = rawUrl
  .trim()
  .replace(/^yhttps/, 'https')
  .replace(/\/rest\/v1\/?$/, '')

const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Set up the Supabase client inside proxy to handle request/response cookies
  const supabase = createServerClient(
    sanitizedUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session if it has expired (necessary for Server Components)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // Protected Route Rules:
  // 1. Redirect users trying to access dashboard pages without logging in
  if (url.pathname.startsWith('/dashboard')) {
    if (!user) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // 2. Redirect logged-in users away from auth pages (login, signup) and root to dashboard
  if (url.pathname === '/login' || url.pathname === '/signup' || url.pathname === '/') {
    if (user) {
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, icons, or SVGs (static assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
