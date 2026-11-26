<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useToast } from '@/composables/useToast'
import { loadTagOptions, tagKey } from '@/composables/useTagOptions'

const API = import.meta.env.VITE_API_BASE
const props = defineProps({
  creator: { type: Object, required: true },   // row from the Active Creators list
})
const emit = defineEmits(['close', 'updated'])
const toast = useToast()

const PLATFORMS = [
  {
    key: 'instagram', label: 'Instagram', field: 'instagram_handle', count: 'instagram_followers',
    unit: 'followers', placeholder: '@handle or instagram.com/… link',
  },
  {
    key: 'tiktok', label: 'TikTok', field: 'tiktok_handle', count: 'tiktok_followers',
    unit: 'followers', placeholder: '@handle or tiktok.com/@… link',
  },
  {
    key: 'youtube', label: 'YouTube', field: 'youtube_handle', count: 'youtube_subscribers',
    unit: 'subscribers', placeholder: '@channel, youtube.com link or UC… channel ID',
  },
]

const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS  = 180_000

const creatorId = computed(() => props.creator.id)

const loading   = ref(true)
const loadError = ref(null)
const creator   = ref(props.creator)

// Saved values (from the server) and the editable form values. '' means empty / cleared.
const saved  = reactive({ instagram_handle: '', tiktok_handle: '', youtube_handle: '' })
const form   = reactive({ instagram_handle: '', tiktok_handle: '', youtube_handle: '' })
const counts = reactive({ instagram_followers: null, tiktok_followers: null, youtube_subscribers: null })

// Tags: the creator's saved list and the list being edited (order matters)
const savedTags  = ref([])
const tags       = ref([])
const tagsLoaded = ref(false)
const tagsError  = ref(null)

const tagOptions        = ref([])     // [{ label, categories }]
const tagOptionsLoading = ref(true)
const tagOptionsError   = ref(null)
const tagQuery          = ref('')
const tagMenuOpen       = ref(false)
const tagHighlight      = ref(0)
const tagInput          = ref(null)

const fieldErrors = reactive({})
const formError   = ref(null)
const saving      = ref(false)
const refreshingCounts = ref(false)

// Background count refresh
const refreshing = ref(new Set())   // platform keys being fetched
const notFound   = ref(new Set())   // platform keys still null after the poll timed out
let pollTimer   = null
let pollStarted = 0

function unwrap(data) {
  return data?.creator || data?.data || data?.user || data
}

function displayName(c) {
  if (!c) return '—'
  const parts = [c.creator_first_name, c.creator_last_name].filter(Boolean)
  if (parts.length) return parts.join(' ')
  if (c.first_name) return `${c.first_name} ${c.last_name || ''}`.trim()
  return c.email || '—'
}

const norm = v => (v == null ? '' : String(v).trim())

function applyHandles(src) {
  for (const p of PLATFORMS) {
    if (p.field in src) {
      saved[p.field] = norm(src[p.field])
      form[p.field]  = saved[p.field]
    }
  }
}

function applyCounts(src) {
  for (const p of PLATFORMS) {
    if (p.count in src) counts[p.count] = src[p.count] ?? null
  }
}

const isDirty = field => norm(form[field]) !== saved[field]
const dirtyFields = computed(() => PLATFORMS.filter(p => isDirty(p.field)).map(p => p.field))
const tagsDirty   = computed(() =>
  tags.value.length !== savedTags.value.length || tags.value.some((t, i) => t !== savedTags.value[i]))
const changeCount = computed(() => dirtyFields.value.length + (tagsDirty.value ? 1 : 0))
const hasChanges  = computed(() => changeCount.value > 0)
const busy        = computed(() => saving.value || refreshingCounts.value)

function profileUrl(p, handle) {
  if (!handle) return null
  const h = encodeURIComponent(handle.replace(/^@/, ''))
  if (p.key === 'instagram') return `https://www.instagram.com/${h}/`
  if (p.key === 'tiktok')    return `https://www.tiktok.com/@${h}`
  if (/^UC[\w-]{22}$/.test(handle)) return `https://www.youtube.com/channel/${h}`
  return `https://www.youtube.com/@${h}`
}

function countLabel(p) {
  if (refreshing.value.has(p.key)) return null
  const n = counts[p.count]
  if (n == null) return notFound.value.has(p.key) ? 'Not found' : '—'
  return `${Number(n).toLocaleString('en-GB')} ${p.unit}`
}

