type ErrorEntry = { status_code: number | string; error: string; count: number }

interface UrlAccum {
  total_requests: number
  success_count: number
  total_time: number
  errors: Map<string, { status_code: number | string; error: string; count: number }>
}

const store = new Map<string, Map<string, UrlAccum>>()

export function accumulateUrlMetrics(testId: string, perUrlMetrics: Record<string, any>) {
  if (!perUrlMetrics || typeof perUrlMetrics !== "object") return

  if (!store.has(testId)) store.set(testId, new Map())
  const testMap = store.get(testId)!

  for (const [url, m] of Object.entries(perUrlMetrics)) {
    if (!testMap.has(url)) {
      testMap.set(url, { total_requests: 0, success_count: 0, total_time: 0, errors: new Map() })
    }
    const acc = testMap.get(url)!

    acc.total_requests += (m as any).total_requests ?? 0
    acc.success_count += (m as any).success_count ?? 0
    acc.total_time    += (m as any).average_time ?? 0

    const errors: ErrorEntry[] = Array.isArray((m as any).errors) ? (m as any).errors : []
    for (const err of errors) {
      const key = `${err.status_code}::${err.error}`
      const existing = acc.errors.get(key)
      if (existing) {
        existing.count += err.count ?? 1
      } else {
        acc.errors.set(key, { status_code: err.status_code, error: err.error, count: err.count ?? 1 })
      }
    }
  }
}

export function getAccumulatedErrors(testId: string): Record<string, ErrorEntry[]> {
  const testMap = store.get(testId)
  if (!testMap) return {}

  const result: Record<string, ErrorEntry[]> = {}
  for (const [url, acc] of testMap.entries()) {
    result[url] = Array.from(acc.errors.values())
  }
  return result
}

export function clearUrlMetrics(testId: string) {
  store.delete(testId)
}
