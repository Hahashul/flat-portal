import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  requireAdmin, fail, readBody, fetchAll,
  checkEmail, checkPassword, createCustomerUser,
} from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

const DATA_TABLES = [
  'projects', 'wings', 'stages', 'flats', 'flat_charges', 'flat_installments',
  'payments', 'documents', 'drive_items', 'installment_templates', 'template_items',
]

const tally = (rows) => rows.reduce((m, r) => ((m[r.org_id] = (m[r.org_id] || 0) + 1), m), {})

/* GET /api/admin/customers                 -> list organizations + their users
   GET /api/admin/customers?export=<orgId>  -> download all of one org's data (JSON) */
export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  try {
    const exportId = new URL(request.url).searchParams.get('export')
    if (exportId) {
      const { data: org } = await supabaseAdmin.from('organizations').select('*').eq('id', exportId).maybeSingle()
      if (!org) return fail('Organization not found', 404)
      const out = { exported_at: new Date().toISOString(), organization: org }
      for (const t of DATA_TABLES) out[t] = await fetchAll(t, '*', (q) => q.eq('org_id', exportId))
      const safe = org.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'organization'
      return new NextResponse(JSON.stringify(out, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${safe}-export.json"`,
        },
      })
    }

    const [orgs, profiles, projects, flats, authList] = await Promise.all([
      fetchAll('organizations', 'id, name, is_demo, created_at'),
      fetchAll('profiles', 'id, role, full_name, disabled, org_id', (q) => q.not('org_id', 'is', null)),
      fetchAll('projects', 'org_id'),
      fetchAll('flats', 'org_id'),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])
    if (authList.error) throw new Error(authList.error.message)
    const byId = Object.fromEntries(authList.data.users.map((u) => [u.id, u]))
    const projectCount = tally(projects)
    const flatCount = tally(flats)

    const customers = orgs
      .map((o) => ({
        ...o,
        projects: projectCount[o.id] || 0,
        flats: flatCount[o.id] || 0,
        users: profiles
          .filter((p) => p.org_id === o.id)
          .map((p) => ({
            id: p.id,
            role: p.role,
            disabled: p.disabled,
            email: byId[p.id]?.email || null,
            last_sign_in_at: byId[p.id]?.last_sign_in_at || null,
          })),
      }))
      .sort((a, b) => Number(a.is_demo) - Number(b.is_demo) || a.name.localeCompare(b.name))

    return NextResponse.json({ customers })
  } catch (e) {
    return fail(e.message, 500)
  }
}

/* POST { orgName, email, password } -> new organization + its first login */
export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  const { orgName, email, password } = await readBody(request)
  const name = typeof orgName === 'string' ? orgName.trim() : ''
  if (name.length < 2 || name.length > 80) return fail('Organization name must be 2 to 80 characters')
  const bad = checkEmail(email) || checkPassword(password)
  if (bad) return fail(bad)

  const { data: existing, error: listErr } = await supabaseAdmin.from('organizations').select('name')
  if (listErr) return fail(listErr.message, 500)
  if (existing.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
    return fail('An organization with that name already exists', 409)
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organizations').insert({ name }).select('id, name').single()
  if (orgErr) return fail(orgErr.message, 500)

  const made = await createCustomerUser({ orgId: org.id, email, password })
  if (made.error) {
    await supabaseAdmin.from('organizations').delete().eq('id', org.id) // roll back
    return made.error
  }
  return NextResponse.json({ organization: org, user: made.user }, { status: 201 })
}

/* DELETE { orgId, confirmName } -> permanently wipe an organization:
   all its data, its uploaded files, and every login that belongs to it. */
export async function DELETE(request) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  const { orgId, confirmName } = await readBody(request)
  const { data: org } = await supabaseAdmin.from('organizations').select('*').eq('id', orgId || '').maybeSingle()
  if (!org) return fail('Organization not found', 404)
  if (org.is_demo) return fail('The demo organization cannot be deleted here', 400)
  if (confirmName !== org.name) return fail('Type the organization name exactly to confirm', 400)

  try {
    // Collect everything BEFORE deleting, because deleting rows loses the references.
    const users = await fetchAll('profiles', 'id, role', (q) => q.eq('org_id', orgId))
    const userIds = users.filter((u) => u.role !== 'admin').map((u) => u.id)
    const drive = await fetchAll('drive_items', 'storage_path', (q) => q.eq('org_id', orgId).not('storage_path', 'is', null))
    const docs = await fetchAll('documents', 'storage_path', (q) => q.eq('org_id', orgId))

    // 1. Data first. If this fails (nothing is half-deleted), we stop here.
    const { error: delErr } = await supabaseAdmin.from('organizations').delete().eq('id', orgId)
    if (delErr) return fail('Could not delete the organization: ' + delErr.message, 500)

    // 2. Files and logins. Problems here are reported, not fatal.
    const warnings = []
    for (const [bucket, rows] of [['drive', drive], ['documents', docs]]) {
      const paths = rows.map((r) => r.storage_path)
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await supabaseAdmin.storage.from(bucket).remove(paths.slice(i, i + 100))
        if (error) warnings.push(`${bucket} files: ${error.message}`)
      }
    }
    for (const id of userIds) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
      if (error) warnings.push(`user ${id}: ${error.message}`)
    }
    return NextResponse.json({ ok: true, warnings })
  } catch (e) {
    return fail(e.message, 500)
  }
}
