<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import axios from 'axios'

const STATUS_TABS = [
  { label: 'All',                    value: '' },
  { label: 'Pending',                value: '1' },
  { label: 'Approved',               value: '2' },
  { label: 'Rejected',               value: '3' },
  { label: 'Accepted (Upgrade)',     value: '4' },
]

const STATUS_LABELS = { '1': 'Pending', '2': 'Approved', '3': 'Rejected', '4': 'Accepted · Upgrade' }
const STATUS_CLASS  = { '1': 'chip-pending', '2': 'chip-approved', '3': 'chip-declined', '4': 'chip-upgrade' }

const ORDER_STATUS_LABELS = { '1': 'Not Created', '2': 'Created', '3': 'Fulfilled', '4': 'Cancelled' }
const ORDER_STATUS_CLASS  = { '1': 'chip-gray', '2': 'chip-blue', '3': 'chip-green', '4': 'chip-declined' }

const GIFTING_LABELS = { '0': 'Not Selected', '1': 'Free Gifting', '2': 'Gifting + Content', '3': 'Paid Collab' }
const GIFTING_CLASS  = { '0': 'chip-gray', '1': 'chip-teal', '2': 'chip-blue', '3': 'chip-gold' }

const REQUEST_TYPE_OPTS = [
  { label: 'All',              value: '' },
  { label: 'Brand → Creator',  value: '1' },
  { label: 'Creator → Brand',  value: '2' },
]

const ORDER_STATUS_OPTS = [
  { label: 'Any order status', value: '' },
  { label: 'Not Created',      value: '1' },
  { label: 'Created',          value: '2' },
  { label: 'Fulfilled',        value: '3' },
  { label: 'Cancelled',        value: '4' },
]

const GIFTING_OPTS = [
  { label: 'Any gifting type',    value: '' },
  { label: 'Not Selected',        value: '0' },
  { label: 'Free Gifting',        value: '1' },
  { label: 'Gifting + Content',   value: '2' },
  { label: 'Paid Collab',         value: '3' },
]

const ORDERING_OPTS = [
  { label: 'Newest first', value: '-created_at' },
  { label: 'Oldest first', value: 'created_at' },
  { label: 'Date asc',     value: 'date' },
  { label: 'Date desc',    value: '-date' },
]

const loading     = ref(false)
const error       = ref(null)
const results     = ref([])
const totalCount  = ref(0)
const nextUrl     = ref(null)
const prevUrl     = ref(null)
const currentPage = ref(1)

const filters = reactive({
  status:        '1',
  request_type:  '',
  order_status:  '',
  gifting_choice:'',
  search:        '',
  start_date:    '',
  end_date:      '',
  ordering:      '-created_at',
})

let debounceTimer = null

async function fetchRequests(url = null) {
  loading.value = true
  error.value = null
  try {
    let res
    if (url) {
      res = await axios.get(url)
    } else {
      const params = {}
      if (filters.status)         params.status         = filters.status
      if (filters.request_type)   params.request_type   = filters.request_type
      if (filters.order_status)   params.order_status   = filters.order_status
      if (filters.gifting_choice !== '') params.gifting_choice = filters.gifting_choice
      if (filters.search)         params.search         = filters.search
      if (filters.start_date)     params.start_date     = filters.start_date
      if (filters.end_date)       params.end_date       = filters.end_date
      if (filters.ordering)       params.ordering       = filters.ordering
      res = await axios.get(`${import.meta.env.VITE_API_BASE}/users/admin/get-requests/`, { params })
    }
    const data = res.data
    if (Array.isArray(data)) {
      results.value    = data
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
    error.value = 'Failed to load gifting requests.'
  } finally {
    loading.value = false
  }
}

function debounced() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { currentPage.value = 1; fetchRequests() }, 400)
}

function setStatus(val) {
  filters.status = val
  currentPage.value = 1
  fetchRequests()
}

function goNext() { if (nextUrl.value) { currentPage.value++; fetchRequests(nextUrl.value) } }
function goPrev() { if (prevUrl.value) { currentPage.value--; fetchRequests(prevUrl.value) } }

