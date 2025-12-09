export function getAllTagsFromItems(items: any[]): string[] {
  const tagSet = new Set<string>()
  items.forEach((t: any) => {
    if (t.tags) {
      t.tags.forEach((tag: string) => tagSet.add(tag))
    }
  })
  return Array.from(tagSet).sort()
}
