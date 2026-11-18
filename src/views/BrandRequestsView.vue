<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import axios from 'axios'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const STATUS_TABS = [
  { label: 'All',      value: '' },
  { label: 'Pending',  value: '1' },
  { label: 'Approved', value: '2' },
  { label: 'Declined', value: '3' },
]

const STATUS_LABELS = { '1': 'Pending', '2': 'Approved', '3': 'Declined' }
const STATUS_CLASS  = { '1': 'chip-pending', '2': 'chip-approved', '3': 'chip-declined' }

const loading     = ref(false)
const error       = ref(null)
const results     = ref([])
const totalCount  = ref(0)
const nextUrl     = ref(null)
const prevUrl     = ref(null)
const currentPage = ref(1)

const filters = reactive({ status: '1', search: '', country: '' })
let debounceTimer = null

const actioning = ref(new Set())

async function updateStatus(brand, status) {
  if (actioning.value.has(brand.id)) return false
  actioning.value = new Set([...actioning.value, brand.id])
  try {
    await axios.post(`${import.meta.env.VITE_API_BASE}/users/brand-signup-update/`, {
      brand: brand.id,
      status,
    })
    brand.status = status
    return true
  } catch {
    error.value = `Failed to ${status === '2' ? 'approve' : 'decline'} ${brand.email || 'brand'}.`
    return false
  } finally {
    const next = new Set(actioning.value)
    next.delete(brand.id)
    actioning.value = next
  }
}

async function resendSetPasswordLink(brand) {
  const ok = await updateStatus(brand, '2')
  const who = brand.email || 'this brand'
  if (ok) {
    toast.success('Set password link sent', `A new link has been emailed to ${who}.`)
  } else {
    error.value = null
    toast.error('Couldn’t resend link', `Failed to send the set password link to ${who}. Please try again.`)
  }
}

async function fetchBrands(url = null) {
  loading.value = true
  error.value = null
  try {
    let res
    if (url) {
      res = await axios.get(url)
    } else {
      const params = {}
      if (filters.status)  params.status  = filters.status
      if (filters.search)  params.search  = filters.search
      if (filters.country) params.country = filters.country
      res = await axios.get(`${import.meta.env.VITE_API_BASE}/users/brand-signup-list/`, { params })
    }
    const data = res.data
    if (Array.isArray(data)) {
      results.value   = data
      totalCount.value = data.length
      nextUrl.value    = null
      prevUrl.value    = null
    } else {
      results.value    = data.results  || []
      totalCount.value = data.count    || 0
      nextUrl.value    = data.next     || null
      prevUrl.value    = data.previous || null
    }
  } catch {
    error.value = 'Failed to load brand requests.'
  } finally {
    loading.value = false
  }
}

function debounced() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { currentPage.value = 1; fetchBrands() }, 400)
}

function setStatus(val) {
  filters.status = val
  currentPage.value = 1
  fetchBrands()
}

function goNext() { if (nextUrl.value) { currentPage.value++; fetchBrands(nextUrl.value) } }
function goPrev() { if (prevUrl.value) { currentPage.value--; fetchBrands(prevUrl.value) } }