function formatDate(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fromName(r) {
  return r.request_from_brand_name || r.request_from_creator_name || r.request_from_email || '—'
}

function toName(r) {
  return r.request_to_creator_name || r.request_to_brand_name || r.request_to_email || '—'
}

function fromSub(r) {
  return r.request_from_brand_name || r.request_from_creator_name ? r.request_from_email : null
}

function toSub(r) {
  return r.request_to_creator_name || r.request_to_brand_name ? r.request_to_email : null
}

const exporting = ref(false)

async function exportCSV() {
  exporting.value = true
  try {
    const params = {}
    if (filters.status)                     params.status         = filters.status
    if (filters.request_type)               params.request_type   = filters.request_type
    if (filters.order_status)               params.order_status   = filters.order_status
    if (filters.gifting_choice !== '')      params.gifting_choice = filters.gifting_choice
    if (filters.start_date)                 params.start_date     = filters.start_date
    if (filters.end_date)                   params.end_date       = filters.end_date
    const res = await axios.get(`${import.meta.env.VITE_API_BASE}/users/admin/export/requests/`, { params, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'requests.csv'
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    error.value = 'Failed to export CSV.'
  } finally {
    exporting.value = false
  }
}

watch(() => [filters.search, filters.start_date, filters.end_date], debounced)
watch(() => [filters.request_type, filters.order_status, filters.gifting_choice, filters.ordering], () => {
  currentPage.value = 1
  fetchRequests()
})
onMounted(fetchRequests)
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">Gifting Requests</h2>
        <p class="page-sub">Brand–Creator gifting and collaboration requests.</p>
      </div>
      <div class="header-actions">
        <span class="total-badge">{{ totalCount }} total</span>
        <button class="export-btn" :disabled="exporting" @click="exportCSV">
          {{ exporting ? 'Exporting…' : 'Export CSV' }}
        </button>
      </div>
    </div>

    <!-- Status tabs -->
    <div class="filters-bar">
      <div class="status-tabs">
        <button
          v-for="tab in STATUS_TABS"
          :key="tab.value"
          class="tab-btn"
          :class="{ active: filters.status === tab.value }"
          @click="setStatus(tab.value)"
        >{{ tab.label }}</button>
      </div>

      <div class="filter-inputs">
        <div class="search-wrap">
          <span class="search-icon">⌕</span>
          <input
            v-model="filters.search"
            type="text"
            class="filter-input search-input"
            placeholder="Search name, email, product…"
          />
        </div>
      </div>
    </div>

    <!-- Secondary filters -->
    <div class="secondary-filters">
      <select v-model="filters.request_type" class="filter-input select-input">
        <option v-for="o in REQUEST_TYPE_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <select v-model="filters.order_status" class="filter-input select-input">
        <option v-for="o in ORDER_STATUS_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <select v-model="filters.gifting_choice" class="filter-input select-input">
        <option v-for="o in GIFTING_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <select v-model="filters.ordering" class="filter-input select-input">
        <option v-for="o in ORDERING_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <input
        v-model="filters.start_date"
        type="date"
        class="filter-input date-input"
        title="Start date"
      />
      <input
        v-model="filters.end_date"
        type="date"
        class="filter-input date-input"
        title="End date"
      />
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
                <th>From</th>
                <th>To</th>
                <th>Product</th>
                <th>Type</th>
                <th>Gifting</th>
                <th>Order</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="req in results" :key="req.id">
                <!-- From -->
                <td>
                  <div class="cell-primary">
                    <div class="avatar" :class="req.request_type === '1' ? 'brand-avatar' : 'creator-avatar'">
                      {{ fromName(req)[0].toUpperCase() }}
                    </div>
                    <div>
                      <p class="cell-name">{{ fromName(req) }}</p>
                      <p v-if="fromSub(req)" class="cell-sub">{{ fromSub(req) }}</p>
                    </div>
                  </div>
                </td>

                <!-- To -->
                <td>
                  <div class="cell-primary">
                    <div class="avatar" :class="req.request_type === '1' ? 'creator-avatar' : 'brand-avatar'">
                      {{ toName(req)[0].toUpperCase() }}
                    </div>
                    <div>
                      <p class="cell-name">{{ toName(req) }}</p>
                      <p v-if="toSub(req)" class="cell-sub">{{ toSub(req) }}</p>
                    </div>
                  </div>
                </td>

                <!-- Product -->
                <td>
                  <div class="product-cell">
                    <img
                      v-if="req.product_image"
                      :src="req.product_image"
                      class="product-thumb"
                      alt=""
                      loading="lazy"
                    />
                    <div v-else class="product-thumb product-placeholder" />
                    <div>
                      <p class="cell-name">{{ req.product_title || '—' }}</p>
                      <p v-if="req.product_variant_title" class="cell-sub">{{ req.product_variant_title }}</p>
                      <p v-if="req.shopify_order_name" class="cell-order-name">{{ req.shopify_order_name }}</p>
                    </div>
                  </div>
                </td>

                <!-- Request type -->
                <td>
                  <span class="type-badge" :class="req.request_type === '1' ? 'type-b2c' : 'type-c2b'">
                    {{ req.request_type === '1' ? 'B → C' : 'C → B' }}
                  </span>
                </td>

                <!-- Gifting choice -->
                <td>
                  <span class="status-chip" :class="GIFTING_CLASS[String(req.gifting_choice)] || 'chip-gray'">
                    {{ GIFTING_LABELS[String(req.gifting_choice)] || '—' }}
                  </span>
                </td>

                <!-- Order status -->
                <td>
                  <span
                    v-if="req.order_status"
                    class="status-chip"
                    :class="ORDER_STATUS_CLASS[String(req.order_status)] || 'chip-gray'"
                  >
                    {{ ORDER_STATUS_LABELS[String(req.order_status)] || '—' }}
                  </span>
                  <span v-else class="cell-muted">—</span>
                </td>

                <!-- Request status -->
                <td>
                  <span class="status-chip" :class="STATUS_CLASS[String(req.status)] || 'chip-gray'">
                    {{ STATUS_LABELS[String(req.status)] || '—' }}
                  </span>
                </td>

                <!-- Date -->
                <td class="cell-muted">{{ formatDate(req.created_at) }}</td>
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
        <p class="empty-title">No requests found</p>
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

.search-input {
  padding: 0 14px 0 36px;
  width: 260px;
}

.filter-input::placeholder { color: var(--gray-300); }

.filter-input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(201, 164, 74, 0.1);
  outline: none;
}

.secondary-filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.select-input {
  padding: 0 12px;
  width: 180px;
  cursor: pointer;
  appearance: auto;
}

.date-input {
  padding: 0 10px;
  width: 150px;
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
  50%       { opacity: 0.4; }
}

.table-wrap { overflow-x: auto; }

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead tr { border-bottom: 1px solid var(--gray-200); }

.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--gray-500);
  white-space: nowrap;
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--gray-100);
  font-size: 13px;
  vertical-align: middle;
}

