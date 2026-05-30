<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import axios from 'axios'

const SUBSCRIPTION_TYPE_OPTS = [
  { label: 'All billing cycles', value: '' },
  { label: 'Monthly',            value: '1' },
  { label: 'Annually',           value: '2' },
]

const ORDERING_OPTS = [
  { label: 'Start date desc',  value: '-start_date' },
  { label: 'Start date asc',   value: 'start_date' },
  { label: 'End date desc',    value: '-end_date' },
  { label: 'End date asc',     value: 'end_date' },
  { label: 'Amount desc',      value: '-amount' },
  { label: 'Amount asc',       value: 'amount' },
  { label: 'Newest (id)',      value: '-id' },
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
  free_trial:        '',
  auto_renew:        '',
  expired:           '',
  start_from:        '',
  start_to:          '',
  end_from:          '',
  end_to:            '',
  ordering:          '-start_date',
})

let debounceTimer = null

async function fetchSubscriptions(url = null) {
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
      if (filters.free_trial !== '')  params.free_trial        = filters.free_trial
      if (filters.auto_renew !== '')  params.auto_renew        = filters.auto_renew
      if (filters.expired !== '')     params.expired           = filters.expired
      if (filters.start_from)        params.start_from        = filters.start_from
      if (filters.start_to)          params.start_to          = filters.start_to
      if (filters.end_from)          params.end_from          = filters.end_from
      if (filters.end_to)            params.end_to            = filters.end_to
      if (filters.ordering)          params.ordering          = filters.ordering
      res = await axios.get(`${import.meta.env.VITE_API_BASE}/users/admin/subscriptions/`, { params })
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
    error.value = 'Failed to load subscriptions.'
  } finally {
    loading.value = false
  }
}

function debounced() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { currentPage.value = 1; fetchSubscriptions() }, 400)
}

function toggleBool(key, val) {
  filters[key] = filters[key] === val ? '' : val
  currentPage.value = 1
  fetchSubscriptions()
}

function goNext() { if (nextUrl.value) { currentPage.value++; fetchSubscriptions(nextUrl.value) } }
function goPrev() { if (prevUrl.value) { currentPage.value--; fetchSubscriptions(prevUrl.value) } }

