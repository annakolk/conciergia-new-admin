<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const loading = ref(true)
const error = ref(null)
const kpis = ref(null)
const pendingBrands = ref([])
const pendingCreators = ref([])

const PREVIEW_LIMIT = 5

async function fetchDashboard() {
  loading.value = true
  error.value = null
  try {
    const { data } = await axios.get(`${import.meta.env.VITE_API_BASE}/users/admin/dashboard/`)
    kpis.value = data.kpis
    pendingBrands.value = data.pending_brand_requests || []
    pendingCreators.value = data.pending_creator_requests || []
  } catch {
    error.value = 'Failed to load dashboard data. Please refresh.'
  } finally {
    loading.value = false
  }
}

function formatDate(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(fetchDashboard)
</script>

<template>
  <div class="dashboard">
    <div class="dashboard-top">
      <div>
        <h2 class="section-title">Dashboard</h2>
        <p class="section-sub">Live overview of signups and active accounts.</p>
      </div>
      <button class="refresh-btn" :disabled="loading" @click="fetchDashboard">
        <span :class="{ spinning: loading }">↻</span>
        Refresh
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-banner">{{ error }}</div>

    <!-- KPI Grid -->
    <div v-if="loading && !kpis" class="skeleton-grid">
      <div v-for="n in 6" :key="n" class="skeleton-card" />
    </div>

    <div v-else-if="kpis" class="kpi-section">
      <!-- Brands row -->
      <div class="entity-row">
        <span class="entity-label brands-label">Brands</span>
        <div class="kpi-row">
          <div class="kpi-card warning">
            <p class="kpi-meta">Signup Requests</p>
            <p class="kpi-value">{{ kpis.brand_requests_pending }}</p>
            <p class="kpi-sub">Pending review</p>
          </div>
          <div class="kpi-card info">
            <p class="kpi-meta">Approved</p>
            <p class="kpi-value">{{ kpis.brands_approved_not_signed_up }}</p>
            <p class="kpi-sub">Not yet signed up</p>
          </div>
          <div class="kpi-card success">
            <p class="kpi-meta">Active</p>
            <p class="kpi-value">{{ kpis.brands_active }}</p>
            <p class="kpi-sub">Total active accounts</p>
          </div>
        </div>
      </div>

      <!-- Creators row -->
      <div class="entity-row">
        <span class="entity-label creators-label">Creators</span>
        <div class="kpi-row">
          <div class="kpi-card warning">
            <p class="kpi-meta">Signup Requests</p>
            <p class="kpi-value">{{ kpis.creator_requests_pending }}</p>
            <p class="kpi-sub">Pending review</p>
          </div>
          <div class="kpi-card info">
            <p class="kpi-meta">Approved</p>
            <p class="kpi-value">{{ kpis.creators_approved_not_signed_up }}</p>
            <p class="kpi-sub">Not yet signed up</p>
          </div>
          <div class="kpi-card success">
            <p class="kpi-meta">Active</p>
            <p class="kpi-value">{{ kpis.creators_active }}</p>
            <p class="kpi-sub">Total active accounts</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Pending Requests -->
    <div class="pending-grid">
      <!-- Pending Brands -->
      <section class="card">
        <div class="card-head">
          <div class="card-head-left">
            <span class="card-dot brands-dot" />
            <h3 class="card-title">Pending Brand Signups</h3>
          </div>
          <span class="card-badge">{{ pendingBrands.length }}</span>
        </div>

        <div v-if="loading" class="list-skeleton">
          <div v-for="n in 3" :key="n" class="list-skeleton-row" />
        </div>

        <ul v-else-if="pendingBrands.length" class="request-list">
          <li
            v-for="brand in pendingBrands.slice(0, PREVIEW_LIMIT)"
            :key="brand.id"
            class="request-item"
          >
            <div class="request-avatar brands-avatar">
              {{ (brand.brand_name || brand.name || '?')[0].toUpperCase() }}
            </div>
            <div class="request-body">
              <p class="request-name">{{ brand.brand_name || brand.name || '—' }}</p>
              <p class="request-email">{{ brand.email || '—' }}</p>
            </div>
            <p class="request-date">{{ formatDate(brand.created_at || brand.submitted_at) }}</p>
          </li>
        </ul>

        <div v-else class="empty-state">No pending brand requests.</div>

        <div v-if="pendingBrands.length > 0" class="card-footer">
          <button class="view-all-btn brands-btn" @click="router.push('/requests/brands')">
            View all {{ pendingBrands.length }} requests →
          </button>
        </div>
      </section>

      <!-- Pending Creators -->
      <section class="card">
        <div class="card-head">
          <div class="card-head-left">
            <span class="card-dot creators-dot" />
            <h3 class="card-title">Pending Creator Signups</h3>
          </div>
          <span class="card-badge">{{ pendingCreators.length }}</span>
        </div>

        <div v-if="loading" class="list-skeleton">
          <div v-for="n in 3" :key="n" class="list-skeleton-row" />
        </div>

        <ul v-else-if="pendingCreators.length" class="request-list">
          <li
            v-for="creator in pendingCreators.slice(0, PREVIEW_LIMIT)"
            :key="creator.id"
            class="request-item"
          >
            <div class="request-avatar creators-avatar">
              {{ (creator.full_name || creator.name || '?')[0].toUpperCase() }}
            </div>
            <div class="request-body">
              <p class="request-name">{{ creator.full_name || creator.name || '—' }}</p>
              <p class="request-email">{{ creator.email || '—' }}</p>
            </div>
            <p class="request-date">{{ formatDate(creator.created_at || creator.submitted_at) }}</p>
          </li>
        </ul>

        <div v-else class="empty-state">No pending creator requests.</div>

        <div v-if="pendingCreators.length > 0" class="card-footer">
          <button class="view-all-btn creators-btn" @click="router.push('/requests/creators')">
            View all {{ pendingCreators.length }} requests →
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* ── Header ── */
.dashboard-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.section-title {
  font-family: var(--font-heading);
  font-size: 22px;
  font-weight: 600;
  color: var(--black);
  letter-spacing: -0.3px;
}

.section-sub {
  font-size: 13px;
  color: var(--gray-500);
  margin-top: 4px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  background: var(--white);
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-700);
  transition: all var(--transition);
}

