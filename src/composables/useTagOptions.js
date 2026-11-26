import axios from 'axios'

// Tag options come from the enabled categories: every tag of every category is an option.
// Cached for the page session so reopening the editor doesn't refetch.
let cache = null

function buildOptions(categories) {
  const byKey = new Map()   // lower-case tag -> { label, categories: [] }
  for (const cat of categories) {
    if (!cat?.tags) continue
    for (const raw of String(cat.tags).split(',')) {
      const label = raw.trim()
      if (!label) continue
      const key = label.toLowerCase()
      if (!byKey.has(key)) byKey.set(key, { label, categories: [] })
      if (cat.title && !byKey.get(key).categories.includes(cat.title)) {
        byKey.get(key).categories.push(cat.title)
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export function loadTagOptions({ force = false } = {}) {
  if (!cache || force) {
    cache = axios
      .get(`${import.meta.env.VITE_API_BASE}/products/category-list-for-signup/`)
      .then(res => {
        const d = res.data
        const list = Array.isArray(d) ? d : (d?.results || d?.data || [])
        return buildOptions(list)
      })
      .catch(err => {
        cache = null   // let the next call retry
        throw err
      })
  }
  return cache
}

export const tagKey = t => String(t).trim().toLowerCase()