function clearField(p) {
  form[p.field] = ''
  delete fieldErrors[p.field]
}

// ── Tags ──
const optionKeys  = computed(() => new Set(tagOptions.value.map(o => tagKey(o.label))))
const selectedKeys = computed(() => new Set(tags.value.map(tagKey)))

const isUnavailable = t => !tagOptionsLoading.value && !tagOptionsError.value && !optionKeys.value.has(tagKey(t))

const filteredTagOptions = computed(() => {
  const q = tagQuery.value.trim().toLowerCase()
  return tagOptions.value.filter(o =>
    !selectedKeys.value.has(tagKey(o.label)) &&
    (!q || o.label.toLowerCase().includes(q) || o.categories.some(c => c.toLowerCase().includes(q))))
})

watch(tagQuery, () => { tagHighlight.value = 0; tagMenuOpen.value = true })

function setTags(list) {
  const seen = new Set()
  const clean = []
  for (const t of list || []) {
    const label = String(t).trim()
    if (!label || seen.has(tagKey(label))) continue
    seen.add(tagKey(label))
    clean.push(label)
  }
  savedTags.value = clean
  tags.value = [...clean]
}

function addTag(label) {
  if (!label || selectedKeys.value.has(tagKey(label))) return
  tags.value = [...tags.value, label]
  tagsError.value = null
  tagQuery.value = ''
  tagHighlight.value = 0
  tagInput.value?.focus()
}

function removeTag(i) {
  tags.value = tags.value.filter((_, idx) => idx !== i)
  tagsError.value = null
}

function clearTags() {
  tags.value = []
  tagsError.value = null
}

function onTagKeydown(e) {
  const list = filteredTagOptions.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    tagMenuOpen.value = true
    tagHighlight.value = Math.min(tagHighlight.value + 1, list.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    tagHighlight.value = Math.max(tagHighlight.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (tagMenuOpen.value && list[tagHighlight.value]) addTag(list[tagHighlight.value].label)
  } else if (e.key === 'Backspace' && !tagQuery.value && tags.value.length) {
    removeTag(tags.value.length - 1)
  } else if (e.key === 'Escape' && tagMenuOpen.value) {
    e.stopPropagation()   // close the menu, not the modal
    tagMenuOpen.value = false
  }
}

function onTagBlur() {
  // let a click on an option land before the menu closes
  setTimeout(() => { tagMenuOpen.value = false }, 120)
}

function categoryHint(o) {
  if (!o.categories.length) return ''
  return o.categories.length > 1 ? `${o.categories[0]} +${o.categories.length - 1}` : o.categories[0]
}

async function fetchTagOptions(force = false) {
  tagOptionsLoading.value = true
  tagOptionsError.value = null
  try {
    tagOptions.value = await loadTagOptions({ force })
  } catch {
    tagOptionsError.value = 'Couldn’t load the tag options.'
  } finally {
    tagOptionsLoading.value = false
  }
}

function discardChanges() {
  tags.value = [...savedTags.value]
  tagsError.value = null
  for (const p of PLATFORMS) form[p.field] = saved[p.field]
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]
  formError.value = null
}

// Clear a field's error as soon as the admin edits it
for (const p of PLATFORMS) {
  watch(() => form[p.field], () => { delete fieldErrors[p.field] })
}

async function loadCreator() {
  loading.value = true
  loadError.value = null
  try {
    const res = await axios.get(`${API}/users/admin/get-creator/${creatorId.value}/`)
    const c = unwrap(res.data)
    creator.value = { ...props.creator, ...c }
    if (!dirtyFields.value.length) applyHandles(c)
    applyCounts(c)
    // Only enable tag editing once we have the real list; otherwise saving could wipe tags
    if (Array.isArray(c.tags)) {
      if (!(tagsLoaded.value && tagsDirty.value)) setTags(c.tags)
      tagsLoaded.value = true
    }
  } catch (e) {
    loadError.value = e?.response?.status === 404
      ? 'Creator not found.'
      : (e?.response?.data?.message || 'Failed to load this creator.')
  } finally {
    loading.value = false
  }
}

function emitHandles() {
  emit('updated', {
    id: creatorId.value,
    tags: [...savedTags.value],
    instagram_handle: saved.instagram_handle || null,
    tiktok_handle:    saved.tiktok_handle    || null,
    youtube_handle:   saved.youtube_handle   || null,
  })
}

