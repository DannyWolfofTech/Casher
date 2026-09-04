interface Page<T> { data: T[] | null; error: unknown; count?: number | null; }
/** Read past the API row cap. Never turn a failed page into partial totals. */
export async function readAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<Page<T>>, pageSize = 500): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error, count } = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (count != null && rows.length >= count) return rows;
    if (page.length === 0) {
      if (count != null && rows.length < count) throw new Error('Incomplete response. Please retry.');
      return rows;
    }
    if (count == null && page.length < pageSize) return rows;
  }
}