.refresh-btn:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--black);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  display: inline-block;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Error ── */
.error-banner {
  padding: 14px 18px;
  background: rgba(192, 57, 43, 0.08);
  border: 1px solid rgba(192, 57, 43, 0.25);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--red);
}

/* ── Skeleton ── */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.skeleton-card {
  height: 110px;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

/* ── KPI Section ── */
.kpi-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.entity-row {
  display: flex;
  align-items: stretch;
  gap: 14px;
}

.entity-label {
  writing-mode: vertical-lr;
  text-orientation: mixed;
  transform: rotate(180deg);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.brands-label {
  background: rgba(201, 164, 74, 0.1);
  color: var(--gold-dark);
}

.creators-label {
  background: rgba(52, 152, 219, 0.1);
  color: #1a6090;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  flex: 1;
}

.kpi-card {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  padding: 22px 24px;
  position: relative;
  overflow: hidden;
  transition: box-shadow var(--transition);
  border-top-width: 3px;
}

.kpi-card:hover {
  box-shadow: var(--shadow-md);
}

.kpi-card.warning { border-top-color: #e6aa32; }
.kpi-card.info    { border-top-color: #3498db; }
.kpi-card.success { border-top-color: #27ae60; }

.kpi-meta {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--gray-500);
}

.kpi-value {
  font-family: var(--font-heading);
  font-size: 36px;
  font-weight: 600;
  color: var(--black);
  line-height: 1.1;
  margin-top: 8px;
  letter-spacing: -1px;
}

.kpi-sub {
  font-size: 12px;
  color: var(--gray-500);
  margin-top: 4px;
}

/* ── Pending Grid ── */
.pending-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* ── Card ── */
.card {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-head {
  padding: 18px 24px;
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.brands-dot    { background: var(--gold); }
.creators-dot  { background: #3498db; }

.card-title {
  font-family: var(--font-heading);
  font-size: 15px;
  font-weight: 600;
  color: var(--black);
}

.card-badge {
  background: var(--gray-100);
  color: var(--gray-700);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 100px;
}

/* ── List Skeleton ── */
.list-skeleton {
  padding: 12px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.list-skeleton-row {
  height: 48px;
  background: var(--gray-100);
  border-radius: var(--radius-md);
  animation: pulse 1.4s ease-in-out infinite;
}

/* ── Request List ── */
.request-list {
  list-style: none;
  flex: 1;
}

.request-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--gray-100);
  transition: background var(--transition);
}

.request-item:last-child {
  border-bottom: none;
}

.request-item:hover {
  background: var(--off-white);
}

.request-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  font-size: 14px;
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

.creators-avatar {
  background: rgba(52, 152, 219, 0.12);
  color: #1a6090;
}

.request-body {
  flex: 1;
  min-width: 0;
}

.request-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--black);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.request-email {
  font-size: 12px;
  color: var(--gray-500);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.request-date {
  font-size: 11px;
  color: var(--gray-500);
  flex-shrink: 0;
}

/* ── Empty ── */
.empty-state {
  padding: 40px 24px;
  text-align: center;
  font-size: 13px;
  color: var(--gray-500);
}

/* ── Footer ── */
.card-footer {
  padding: 14px 24px;
  border-top: 1px solid var(--gray-100);
}

.view-all-btn {
  width: 100%;
  padding: 10px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--gray-200);
  background: transparent;
  transition: all var(--transition);
}

.brands-btn {
  color: var(--gold-dark);
}

.brands-btn:hover {
  background: rgba(201, 164, 74, 0.08);
  border-color: var(--gold);
}

.creators-btn {
  color: #1a6090;
}

.creators-btn:hover {
  background: rgba(52, 152, 219, 0.08);
  border-color: #3498db;
}

/* ── Responsive ── */
@media (max-width: 1100px) {
  .kpi-row {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 820px) {
  .pending-grid {
    grid-template-columns: 1fr;
  }

  .entity-label {
    writing-mode: horizontal-tb;
    transform: none;
    padding: 6px 12px;
  }

  .entity-row {
    flex-direction: column;
  }

  .kpi-row {
    grid-template-columns: 1fr;
  }
}
</style>