// First close with unsaved edits asks for confirmation inside the modal
const confirmClose = ref(false)
watch(hasChanges, v => { if (!v) confirmClose.value = false })

function close() {
  if (saving.value) return
  if (hasChanges.value && !confirmClose.value) {
    confirmClose.value = true
    return
  }
  emit('close')
}

function onKeydown(e) {
  if (e.key === 'Escape') close()
}

function stopPolling() {
  clearInterval(pollTimer)
  pollTimer = null
}

function startPolling(platforms) {
  stopPolling()
  const list = (platforms || []).filter(k => PLATFORMS.some(p => p.key === k))
  if (!list.length) { refreshing.value = new Set(); return }

  refreshing.value = new Set(list)
  const nf = new Set(notFound.value)
  list.forEach(k => nf.delete(k))
  notFound.value = nf
  pollStarted = Date.now()
  pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS)
}

async function pollOnce() {
  try {
    const res = await axios.get(`${API}/users/admin/get-creator/${creatorId.value}/`)
    applyCounts(unwrap(res.data))
  } catch {
    // ignore a failed poll; try again on the next tick
  }

  const still = new Set(refreshing.value)
  for (const p of PLATFORMS) {
    if (still.has(p.key) && counts[p.count] != null) still.delete(p.key)
  }

  if (!still.size) {
    refreshing.value = still
    stopPolling()
    return
  }

  if (Date.now() - pollStarted >= POLL_TIMEOUT_MS) {
    notFound.value = new Set([...notFound.value, ...still])
    refreshing.value = new Set()
    stopPolling()
    return
  }

  refreshing.value = still
}

function handleSaveError(e, notify = true) {
  const status = e?.response?.status
  const data   = e?.response?.data || {}
  if (status === 400) {
    const errs = data.errors || {}
    for (const [k, v] of Object.entries(errs)) fieldErrors[k] = Array.isArray(v) ? v.join(' ') : v
    formError.value = Object.keys(errs).length ? null : (data.message || 'Please check the handles and try again.')
    if (notify) toast.error('Nothing was saved', data.message || 'Please fix the highlighted fields.')
  } else if (status === 404) {
    formError.value = data.message || 'Creator not found.'
    if (notify) toast.error('Creator not found', 'This creator may have been removed.')
  } else {
    formError.value = data.message || 'Something went wrong. Please try again.'
    if (notify) toast.error('Couldn’t save', formError.value)
  }
}

async function saveSocials() {
  const body = {}
  for (const f of dirtyFields.value) body[f] = norm(form[f]) || null
  try {
    const { data } = await axios.patch(`${API}/users/admin/creator/${creatorId.value}/socials/`, body)
    applyHandles(data)
    applyCounts(data)
    emitHandles()
    startPolling(data.refreshing)
    return { ok: true, refreshing: !!data.refreshing?.length }
  } catch (e) {
    handleSaveError(e, false)
    return { ok: false }
  }
}

async function saveTags() {
  try {
    const { data } = await axios.patch(`${API}/users/admin/creator/${creatorId.value}/tags/`, { tags: tags.value })
    setTags(Array.isArray(data.tags) ? data.tags : tags.value)
    emitHandles()
    return { ok: true }
  } catch (e) {
    const status = e?.response?.status
    tagsError.value = e?.response?.data?.message
      || (status === 404 ? 'Creator not found.' : 'Couldn’t save tags. Please try again.')
    return { ok: false }
  }
}

async function save() {
  if (!hasChanges.value || busy.value) return
  saving.value = true
  formError.value = null
  tagsError.value = null
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]

  const jobs = []
  if (dirtyFields.value.length) jobs.push(saveSocials().then(r => ({ ...r, label: 'Social handles' })))
  if (tagsDirty.value)          jobs.push(saveTags().then(r => ({ ...r, label: 'Tags' })))

  const results = await Promise.all(jobs)
  saving.value = false

  const ok     = results.filter(r => r.ok)
  const failed = results.filter(r => !r.ok)
  const counting = ok.some(r => r.refreshing) ? 'Fetching the new follower counts in the background.' : ''

  if (!failed.length) {
    toast.success(ok.length > 1 ? 'Changes saved' : `${ok[0].label} saved`, counting)
  } else if (!ok.length) {
    toast.error('Nothing was saved', 'Please fix the errors shown and try again.')
  } else {
    toast.error(`${ok[0].label} saved, ${failed[0].label.toLowerCase()} not saved`, 'See the error in the editor.')
  }
}

