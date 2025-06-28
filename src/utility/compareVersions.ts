export function isVersionGreaterOrEqual(v1: string, v2: string): boolean {
  const a = v1.split('.').map(Number)
  const b = v2.split('.').map(Number)
  const maxLength = Math.max(a.length, b.length)

  for (let i = 0; i < maxLength; i++) {
    const num1 = a[i] ?? 0
    const num2 = b[i] ?? 0

    if (num1 > num2) return true
    if (num1 < num2) return false
  }

  return true
}
