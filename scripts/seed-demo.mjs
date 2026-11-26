// Fills the "Demo" organization with dummy data and makes sure the demo login exists.
// Safe to re-run: it wipes the Demo organization's data first, then rebuilds it.
//   npm run seed:demo
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const DEMO_EMAIL = 'demo@example.com' // reserved domain: can never receive mail
const die = (what, error) => { console.error(`${what}: ${error?.message || error}`); process.exit(1) }
const must = async (p, what) => { const { data, error } = await p; if (error) die(what, error); return data }

// Small seeded random generator so every run builds the same demo.
let seed = 20260101
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const round = (n, to) => Math.round(n / to) * to
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10)

// ---- 1. the Demo organization
let org = await must(db.from('organizations').select('id').eq('is_demo', true).limit(1).maybeSingle(), 'find demo org')
if (!org) org = await must(db.from('organizations').insert({ name: 'Demo', is_demo: true }).select('id').single(), 'create demo org')
const orgId = org.id

// ---- 2. wipe its data (children first)
for (const t of ['payments', 'flat_installments', 'flat_charges', 'documents', 'flats', 'template_items',
  'installment_templates', 'drive_items', 'wings', 'stages', 'projects']) {
  await must(db.from(t).delete().eq('org_id', orgId), `clear ${t}`)
}

// ---- 3. dummy data
const PLAN = [['Booking', 10], ['Plinth', 15], ['Slabs', 25], ['Brickwork', 15], ['Plaster', 15], ['Possession', 20]]
const PROJECTS = [
  { name: 'Sunrise Heights', wings: [['A', 12, 2], ['B', 12, 1]] },     // [wing, flats, current stage index]
  { name: 'Lakeview Residency', wings: [['A', 9, 3]] },
]
const FIRST = ['Aarav', 'Vihaan', 'Anaya', 'Diya', 'Rohan', 'Kavya', 'Arjun', 'Meera', 'Ishaan', 'Sneha', 'Kabir', 'Pooja', 'Nikhil', 'Riya', 'Aditya', 'Neha']
const LAST = ['Sharma', 'Patil', 'Joshi', 'Kulkarni', 'Deshmukh', 'Gupta', 'Iyer', 'Nair', 'Reddy', 'Mehta', 'Bhatt', 'Kale']
const SQFT = [420, 560, 640, 780, 920]
const MODES = ['Cheque', 'NEFT', 'UPI', 'RTGS']

