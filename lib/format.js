export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')

// ₹1.25 Cr, ₹8.4 L, ₹45,000: easier to read on cards
export const inrShort = (n) => {
  const v = Number(n || 0)
  const abs = Math.abs(v)
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return '₹' + v.toLocaleString('en-IN')
}