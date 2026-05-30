<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import axios from 'axios'

const SUBSCRIPTION_TYPE_OPTS = [
  { label: 'All billing cycles', value: '' },
  { label: 'Monthly',            value: '1' },
  { label: 'Annually',           value: '2' },
]

const ORDERING_OPTS = [
  { label: 'Created desc',     value: '-created_at' },
  { label: 'Created asc',      value: 'created_at' },
  { label: 'Start date desc',  value: '-start_date' },
  { label: 'Start date asc',   value: 'start_date' },
  { label: 'End date desc',    value: '-end_date' },
  { label: 'End date asc',     value: 'end_date' },
  { label: 'Amount desc',      value: '-amount' },
  { label: 'Amount asc',       value: 'amount' },
]

const loading     = ref(false)
const error       = ref(null)
const results     = ref([])
const totalCount  = ref(0)
const nextUrl     = ref(null)
const prevUrl     = ref(null)
const currentPage = ref(1)

const filters = reactive({
  search:            '',
  subscription_type: '',
  start_from:        '',
  start_to:          '',
  created_from:      '',
  created_to:        '',
  ordering:          '-created_at',
})

let debounceTimer = null

async function fetchHistory(url = null) {
  loading.value = true
  error.value = null
  try {
    let res
    if (url) {
      res = await axios.get(url)
    } else {
      const params = {}
      if (filters.search)            params.search            = filters.search
      if (filters.subscription_type) params.subscription_type = filters.subscription_type
      if (filters.start_from)        params.start_from        = filters.start_from
      if (filters.start_to)          params.start_to          = filters.start_to
      if (filters.created_from)      params.created_from      = filters.created_from
      if (filters.created_to)        params.created_to        = filters.created_to
      if (filters.ordering)          params.ordering          = filters.ordering
      res = await axios.get(`${import.meta.env.VITE_API_BASE}/users/admin/purchase-history/`, { params })
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
    error.value = 'Failed to load payment history.'
  } finally {
    loading.value = false
  }
}

function debounced() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { currentPage.value = 1; fetchHistory() }, 400)
}

function goNext() { if (nextUrl.value) { currentPage.value++; fetchHistory(nextUrl.value) } }
function goPrev() { if (prevUrl.value) { currentPage.value--; fetchHistory(prevUrl.value) } }

function formatDate(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatAmount(val) {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(val)
}

watch(() => [filters.search, filters.start_from, filters.start_to, filters.created_from, filters.created_to], debounced)
watch(() => [filters.subscription_type, filters.ordering], () => { currentPage.value = 1; fetchHistory() })
onMounted(fetchHistory)
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">Payment History</h2>
        <p class="page-sub">All completed subscription purchase records.</p>
      </div>
      <span class="total-badge">{{ totalCount }} total</span>
    </div>

    <!-- Filter row -->
    <div class="filters-wrap">
      <div class="filters-row">
        <div class="search-wrap">
          <span class="search-icon">⌕</span>
          <input
            v-model="filters.search"
            type="text"
            class="filter-input search-input"
            placeholder="Search email, brand or plan…"
          />
        </div>
        <select v-model="filters.subscription_type" class="filter-input select-input">
          <option v-for="o in SUBSCRIPTION_TYPE_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <select v-model="filters.ordering" class="filter-input select-input wide-select">
          <option v-for="o in ORDERING_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>

      <!-- Date ranges -->
      <div class="date-row">
        <span class="toggle-label">Start:</span>
        <input v-model="filters.start_from"   type="date" class="filter-input date-input" />
        <span class="date-sep">–</span>
        <input v-model="filters.start_to"     type="date" class="filter-input date-input" />
        <span class="toggle-label" style="margin-left: 16px;">Created:</span>
        <input v-model="filters.created_from" type="date" class="filter-input date-input" />
        <span class="date-sep">–</span>
        <input v-model="filters.created_to"   type="date" class="filter-input date-input" />
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
                <th>Plan</th>
                <th>Billing</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Purchased</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in results" :key="item.id">
                <!-- Brand -->
                <td>
                  <div class="cell-primary">
                    <div class="avatar brand-avatar">
                      {{ (item.user_brand_name || item.user_email || '?')[0].toUpperCase() }}
                    </div>
                    <div>
                      <p class="cell-name">{{ item.user_brand_name || '—' }}</p>
                      <p class="cell-sub">{{ item.user_email }}</p>
                    </div>
                  </div>
                </td>

                <!-- Plan -->
                <td>
                  <span class="plan-badge">{{ item.plan_name || '—' }}</span>
                </td>

                <!-- Billing cycle -->
                <td>
                  <span class="status-chip chip-cycle">{{ item.subscription_type_display || '—' }}</span>
                </td>

                <!-- Period -->
                <td class="cell-muted">
                  <span class="period-range">
                    {{ formatDate(item.start_date) }}
                    <span class="period-arrow">→</span>
                    {{ formatDate(item.end_date) }}
                  </span>
                </td>

                <!-- Amount -->
                <td class="cell-amount">{{ formatAmount(item.amount) }}</td>

                <!-- Purchased at -->
                <td class="cell-muted">{{ formatDateTime(item.created_at) }}</td>
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
        <p class="empty-title">No payment records found</p>
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

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
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

/* ── Filters ── */
.filters-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filters-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 240px;
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
  width: 100%;
  padding: 0 14px 0 36px;
}

.select-input {
  padding: 0 12px;
  width: 180px;
  cursor: pointer;
  appearance: auto;
}

.wide-select { width: 160px; }

.date-input {
  padding: 0 10px;
  width: 148px;
}

.filter-input::placeholder { color: var(--gray-300); }
.filter-input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(201, 164, 74, 0.1);
  outline: none;
}

.date-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toggle-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--gray-500);
  margin-right: 2px;
  white-space: nowrap;
}

.date-sep {
  color: var(--gray-400);
  font-size: 13px;
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

.cell-muted { color: var(--gray-700); }

.cell-amount {
  font-weight: 600;
  color: var(--black);
  font-variant-numeric: tabular-nums;
}

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

.brand-avatar { background: rgba(201, 164, 74, 0.15); color: var(--gold-dark); }

.plan-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--black);
  background: var(--gray-100);
  border: 1px solid var(--gray-200);
  padding: 3px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.status-chip {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 100px;
  white-space: nowrap;
}

.chip-cycle { background: rgba(52, 152, 219, 0.12); color: #1a6090; border: 1px solid rgba(52, 152, 219, 0.25); }

.period-range {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.period-arrow {
  color: var(--gray-400);
  font-size: 11px;
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

.page-btn:hover:not(:disabled) { border-color: var(--gold); color: var(--gold-dark); }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.page-info {
  font-size: 13px;
  color: var(--gray-500);
}
</style>