let flatCount = 0, payCount = 0
const flatIds = []
for (const proj of PROJECTS) {
  const p = await must(db.from('projects').insert({ name: proj.name, org_id: orgId }).select('id').single(), 'create project')
  const stages = await must(db.from('stages')
    .insert(PLAN.map(([name], i) => ({ project_id: p.id, name, position: i + 1 }))).select('id, position'), 'create stages')
  stages.sort((a, b) => a.position - b.position)

  for (const [wname, count, stageIdx] of proj.wings) {
    const wing = await must(db.from('wings')
      .insert({ project_id: p.id, name: wname, current_stage_id: null }).select('id').single(), 'create wing')
    const cumulative = PLAN.slice(0, stageIdx + 1).reduce((s, [, pc]) => s + pc, 0)

    const rows = []
    for (let i = 0; i < count; i++) {
      const floor = Math.floor(i / 3) + 1
      const sqft = pick(SQFT)
      const roll = rnd()
      const status = roll < 0.72 ? 'Sold' : roll < 0.9 ? 'For Sale' : 'Owner'
      const holder = status === 'For Sale' ? null : `${pick(FIRST)} ${pick(LAST)}`
      rows.push({
        wing_id: wing.id, flat_no: `${floor}0${(i % 3) + 1}`, floor: String(floor),
        carpet_sqft: sqft, carpet_sqm: Math.round(sqft * 0.0929 * 100) / 100, status,
        holder_name: holder, phone: holder ? `90000${String(10000 + flatCount * 37 + i).slice(-5)}` : null,
        agreement_no: status === 'Sold' ? `AGR-26-${100 + flatCount + i}` : null,
        agreement_date: status === 'Sold' ? iso(60 + Math.floor(rnd() * 300)) : null,
      })
    }
    const flats = await must(db.from('flats').insert(rows).select('id, status, carpet_sqft'), 'create flats')
    flatCount += flats.length

    const charges = [], inst = [], pays = []
    for (const f of flats) {
      flatIds.push(f.id)
      if (f.status !== 'Sold') continue
      const agreement = round(f.carpet_sqft * pick([6500, 7000, 7500, 8000]), 1000)
      charges.push(
        { flat_id: f.id, name: 'Agreement value', amount: agreement },
        { flat_id: f.id, name: 'Stamp duty & registration', amount: round(agreement * 0.06, 100) },
        { flat_id: f.id, name: 'MSEB', amount: 25000 },
        { flat_id: f.id, name: 'Legal', amount: 15000 },
        { flat_id: f.id, name: 'GST', amount: round(agreement * 0.05, 100) },
      )
      PLAN.forEach(([, pc], i) => inst.push({ flat_id: f.id, stage_id: stages[i].id, percent: pc }))

      const target = round((agreement * cumulative / 100) * pick([1, 1, 1, 0.7, 0.5, 1.15]), 1000)
      const first = round(target * 0.6, 1000)
      const parts = target - first > 0 ? [first, target - first] : [first]
      parts.forEach((amount, k) => amount > 0 && pays.push({
        flat_id: f.id, amount, paid_on: iso(30 + Math.floor(rnd() * 170) + k * -15), note: pick(MODES),
      }))
    }
    if (charges.length) await must(db.from('flat_charges').insert(charges), 'create charges')
    if (inst.length) await must(db.from('flat_installments').insert(inst), 'create installments')
    if (pays.length) await must(db.from('payments').insert(pays), 'create payments')
    payCount += pays.length
    await must(db.from('wings').update({ current_stage_id: stages[stageIdx].id }).eq('id', wing.id), 'set stage')
  }
}

// If the summary view reads a stored "received" column instead of summing payments, keep it in step.
const sample = (await must(db.from('payments').select('flat_id').limit(1), 'check payments'))[0]
if (sample) {
  const sums = await must(db.from('payments').select('flat_id, amount').eq('org_id', orgId), 'read payments')
  const total = {}
  for (const x of sums) total[x.flat_id] = (total[x.flat_id] || 0) + Number(x.amount)
  const check = await must(db.from('flat_summary').select('received_amount').eq('id', sample.flat_id).single(), 'read summary')
  if (Number(check.received_amount) !== total[sample.flat_id]) {
    for (const [id, amt] of Object.entries(total)) await must(db.from('flats').update({ received_amount: amt }).eq('id', id), 'sync received')
    const again = await must(db.from('flat_summary').select('received_amount').eq('id', sample.flat_id).single(), 'recheck summary')
    if (Number(again.received_amount) !== total[sample.flat_id]) console.warn('WARNING: received amounts do not match the payments. Check how flat_summary calculates received_amount.')
  }
}

// ---- 4. the demo login (its password is random and nobody knows it; /api/demo signs in without one)
let demo = await must(db.from('profiles').select('id').eq('role', 'demo').limit(1).maybeSingle(), 'find demo user')
if (!demo) {
  const { data, error } = await db.auth.admin.createUser({
    email: DEMO_EMAIL, password: randomBytes(24).toString('base64url'), email_confirm: true,
  })
  if (error) die('create demo user', error)
  demo = { id: data.user.id }
}
await must(db.from('profiles').upsert({ id: demo.id, role: 'demo', org_id: orgId, full_name: 'Demo', disabled: false }, { onConflict: 'id' }), 'set demo profile')

console.log(`Done: ${PROJECTS.length} projects, ${flatCount} flats, ${payCount} payments. Demo login is ready.`)
