import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export async function POST(request) {
  // 1. Who is calling? Must be a signed-in admin.
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: me } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  // 2. Read and check the request.
  const { email, full_name, phone, flat_ids } = await request.json()
  if (!email || !Array.isArray(flat_ids) || flat_ids.length === 0) {
    return NextResponse.json({ error: 'Email and at least one flat are required' }, { status: 400 })
  }
  const cleanEmail = email.trim().toLowerCase()

  // 3. Create the login, or reuse it if this person already has one.
  const password = tempPassword()
  let customerId = null
  let existing = false

  const created = await supabaseAdmin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (created.error) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const found = list?.users?.find((u) => u.email?.toLowerCase() === cleanEmail)
    if (!found) return NextResponse.json({ error: created.error.message }, { status: 400 })

    const { data: prof } = await supabaseAdmin
      .from('profiles').select('role').eq('id', found.id).single()
    if (prof?.role === 'admin') {
      return NextResponse.json({ error: 'That email belongs to an admin account' }, { status: 400 })
    }
    customerId = found.id
    existing = true
  } else {
    customerId = created.data.user.id
    await supabaseAdmin
      .from('profiles')
      .update({ full_name: full_name || null, phone: phone || null })
      .eq('id', customerId)
  }

  // 4. Link the flats to this person.
  const { error: linkErr } = await supabaseAdmin
    .from('flats').update({ customer_id: customerId }).in('id', flat_ids)
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 })

  return NextResponse.json({
    email: cleanEmail,
    password: existing ? null : password,
    existing,
  })
}