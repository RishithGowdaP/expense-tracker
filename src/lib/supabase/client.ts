import { createBrowserClient } from '@supabase/ssr'

// Sanitize Supabase URL: fixes common typos like prepended 'y' in 'yhttps://' 
// and trailing '/rest/v1' paths that break client requests.
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const sanitizedUrl = rawUrl
  .trim()
  .replace(/^yhttps/, 'https')
  .replace(/\/rest\/v1\/?$/, '')

const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

export function createClient() {
  if (!sanitizedUrl || !anonKey) {
    console.error('Supabase URL or Anon Key is missing in environment variables.')
  }
  return createBrowserClient(sanitizedUrl, anonKey)
}