function formatDate(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatAmount(val) {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(val)
}

const hasToggle = (key, val) => filters[key] === val

watch(() => [filters.search, filters.start_from, filters.start_to, filters.end_from, filters.end_to], debounced)
watch(() => [filters.subscription_type, filters.ordering], () => { currentPage.value = 1; fetchSubscriptions() })
onMounted(fetchSubscriptions)
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">Subscriptions</h2>
        <p class="page-sub">All active and expired brand subscriptions.</p>
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
            placeholder="Search email, brand, plan, Stripe ID…"
          />
        </div>
        <select v-model="filters.subscription_type" class="filter-input select-input">
          <option v-for="o in SUBSCRIPTION_TYPE_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <select v-model="filters.ordering" class="filter-input select-input wide-select">
          <option v-for="o in ORDERING_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>

      <!-- Toggle chips -->
      <div class="toggle-row">
        <span class="toggle-label">Filter:</span>

        <button
          class="toggle-chip"
          :class="{ active: hasToggle('expired', 'false'), inactive: hasToggle('expired', 'true') }"
          @click="toggleBool('expired', hasToggle('expired', 'false') ? 'true' : 'false')"
        >
          <span class="chip-dot" />
          {{ hasToggle('expired', 'true') ? 'Expired' : 'Active' }}
        </button>

        <button
          class="toggle-chip"
          :class="{ active: hasToggle('free_trial', 'true') }"
          @click="toggleBool('free_trial', 'true')"
        >Free Trial</button>

        <button
          class="toggle-chip"
          :class="{ active: hasToggle('auto_renew', 'true'), inactive: hasToggle('auto_renew', 'false') }"
          @click="toggleBool('auto_renew', hasToggle('auto_renew', 'true') ? 'false' : 'true')"
        >
          Auto-Renew
          <span v-if="hasToggle('auto_renew', 'true')" class="chip-val">on</span>
          <span v-if="hasToggle('auto_renew', 'false')" class="chip-val">off</span>
        </button>

        <button
          v-if="filters.expired || filters.free_trial || filters.auto_renew"
          class="clear-btn"
          @click="filters.expired = ''; filters.free_trial = ''; filters.auto_renew = ''; currentPage = 1; fetchSubscriptions()"
        >Clear</button>
      </div>

      <!-- Date range row -->
      <div class="date-row">
        <span class="toggle-label">Start:</span>
        <input v-model="filters.start_from" type="date" class="filter-input date-input" />
        <span class="date-sep">–</span>
        <input v-model="filters.start_to"   type="date" class="filter-input date-input" />
        <span class="toggle-label" style="margin-left: 16px;">End:</span>
        <input v-model="filters.end_from"   type="date" class="filter-input date-input" />
        <span class="date-sep">–</span>
        <input v-model="filters.end_to"     type="date" class="filter-input date-input" />
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
                <th>Start</th>
                <th>End</th>
                <th>Amount</th>
                <th>Flags</th>
                <th>Stripe ID</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sub in results" :key="sub.id">
                <!-- Brand -->
                <td>
                  <div class="cell-primary">
                    <div class="avatar brand-avatar">
                      {{ (sub.user_brand_name || sub.user_email || '?')[0].toUpperCase() }}
                    </div>
                    <div>
                      <p class="cell-name">{{ sub.user_brand_name || '—' }}</p>
                      <p class="cell-sub">{{ sub.user_email }}</p>
                    </div>
                  </div>
                </td>

                <!-- Plan -->
                <td>
                  <span class="plan-badge">{{ sub.plan_name || '—' }}</span>
                </td>

                <!-- Billing cycle -->
                <td>
                  <span class="status-chip chip-cycle">{{ sub.subscription_type_display || '—' }}</span>
                </td>

                <!-- Start / End -->
                <td class="cell-muted">{{ formatDate(sub.start_date) }}</td>
                <td class="cell-muted" :class="{ 'cell-expired': sub.is_expired }">
                  {{ formatDate(sub.end_date) }}
                </td>

                <!-- Amount -->
                <td class="cell-amount">{{ formatAmount(sub.amount) }}</td>

                <!-- Flags -->
                <td>
                  <div class="flags">
                    <span v-if="sub.is_expired"  class="flag flag-red">Expired</span>
                    <span v-if="sub.free_trial"  class="flag flag-teal">Trial</span>
                    <span v-if="sub.auto_renew"  class="flag flag-green">Auto-renew</span>
                  </div>
                </td>

                <!-- Stripe ID -->
                <td class="cell-stripe">{{ sub.stripe_subscription_id || '—' }}</td>
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
        <p class="empty-title">No subscriptions found</p>
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

/* ── Toggle chips ── */
.toggle-row, .date-row {
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

.toggle-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gray-700);
  background: var(--white);
  border: 1px solid var(--gray-200);
  transition: all var(--transition);
  cursor: pointer;
}

.toggle-chip:hover { border-color: var(--gray-300); color: var(--black); }
.toggle-chip.active  { background: rgba(39, 174, 96, 0.10); border-color: rgba(39, 174, 96, 0.4); color: #1a7a42; }
.toggle-chip.inactive { background: rgba(192, 57, 43, 0.08); border-color: rgba(192, 57, 43, 0.3); color: var(--red); }

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.6;
}

.chip-val {
  font-size: 10px;
  font-weight: 700;
  background: currentColor;
  color: white;
  padding: 0 5px;
  border-radius: 4px;
  opacity: 0.85;
}

.clear-btn {
  font-size: 12px;
  color: var(--gray-500);
  background: transparent;
  border: none;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  transition: color var(--transition);
  margin-left: 4px;
}

.clear-btn:hover { color: var(--red); }

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

.cell-expired { color: var(--red); }

.cell-amount {
  font-weight: 600;
  color: var(--black);
  font-variant-numeric: tabular-nums;
}

.cell-stripe {
  font-size: 11px;
  color: var(--gray-500);
  font-family: monospace;
  white-space: nowrap;
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

/* ── Plan badge ── */
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

.chip-cycle { background: rgba(52, 152, 219, 0.12); color: #1a6090; border: 1px solid rgba(52, 152, 219, 0.25); }

/* ── Flags ── */
.flags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.flag {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 100px;
}

.flag-green { background: rgba(39, 174, 96, 0.12);  color: #1a7a42;    border: 1px solid rgba(39, 174, 96, 0.25); }
.flag-teal  { background: rgba(26, 188, 156, 0.12); color: #0e7a6a;    border: 1px solid rgba(26, 188, 156, 0.25); }
.flag-red   { background: rgba(192, 57, 43, 0.10);  color: var(--red); border: 1px solid rgba(192, 57, 43, 0.2); }

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