async function refreshCounts() {
  if (busy.value) return
  refreshingCounts.value = true
  formError.value = null
  try {
    const { data } = await axios.patch(`${API}/users/admin/creator/${creatorId.value}/socials/`, { refresh: true })
    applyCounts(data)
    startPolling(data.refreshing)
    if (data.refreshing?.length) {
      toast.success('Refreshing counts', 'This can take 30 seconds to 3 minutes.')
    } else {
      toast.success('Nothing to refresh', 'This creator has no social handles set.')
    }
  } catch (e) {
    handleSaveError(e)
  } finally {
    refreshingCounts.value = false
  }
}

applyHandles(props.creator)
applyCounts(props.creator)

if (Array.isArray(props.creator.tags)) {
  setTags(props.creator.tags)
  tagsLoaded.value = true
}

onMounted(() => {
  loadCreator()
  fetchTagOptions()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  stopPolling()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="close">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="socials-title">
        <div class="modal-header">
          <div>
            <h3 id="socials-title" class="modal-title">Edit creator</h3>
            <p class="modal-sub">{{ displayName(creator) }}<span v-if="creator.email"> · {{ creator.email }}</span></p>
          </div>
          <button class="modal-close" aria-label="Close" :disabled="saving" @click="close">✕</button>
        </div>

        <div v-if="loadError" class="error-banner">{{ loadError }}</div>

        <div class="toolbar">
          <div>
            <h4 class="section-title">Social handles</h4>
            <p class="card-sub">Paste a handle, @handle or full profile link. Links are cleaned up automatically.</p>
          </div>
          <button class="ghost-btn" :disabled="busy || loading || refreshing.size > 0" @click="refreshCounts">
            {{ refreshingCounts ? 'Requesting…' : 'Refresh counts' }}
          </button>
        </div>

        <div class="socials">
          <div
            v-for="p in PLATFORMS"
            :key="p.key"
            class="social-row"
            :class="{ 'has-error': fieldErrors[p.field] }"
          >
            <label class="social-label" :for="`in-${p.key}`">
              {{ p.label }}
              <span v-if="isDirty(p.field)" class="dirty-dot" title="Unsaved change" />
            </label>

            <div class="social-input">
              <div class="input-wrap">
                <input
                  :id="`in-${p.key}`"
                  v-model="form[p.field]"
                  type="text"
                  class="text-input"
                  :placeholder="p.placeholder"
                  :disabled="saving"
                  autocomplete="off"
                  spellcheck="false"
                  @keydown.enter="save"
                />
                <button
                  class="clear-btn"
                  :disabled="saving || !form[p.field]"
                  @click="clearField(p)"
                >
                  Clear
                </button>
              </div>
              <p v-if="fieldErrors[p.field]" class="field-error">{{ fieldErrors[p.field] }}</p>
              <p v-else-if="isDirty(p.field) && !form[p.field]" class="field-hint">
                Will be cleared on save. This also clears the {{ p.unit }} count.
              </p>
            </div>

            <div class="social-count">
              <span v-if="loading" class="count muted">Loading…</span>
              <span v-else-if="refreshing.has(p.key)" class="count refreshing">
                <span class="spinner" /> Refreshing…
              </span>
              <span
                v-else
                class="count"
                :class="{ muted: counts[p.count] == null, 'not-found': notFound.has(p.key) && counts[p.count] == null }"
              >
                {{ countLabel(p) }}
              </span>
              <a
                v-if="saved[p.field]"
                :href="profileUrl(p, saved[p.field])"
                target="_blank"
                rel="noopener"
                class="open-link"
              >Open ↗</a>
            </div>
          </div>
        </div>

        <div v-if="formError" class="error-banner">{{ formError }}</div>

        <!-- Tags -->
        <section class="tags-section">
          <div class="section-head">
            <h4 class="section-title">
              Tags
              <span v-if="tagsDirty" class="dirty-dot" title="Unsaved change" />
              <span v-if="tags.length" class="tag-count">{{ tags.length }}</span>
            </h4>
            <button
              v-if="tags.length"
              class="link-btn"
              :disabled="saving || !tagsLoaded"
              @click="clearTags"
            >
              Clear all
            </button>
          </div>

          <p v-if="!tagsLoaded" class="card-sub">{{ loading ? 'Loading tags…' : 'Tags could not be loaded.' }}</p>

          <template v-else>
            <div
              class="tag-box"
              :class="{ focused: tagMenuOpen, disabled: saving }"
              @click="tagInput?.focus()"
            >
              <span
                v-for="(t, i) in tags"
                :key="t"
                class="tag-chip"
                :class="{ unavailable: isUnavailable(t) }"
                :title="isUnavailable(t) ? 'No longer in the tag options (its category may be disabled). It stays saved unless you remove it.' : ''"
              >
                {{ t }}
                <button
                  class="chip-x"
                  :aria-label="`Remove ${t}`"
                  :disabled="saving"
                  @click.stop="removeTag(i)"
                >×</button>
              </span>
              <input
                ref="tagInput"
                v-model="tagQuery"
                type="text"
                class="tag-input"
                :placeholder="tags.length ? 'Add another tag…' : 'Search tags to add…'"
                :disabled="saving"
                autocomplete="off"
                spellcheck="false"
                @focus="tagMenuOpen = true"
                @blur="onTagBlur"
                @keydown="onTagKeydown"
              />
            </div>

            <div v-if="tagMenuOpen" class="tag-menu" role="listbox">
              <p v-if="tagOptionsLoading" class="tag-menu-empty">Loading tag options…</p>
              <p v-else-if="tagOptionsError" class="tag-menu-empty">
                {{ tagOptionsError }}
                <button class="link-btn" @mousedown.prevent="fetchTagOptions(true)">Retry</button>
              </p>
              <p v-else-if="!filteredTagOptions.length" class="tag-menu-empty">
                {{ tagQuery ? `No tags match “${tagQuery}”.` : 'All available tags are selected.' }}
              </p>
              <button
                v-for="(o, i) in filteredTagOptions"
                v-else
                :key="o.label"
                class="tag-option"
                :class="{ highlighted: i === tagHighlight }"
                role="option"
                @mousedown.prevent="addTag(o.label)"
                @mousemove="tagHighlight = i"
              >
                <span>{{ o.label }}</span>
                <span class="tag-option-cat" :title="o.categories.join(', ')">{{ categoryHint(o) }}</span>
              </button>
            </div>

            <p v-if="tags.some(isUnavailable)" class="field-hint">
              <span class="legend-swatch" /> Dashed tags are no longer in the options. They stay saved unless you remove them.
            </p>
            <p v-if="tagsError" class="field-error">{{ tagsError }}</p>
          </template>
        </section>

        <div class="card-footer">
          <span class="footer-note" :class="{ warn: confirmClose }">
            <template v-if="confirmClose">You have unsaved changes. Close again to discard them.</template>
            <template v-else-if="refreshing.size">New counts usually arrive within 30 seconds to 3 minutes.</template>
            <template v-else-if="hasChanges">{{ changeCount }} unsaved change{{ changeCount === 1 ? '' : 's' }}</template>
          </span>
          <div class="footer-actions">
            <button class="ghost-btn" :disabled="saving" @click="close">
              {{ confirmClose ? 'Discard & close' : 'Close' }}
            </button>
            <button v-if="hasChanges" class="ghost-btn" :disabled="saving" @click="discardChanges">Discard</button>
            <button class="primary-btn" :disabled="!hasChanges || busy" @click="save">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 1000;
}

.modal {
  background: var(--white);
  border-radius: var(--radius-lg);
  padding: 24px 28px;
  width: 720px;
  max-width: 100%;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.modal-title {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 600;
  color: var(--black);
}

.modal-sub {
  font-size: 13px;
  color: var(--gray-500);
  margin-top: 4px;
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 14px;
  color: var(--gray-500);
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.modal-close:hover:not(:disabled) { color: var(--black); }

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--gray-100);
}

/* ── Sections ── */
.section-title {
  font-family: var(--font-heading);
  font-size: 15px;
  font-weight: 600;
  color: var(--black);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tags-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 18px;
  border-top: 1px solid var(--gray-100);
}

.tag-count {
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  color: var(--gray-700);
  background: var(--gray-100);
  border-radius: 100px;
  padding: 1px 8px;
}

.link-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 12.5px;
  color: var(--gold-dark);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.link-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── Tag picker ── */
.tag-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 42px;
  padding: 6px 8px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  background: var(--white);
  cursor: text;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.tag-box.focused {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(201, 164, 74, 0.1);
}

.tag-box.disabled { background: var(--gray-100); }

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px 3px 10px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--gold-dark);
  background: var(--gold-muted);
  border: 1px solid rgba(201, 164, 74, 0.35);
  border-radius: 100px;
  white-space: nowrap;
}

