import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fail } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

/* POST /api/demo -> a signed-in session for the demo account.
   Public on purpose. It only ever returns a session for the one user whose role is 'demo',
   and the database lets that role read the Demo organization and nothing else.
   No password is involved: we mint a one-time sign-in token on the server and exchange it,
   so nothing secret sits in the browser code and nobody can lock the demo out by changing its password. */
export async function POST() {
  const unavailable = () => fail('The demo is not available right now.', 503)
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('id, disabled').eq('role', 'demo').limit(1).maybeSingle()
    if (!profile || profile.disabled) return unavailable()

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(profile.id)
    const email = u?.user?.email
    if (!email) return unavailable()

    const { data: link } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })
    const tokenHash = link?.properties?.hashed_token
    if (!tokenHash) return unavailable()

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data, error } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
    if (error || !data?.session) return unavailable()

    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
  } catch {
    return unavailable()
  }
}
