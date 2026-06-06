import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Sanitize Supabase URL: fixes common typos like prepended 'y' in 'yhttps://' 
// and trailing '/rest/v1' paths that break client requests.
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const sanitizedUrl = rawUrl
  .trim()
  .replace(/^yhttps/, 'https')
  .replace(/\/rest\/v1\/?$/, '')

const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    sanitizedUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}