.tag-chip.unavailable {
  color: var(--gray-700);
  background: var(--white);
  border: 1px dashed var(--gray-300);
}

.chip-x {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
  transition: all var(--transition);
}

.chip-x:hover:not(:disabled) { opacity: 1; background: rgba(0, 0, 0, 0.06); }

.tag-input {
  flex: 1;
  min-width: 140px;
  height: 28px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  font-family: var(--font-body);
  color: var(--black);
}

.tag-menu {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  background: var(--white);
  box-shadow: var(--shadow-md);
  padding: 4px;
}

.tag-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: 13px;
  font-family: var(--font-body);
  color: var(--black);
  text-align: left;
  cursor: pointer;
}

.tag-option.highlighted { background: var(--gold-muted); }

.tag-option-cat {
  font-size: 11.5px;
  color: var(--gray-500);
  white-space: nowrap;
}

.tag-menu-empty {
  padding: 10px;
  font-size: 12.5px;
  color: var(--gray-500);
  display: flex;
  gap: 8px;
  align-items: center;
}

.legend-swatch {
  display: inline-block;
  width: 14px;
  height: 10px;
  border: 1px dashed var(--gray-300);
  border-radius: 100px;
  vertical-align: -1px;
  margin-right: 2px;
}

/* ── Footer ── */
.card-sub {
  font-size: 12.5px;
  color: var(--gray-500);
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--gray-100);
  flex-wrap: wrap;
}

