<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import axios from 'axios'

const ORDERING_OPTIONS = [
  { label: 'Newest first',  value: '-created_at' },
  { label: 'Oldest first',  value: 'created_at' },
  { label: 'Name A–Z',      value: 'brand_name' },
]

const loading     = ref(false)
const error       = ref(null)
const results     = ref([])
const totalCount  = ref(0)
const nextUrl     = ref(null)
const prevUrl     = ref(null)
const currentPage = ref(1)

const filters = reactive({
  search:              '',
  country:             '',
  enabled:             '',   // '' | 'true' | 'false'
  active_subscription: '',
  verified_account:    '',
  ordering:            '-created_at',
})

let debounceTimer = null

async function fetchBrands(url = null) {
  loading.value = true
  error.value = null
  try {
    let res
    if (url) {
      res = await axios.get(url)
    } else {
      const params = { user_type: 1 }
      if (filters.search)              params.search              = filters.search
      if (filters.country)             params.country             = filters.country
      if (filters.enabled !== '')      params.enabled             = filters.enabled
      if (filters.active_subscription !== '') params.active_subscription = filters.active_subscription
      if (filters.verified_account !== '')    params.verified_account    = filters.verified_account
      if (filters.ordering)            params.ordering            = filters.ordering
      res = await axios.get(`${import.meta.env.VITE_API_BASE}/users/admin/get-all-users/`, { params })
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
    error.value = 'Failed to load active brands.'
  } finally {
    loading.value = false
  }
}

function debounced() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { currentPage.value = 1; fetchBrands() }, 400)
}

function toggleFilter(key, value) {
  filters[key] = filters[key] === value ? '' : value
  currentPage.value = 1
  fetchBrands()
}

function goNext() { if (nextUrl.value) { currentPage.value++; fetchBrands(nextUrl.value) } }
function goPrev() { if (prevUrl.value) { currentPage.value--; fetchBrands(prevUrl.value) } }

function formatDate(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

watch(() => [filters.search, filters.country], debounced)
watch(() => filters.ordering, () => { currentPage.value = 1; fetchBrands() })
onMounted(fetchBrands)
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">Active Brands</h2>
        <p class="page-sub">All registered brand accounts on the platform.</p>
      </div>
      <span class="total-badge">{{ totalCount }} brands</span>
    </div>

    <!-- Filters -->
    <div class="filters-wrap">
      <div class="filters-row">
        <div class="search-wrap">
          <span class="search-icon">⌕</span>
          <input
            v-model="filters.search"
            type="text"
            class="filter-input search-input"
            placeholder="Search name, email or Instagram…"
          />
        </div>
        <input
          v-model="filters.country"
          type="text"
          class="filter-input country-input"
          placeholder="Country…"
        />
        <select v-model="filters.ordering" class="filter-input ordering-select">
          <option v-for="opt in ORDERING_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="toggle-row">
        <span class="toggle-label">Filter by:</span>
        <button
          class="toggle-chip"
          :class="{ active: filters.enabled === 'true', inactive: filters.enabled === 'false' }"
          @click="toggleFilter('enabled', filters.enabled === 'true' ? 'false' : 'true')"
        >
          <span class="chip-dot" />
          Enabled
          <span v-if="filters.enabled" class="chip-val">{{ filters.enabled }}</span>
        </button>
        <button
          class="toggle-chip"
          :class="{ active: filters.active_subscription === 'true' }"
          @click="toggleFilter('active_subscription', 'true')"
        >
          Active Subscription
        </button>
        <button
          class="toggle-chip"
          :class="{ active: filters.verified_account === 'true' }"
          @click="toggleFilter('verified_account', 'true')"
        >
          Verified
        </button>
        <button
          v-if="filters.enabled || filters.active_subscription || filters.verified_account"
          class="clear-btn"
          @click="filters.enabled = ''; filters.active_subscription = ''; filters.verified_account = ''; currentPage = 1; fetchBrands()"
        >
          Clear filters
        </button>
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
                <th>Flags</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="brand in results" :key="brand.id">
                <td>
                  <div class="cell-primary">
                    <div class="avatar brands-avatar">
                      {{ (brand.brand_name || brand.email || '?')[0].toUpperCase() }}
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
                <td>
                  <div class="flags">
                    <span v-if="brand.active_subscription" class="flag flag-green">Subscribed</span>
                    <span v-if="brand.verified_account"    class="flag flag-blue">Verified</span>
                    <span v-if="brand.enabled === false"   class="flag flag-red">Disabled</span>
                  </div>
                </td>
                <td class="cell-muted">{{ formatDate(brand.created_at) }}</td>
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
        <p class="empty-title">No brands found</p>
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
  min-width: 220px;
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

.country-input {
  padding: 0 14px;
  width: 140px;
}

.ordering-select {
  padding: 0 12px;
  width: 160px;
  cursor: pointer;
  appearance: auto;
}

.filter-input::placeholder { color: var(--gray-300); }
.filter-input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(201, 164, 74, 0.1);
}

/* ── Toggle chips ── */
.toggle-row {
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

.toggle-chip:hover {
  border-color: var(--gray-300);
  color: var(--black);
}

.toggle-chip.active {
  background: rgba(39, 174, 96, 0.1);
  border-color: rgba(39, 174, 96, 0.4);
  color: #1a7a42;
}

.toggle-chip.inactive {
  background: rgba(192, 57, 43, 0.08);
  border-color: rgba(192, 57, 43, 0.3);
  color: var(--red);
}

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
  50% { opacity: 0.4; }
}

.table-wrap { overflow-x: auto; }

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead tr { border-bottom: 1px solid var(--gray-200); }

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

.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr { transition: background var(--transition); }
.data-table tbody tr:hover { background: var(--off-white); }

.cell-primary {
  display: flex;
  align-items: center;
  gap: 12px;
}

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

.cell-muted { color: var(--gray-700); }

.cell-region {
  color: var(--gray-500);
  font-size: 12px;
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

.flag-green { background: rgba(39, 174, 96, 0.12);  color: #1a7a42; border: 1px solid rgba(39, 174, 96, 0.25); }
.flag-blue  { background: rgba(52, 152, 219, 0.12); color: #1a6090; border: 1px solid rgba(52, 152, 219, 0.25); }
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