function formatDate(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const exporting = ref(false)

async function exportCSV() {
  exporting.value = true
  try {
    const params = {}
    if (filters.status) params.status = filters.status
    const res = await axios.get(`${import.meta.env.VITE_API_BASE}/users/admin/export/temp-brands/`, { params, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'temp_brands.csv'
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    error.value = 'Failed to export CSV.'
  } finally {
    exporting.value = false
  }
}

watch(() => [filters.search, filters.country], debounced)
onMounted(fetchBrands)
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">Brand Signup Requests</h2>
        <p class="page-sub">Review and manage brand registration submissions.</p>
      </div>
      <div class="header-actions">
        <span class="total-badge">{{ totalCount }} total</span>
        <button class="export-btn" :disabled="exporting" @click="exportCSV">
          {{ exporting ? 'Exporting…' : 'Export CSV' }}
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <div class="status-tabs">
        <button
          v-for="tab in STATUS_TABS"
          :key="tab.value"
          class="tab-btn"
          :class="{ active: filters.status === tab.value }"
          @click="setStatus(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="filter-inputs">
        <div class="search-wrap">
          <span class="search-icon">⌕</span>
          <input
            v-model="filters.search"
            type="text"
            class="filter-input"
            placeholder="Search name or email…"
          />
        </div>
        <input
          v-model="filters.country"
          type="text"
          class="filter-input country-input"
          placeholder="Country…"
        />
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-banner">{{ error }}</div>

    <!-- Table -->
    <div class="table-card">
      <div v-if="loading" class="table-loading">
        <div v-for="n in 6" :key="n" class="skeleton-row" />
      </div>

      <template v-else-if="results.length">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Country</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="brand in results" :key="brand.id">
                <td>
                  <div class="cell-primary">
                    <div class="avatar brands-avatar">
                      {{ (brand.brand_name || '?')[0].toUpperCase() }}
                    </div>
                    <div>
                      <p class="cell-name">{{ brand.brand_name || '—' }}</p>
                      <a
                        v-if="brand.brand_website"
                        :href="brand.brand_website"
                        target="_blank"
                        rel="noopener"
                        class="cell-link"
                      >{{ brand.brand_website.replace(/^https?:\/\//, '') }}</a>
                    </div>
                  </div>
                </td>
                <td class="cell-muted">{{ brand.spok_name || '—' }}</td>
                <td class="cell-muted">{{ brand.email || '—' }}</td>
                <td class="cell-muted">
                  {{ brand.country || '—' }}<span v-if="brand.region" class="cell-region">, {{ brand.region }}</span>
                </td>
                <td class="cell-muted">{{ formatDate(brand.created_at) }}</td>
                <td>
                  <span class="status-chip" :class="STATUS_CLASS[String(brand.status)]">
                    {{ STATUS_LABELS[String(brand.status)] || '—' }}
                  </span>
                </td>
                <td>
                  <div v-if="String(brand.status) === '1'" class="action-btns">
                    <button
                      class="action-btn btn-approve"
                      :disabled="actioning.has(brand.id)"
                      @click="updateStatus(brand, '2')"
                    >
                      {{ actioning.has(brand.id) ? '…' : 'Approve' }}
                    </button>
                    <button
                      class="action-btn btn-decline"
                      :disabled="actioning.has(brand.id)"
                      @click="updateStatus(brand, '3')"
                    >
                      Decline
                    </button>
                  </div>
                  <button
                    v-else-if="String(brand.status) === '2'"
                    class="action-btn btn-resend"
                    :disabled="actioning.has(brand.id)"
                    @click="resendSetPasswordLink(brand)"
                  >
                    {{ actioning.has(brand.id) ? 'Sending…' : 'Resend set password link' }}
                  </button>
                  <span v-else class="cell-muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="nextUrl || prevUrl" class="pagination">
          <button class="page-btn" :disabled="!prevUrl" @click="goPrev">← Previous</button>
          <span class="page-info">Page {{ currentPage }}</span>
          <button class="page-btn" :disabled="!nextUrl" @click="goNext">Next →</button>
        </div>
      </template>

      <div v-else class="empty-state">
        <p class="empty-title">No results found</p>
        <p class="empty-sub">Try adjusting your filters.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Header ── */
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title {
  font-family: var(--font-heading);
  font-size: 22px;
  font-weight: 600;
  color: var(--black);
  letter-spacing: -0.3px;
}

.page-sub {
  font-size: 13px;
  color: var(--gray-500);
  margin-top: 4px;
}

.total-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-700);
  background: var(--white);
  border: 1px solid var(--gray-200);
  padding: 4px 12px;
  border-radius: 100px;
}

.export-btn {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  background: var(--white);
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}

.export-btn:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--gold-dark);
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Filters ── */
.filters-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.status-tabs {
  display: flex;
  gap: 4px;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  padding: 4px;
}

.tab-btn {
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-500);
  background: transparent;
  transition: all var(--transition);
}

.tab-btn:hover {
  color: var(--black);
  background: var(--gray-100);
}

.tab-btn.active {
  background: var(--black);
  color: var(--white);
}

.filter-inputs {
  display: flex;
  gap: 10px;
}

.search-wrap {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 15px;
  color: var(--gray-500);
  pointer-events: none;
}

.filter-input {
  height: 38px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  background: var(--white);
  font-size: 13px;
  color: var(--black);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.search-wrap .filter-input {
  padding: 0 14px 0 36px;
  width: 240px;
}

.country-input {
  padding: 0 14px;
  width: 140px;
}

.filter-input::placeholder {
  color: var(--gray-300);
}

.filter-input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(201, 164, 74, 0.1);
}

/* ── Error ── */
.error-banner {
  padding: 14px 18px;
  background: rgba(192, 57, 43, 0.08);
  border: 1px solid rgba(192, 57, 43, 0.25);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--red);
}

/* ── Table Card ── */
.table-card {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── Skeleton ── */
.table-loading {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-row {
  height: 52px;
  background: var(--gray-100);
  border-radius: var(--radius-md);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Table ── */
.table-wrap {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead tr {
  border-bottom: 1px solid var(--gray-200);
}

.data-table th {
  padding: 12px 20px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--gray-500);
  white-space: nowrap;
}

.data-table td {
  padding: 14px 20px;
  border-bottom: 1px solid var(--gray-100);
  font-size: 13.5px;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr {
  transition: background var(--transition);
}

.data-table tbody tr:hover {
  background: var(--off-white);
}

.cell-primary {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
  color: var(--black);
}

.cell-muted {
  color: var(--gray-700);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brands-avatar {
  background: rgba(201, 164, 74, 0.15);
  color: var(--gold-dark);
}

/* ── Brand cell ── */
.cell-name {
  font-weight: 500;
  color: var(--black);
  font-size: 13.5px;
}

.cell-link {
  font-size: 11px;
  color: var(--gold-dark);
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
  display: block;
}

.cell-region {
  color: var(--gray-500);
  font-size: 12px;
}

/* ── Status Chips ── */
.status-chip {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 100px;
}

.chip-pending  { background: rgba(230, 170, 50, 0.15);  color: #9b6e00; border: 1px solid rgba(230, 170, 50, 0.3); }
.chip-approved { background: rgba(52, 152, 219, 0.12);  color: #1a6090; border: 1px solid rgba(52, 152, 219, 0.25); }
.chip-declined { background: rgba(192, 57, 43, 0.10);   color: var(--red); border: 1px solid rgba(192, 57, 43, 0.2); }

/* ── Action buttons ── */
.action-btns {
  display: flex;
  gap: 6px;
}

.action-btn {
  padding: 5px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-approve {
  background: rgba(39, 174, 96, 0.1);
  color: #1a7a42;
  border: 1px solid rgba(39, 174, 96, 0.35);
}

.btn-approve:hover:not(:disabled) {
  background: rgba(39, 174, 96, 0.2);
  border-color: rgba(39, 174, 96, 0.6);
}

.btn-decline {
  background: rgba(192, 57, 43, 0.08);
  color: var(--red);
  border: 1px solid rgba(192, 57, 43, 0.25);
}

.btn-decline:hover:not(:disabled) {
  background: rgba(192, 57, 43, 0.15);
  border-color: rgba(192, 57, 43, 0.45);
}

.btn-resend {
  background: var(--white);
  color: var(--gray-700);
  border: 1px solid var(--gray-200);
}

.btn-resend:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--gold-dark);
}

/* ── Empty ── */
.empty-state {
  padding: 64px 24px;
  text-align: center;
}

.empty-title {
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: 600;
  color: var(--black);
}

.empty-sub {
  font-size: 13px;
  color: var(--gray-500);
  margin-top: 6px;
}

/* ── Pagination ── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 24px;
  border-top: 1px solid var(--gray-100);
}

.page-btn {
  padding: 7px 16px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  background: var(--white);
  color: var(--black);
  transition: all var(--transition);
}

.page-btn:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--gold-dark);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: var(--gray-500);
}
</style>