.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr { transition: background var(--transition); }
.data-table tbody tr:hover { background: var(--off-white); }

/* ── Cells ── */
.cell-primary {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cell-name {
  font-weight: 500;
  color: var(--black);
  font-size: 13px;
}

.cell-sub {
  font-size: 11px;
  color: var(--gray-500);
  margin-top: 1px;
}

.cell-order-name {
  font-size: 11px;
  color: var(--gold-dark);
  font-weight: 600;
  margin-top: 2px;
}

.cell-muted { color: var(--gray-700); }

.avatar {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-avatar   { background: rgba(201, 164, 74, 0.15); color: var(--gold-dark); }
.creator-avatar { background: rgba(52, 152, 219, 0.12); color: #1a6090; }

/* ── Product cell ── */
.product-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.product-thumb {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--gray-100);
}

.product-placeholder {
  background: var(--gray-100);
}

/* ── Request type badge ── */
.type-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  padding: 3px 8px;
  border-radius: 100px;
  white-space: nowrap;
}

.type-b2c { background: rgba(201, 164, 74, 0.12); color: var(--gold-dark); border: 1px solid rgba(201, 164, 74, 0.3); }
.type-c2b { background: rgba(52, 152, 219, 0.12); color: #1a6090;          border: 1px solid rgba(52, 152, 219, 0.25); }

/* ── Status chips ── */
.status-chip {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 100px;
  white-space: nowrap;
}

.chip-pending  { background: rgba(230, 170, 50, 0.15); color: #9b6e00;    border: 1px solid rgba(230, 170, 50, 0.3); }
.chip-approved { background: rgba(39, 174, 96, 0.12);  color: #1a7a42;    border: 1px solid rgba(39, 174, 96, 0.25); }
.chip-declined { background: rgba(192, 57, 43, 0.10);  color: var(--red); border: 1px solid rgba(192, 57, 43, 0.2); }
.chip-upgrade  { background: rgba(155, 89, 182, 0.12); color: #6c3483;    border: 1px solid rgba(155, 89, 182, 0.25); }
.chip-gray     { background: var(--gray-100);           color: var(--gray-500); border: 1px solid var(--gray-200); }
.chip-blue     { background: rgba(52, 152, 219, 0.12); color: #1a6090;    border: 1px solid rgba(52, 152, 219, 0.25); }
.chip-green    { background: rgba(39, 174, 96, 0.12);  color: #1a7a42;    border: 1px solid rgba(39, 174, 96, 0.25); }
.chip-teal     { background: rgba(26, 188, 156, 0.12); color: #0e7a6a;    border: 1px solid rgba(26, 188, 156, 0.25); }
.chip-gold     { background: rgba(201, 164, 74, 0.15); color: var(--gold-dark); border: 1px solid rgba(201, 164, 74, 0.3); }

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

.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.page-info {
  font-size: 13px;
  color: var(--gray-500);
}
</style>
