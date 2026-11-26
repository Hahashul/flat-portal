import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  requireAdmin, fail, readBody,
  checkEmail, checkPassword, createCustomerUser,
} from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

const FOREVER = '876000h' // about 100 years

// Admin accounts, and your own account, can never be changed from here.
async function loadTarget(userId, callerId) {
  if (!userId || typeof userId !== 'string') return { error: fail('userId is required') }
  if (userId === callerId) return { error: fail('You cannot change your own account here') }
  const { data: p } = await supabaseAdmin.from('profiles').select('id, role').eq('id', userId).maybeSingle()
  if (!p) return { error: fail('User not found', 404) }
  if (p.role === 'admin') return { error: fail('Admin accounts cannot be changed here', 403) }
  return { profile: p }
}

/* POST { orgId, email, password } -> add another login to an existing organization */
export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  const { orgId, email, password } = await readBody(request)
  const bad = checkEmail(email) || checkPassword(password)
  if (bad) return fail(bad)

  const { data: org } = await supabaseAdmin.from('organizations').select('id, is_demo').eq('id', orgId || '').maybeSingle()
  if (!org) return fail('Organization not found', 404)
  if (org.is_demo) return fail('Customer logins cannot be added to the demo organization', 400)

  const made = await createCustomerUser({ orgId, email, password })
  if (made.error) return made.error
  return NextResponse.json({ user: made.user }, { status: 201 })
}

/* PATCH { userId, action: 'disable' | 'enable' | 'reset_password', password? } */
export async function PATCH(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  const { userId, action, password } = await readBody(request)
  const t = await loadTarget(userId, auth.user.id)
  if (t.error) return t.error

  if (action === 'reset_password') {
    const bad = checkPassword(password)
    if (bad) return fail(bad)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
    if (error) return fail(error.message, 500)
    return NextResponse.json({ ok: true })
  }

  if (action === 'disable' || action === 'enable') {
    const off = action === 'disable'
    // 'disabled' cuts data access at once (the database checks it on every request);
    // the ban stops any new sign-in.
    const { error: pErr } = await supabaseAdmin.from('profiles').update({ disabled: off }).eq('id', userId)
    if (pErr) return fail(pErr.message, 500)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: off ? FOREVER : 'none' })
    if (error) return fail(error.message, 500)
    return NextResponse.json({ ok: true, disabled: off })
  }

  return fail('Unknown action')
}

/* DELETE { userId } -> remove one login (the organization and its data stay) */
export async function DELETE(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  const { userId } = await readBody(request)
  const t = await loadTarget(userId, auth.user.id)
  if (t.error) return t.error

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) return fail(error.message, 500)
  return NextResponse.json({ ok: true })
}
