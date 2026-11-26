// Server-side only. Shared helpers for the /api/admin/* routes.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const fail = (message, status = 400) =>
  NextResponse.json({ error: message }, { status })

// The browser sends its session token as "Authorization: Bearer <token>".
// We verify it with Supabase, then confirm the caller is an enabled admin.
export async function requireAdmin(request) {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return { error: fail('Not signed in', 401) }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return { error: fail('Not signed in', 401) }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, disabled')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profile?.role !== 'admin' || profile?.disabled) {
    return { error: fail('Admins only', 403) }
  }
  return { user: data.user }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function checkEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim()) && email.length <= 254
    ? null
    : 'Enter a valid email address'
}

export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters'
  if (password.length > 72) return 'Password must be 72 characters or fewer'
  return null
}

export async function readBody(request) {
  try { return (await request.json()) || {} } catch { return {} }
}

// PostgREST returns at most 1000 rows per request, so page through.
export async function fetchAll(table, columns, filter) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let q = supabaseAdmin.from(table).select(columns).range(from, from + 999)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

// Create the login and attach it to an organization.
// (handle_new_user already made a bare profile row; we fill in role + org.)
export async function createCustomerUser({ orgId, email, password }) {
  const cleanEmail = email.trim().toLowerCase()
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
  })
  if (error) {
    const taken = /already|registered|exists/i.test(error.message)
    return { error: fail(taken ? 'That email already has an account' : error.message, taken ? 409 : 500) }
  }
  const { error: pErr } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'customer', org_id: orgId })
    .eq('id', data.user.id)
  if (pErr) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id)
    return { error: fail('Could not set up the profile: ' + pErr.message, 500) }
  }
  return { user: { id: data.user.id, email: cleanEmail } }
}