.footer-note { font-size: 12.5px; color: var(--gray-500); }
.footer-note.warn { color: var(--red); }

.footer-actions { display: flex; gap: 8px; margin-left: auto; }

/* ── Social rows ── */
.socials { display: flex; flex-direction: column; gap: 18px; }

.social-row {
  display: grid;
  grid-template-columns: 110px 1fr 190px;
  align-items: start;
  gap: 16px;
}

.social-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--black);
  padding-top: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gold);
}

.social-input { min-width: 0; }

.input-wrap { display: flex; gap: 8px; }

.text-input {
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  background: var(--white);
  font-size: 13px;
  font-family: var(--font-body);
  color: var(--black);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.text-input:focus {
  outline: none;
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(201, 164, 74, 0.1);
}

.text-input:disabled { background: var(--gray-100); }

.has-error .text-input { border-color: var(--red); }
.has-error .text-input:focus { box-shadow: 0 0 0 3px rgba(192, 57, 43, 0.1); }

.field-error {
  font-size: 12px;
  color: var(--red);
  margin-top: 6px;
}

.field-hint {
  font-size: 12px;
  color: var(--gray-500);
  margin-top: 6px;
}

.social-count {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding-top: 10px;
}

.count {
  font-size: 13px;
  font-weight: 500;
  color: var(--black);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.count.muted     { color: var(--gray-500); font-weight: 400; }
.count.not-found { color: var(--red); }
.count.refreshing { color: var(--gold-dark); }

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(201, 164, 74, 0.25);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.open-link {
  font-size: 11.5px;
  color: var(--gold-dark);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── Buttons ── */
.clear-btn,
.ghost-btn,
.primary-btn {
  height: 38px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition);
}

.clear-btn,
.ghost-btn {
  border: 1px solid var(--gray-200);
  background: var(--white);
  color: var(--gray-700);
}

.clear-btn:hover:not(:disabled),
.ghost-btn:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--gold-dark);
}

.toolbar .ghost-btn { height: 34px; }

.primary-btn {
  min-width: 96px;
  border: 1px solid var(--black);
  background: var(--black);
  color: var(--white);
}

.primary-btn:hover:not(:disabled) { background: var(--black-soft); border-color: var(--gold); }

.clear-btn:disabled,
.ghost-btn:disabled,
.primary-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── Misc ── */
.error-banner {
  padding: 12px 16px;
  background: rgba(192, 57, 43, 0.08);
  border: 1px solid rgba(192, 57, 43, 0.25);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--red);
}




@media (max-width: 720px) {
  .social-row { grid-template-columns: 1fr; gap: 8px; }
  .social-label, .social-count { padding-top: 0; }
  .social-count { flex-direction: row; align-items: center; gap: 10px; }
}
</style>
