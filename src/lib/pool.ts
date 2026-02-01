export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    for (;;) {
      const current = nextIndex
      nextIndex += 1
      if (current >= items.length) return
      results[current] = await fn(items[current], current)
    }
  })

  await Promise.all(workers)
  return results
}
