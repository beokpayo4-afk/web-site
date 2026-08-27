export function formatMoney(value: string | number) {
  const amount = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatShipping(value: string | number) {
  const amount = typeof value === 'string' ? Number(value) : value
  return amount > 0 ? formatMoney(amount) : 'Free'
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatStatus(value: string) {
  return value.replaceAll('_', ' ')
}

export function productTone(sku: string) {
  const palettes = [
    ['#1f4d3a', '#c45c26'],
    ['#16382b', '#d97706'],
    ['#3f3a32', '#b45309'],
    ['#1c3d4f', '#c2410c'],
    ['#44403c', '#1f4d3a'],
  ]
  const index = sku.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length
  return palettes[index]
}
