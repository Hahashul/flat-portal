// Run from the project root:
//   node --env-file=.env.local import.mjs          (dry run, writes nothing)
//   node --env-file=.env.local import.mjs --run    (real import)
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const RUN = process.argv.includes('--run')
const rows = JSON.parse(readFileSync('flats_import.json', 'utf8'))
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: project } = await db.from('projects').select('id').eq('name', '860 Shukrawar Peth').single()
const { data: wings } = await db.from('wings').select('id, name').eq('project_id', project.id)
const wingId = Object.fromEntries(wings.map((w) => [w.name, w.id]))

console.log(RUN ? 'REAL RUN' : 'DRY RUN (nothing is written)')
let ok = 0
for (const r of rows) {
  const { wing, charges, ...flat } = r
  const label = `${wing}-${flat.flat_no}`
  if (!RUN) {
    console.log(label.padEnd(10), String(flat.status).padEnd(9), String(flat.holder_name).slice(0, 40).padEnd(40),
      'received', flat.received_amount, 'charges', JSON.stringify(charges))
    continue
  }
  if (!flat.status) delete flat.status
  const { data, error } = await db.from('flats')
    .upsert({ ...flat, wing_id: wingId[wing] }, { onConflict: 'wing_id,flat_no' }).select('id').single()
  if (error) { console.log('FAILED', label, error.message); continue }
  const list = Object.entries(charges).map(([name, amount]) => ({ flat_id: data.id, name, amount }))
  if (list.length) {
    const { error: e2 } = await db.from('flat_charges').upsert(list, { onConflict: 'flat_id,name' })
    if (e2) { console.log('CHARGES FAILED', label, e2.message); continue }
  }
  ok++
}
console.log(RUN ? `Done: ${ok} of ${rows.length} flats imported` : `${rows.length} flats would be imported`)
