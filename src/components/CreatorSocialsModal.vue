<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useToast } from '@/composables/useToast'

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
const hasChanges  = computed(() => dirtyFields.value.length > 0)
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

function discardChanges() {
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
    if (!hasChanges.value) applyHandles(c)
    applyCounts(c)
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

function handleSaveError(e) {
  const status = e?.response?.status
  const data   = e?.response?.data || {}
  if (status === 400) {
    const errs = data.errors || {}
    for (const [k, v] of Object.entries(errs)) fieldErrors[k] = Array.isArray(v) ? v.join(' ') : v
    formError.value = Object.keys(errs).length ? null : (data.message || 'Please check the handles and try again.')
    toast.error('Nothing was saved', data.message || 'Please fix the highlighted fields.')
  } else if (status === 404) {
    formError.value = data.message || 'Creator not found.'
    toast.error('Creator not found', 'This creator may have been removed.')
  } else {
    formError.value = data.message || 'Something went wrong. Please try again.'
    toast.error('Couldn’t save', formError.value)
  }
}

async function save() {
  if (!hasChanges.value || busy.value) return
  saving.value = true
  formError.value = null
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]

  const body = {}
  for (const f of dirtyFields.value) body[f] = norm(form[f]) || null

  try {
    const { data } = await axios.patch(`${API}/users/admin/creator/${creatorId.value}/socials/`, body)
    applyHandles(data)
    applyCounts(data)
    emitHandles()
    startPolling(data.refreshing)
    toast.success(
      'Social handles saved',
      data.refreshing?.length ? 'Fetching the new follower counts in the background.' : '',
    )
  } catch (e) {
    handleSaveError(e)
  } finally {
    saving.value = false
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

onMounted(() => {
  loadCreator()
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
            <h3 id="socials-title" class="modal-title">Edit social handles</h3>
            <p class="modal-sub">{{ displayName(creator) }}<span v-if="creator.email"> · {{ creator.email }}</span></p>
          </div>
          <button class="modal-close" aria-label="Close" :disabled="saving" @click="close">✕</button>
        </div>

        <div v-if="loadError" class="error-banner">{{ loadError }}</div>

        <div class="toolbar">
          <p class="card-sub">Paste a handle, @handle or full profile link. Links are cleaned up automatically.</p>
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

        <div class="card-footer">
          <span class="footer-note" :class="{ warn: confirmClose }">
            <template v-if="confirmClose">You have unsaved changes. Close again to discard them.</template>
            <template v-else-if="refreshing.size">New counts usually arrive within 30 seconds to 3 minutes.</template>
            <template v-else-if="hasChanges">{{ dirtyFields.length }} unsaved change{{ dirtyFields.length === 1 ? '' : 's' }}</template>
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
