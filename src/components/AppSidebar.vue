<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const navSections = [
  {
    label: null,
    items: [
      { label: 'Dashboard', to: '/' },
    ],
  },
  {
    label: 'Signup Requests',
    items: [
      { label: 'Brands',   to: '/requests/brands' },
      { label: 'Creators', to: '/requests/creators' },
    ],
  },
  {
    label: 'Active Users',
    items: [
      { label: 'Brands',   to: '/brands/active' },
      { label: 'Creators', to: '/creators/active' },
    ],
  },
  {
    label: 'Gifting',
    items: [
      { label: 'Requests', to: '/gifting/requests' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Subscriptions',    to: '/billing/subscriptions' },
      { label: 'Payment History',  to: '/billing/payment-history' },
    ],
  },
]

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <span class="brand-mark">C</span>
      <div>
        <p class="brand-name">Conciergia</p>
        <p class="brand-sub">Admin Panel</p>
      </div>
    </div>

    <nav class="sidebar-nav">
      <template v-for="section in navSections" :key="section.label || 'main'">
        <p v-if="section.label" class="nav-section-label">{{ section.label }}</p>
        <RouterLink
          v-for="item in section.items"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: route.path === item.to }"
        >
          {{ item.label }}
        </RouterLink>
      </template>
    </nav>

    <div class="sidebar-footer">
      <button class="logout-btn" @click="handleLogout">Sign Out</button>
      <p class="footer-text">© 2025 Conciergia</p>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--black);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 28px 24px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.brand-mark {
  width: 38px;
  height: 38px;
  min-width: 38px;
  background: var(--gold);
  color: var(--black);
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  letter-spacing: -1px;
}

.brand-name {
  font-family: var(--font-heading);
  font-size: 15px;
  font-weight: 600;
  color: var(--white);
  letter-spacing: 0.3px;
  line-height: 1.2;
}

.brand-sub {
  font-size: 10px;
  color: var(--gray-500);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-top: 2px;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  color: var(--gray-500);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.3px;
  transition: all var(--transition);
  border: 1px solid transparent;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--white);
}

.nav-item.active {
  background: var(--gold-muted);
  color: var(--gold);
  border-color: rgba(201, 164, 74, 0.2);
}

.nav-section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  color: var(--gold);
  opacity: 0.65;
  padding: 18px 14px 5px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: 4px;
}

.sidebar-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.logout-btn {
  background: transparent;
  color: var(--gray-500);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-align: left;
  padding: 0;
  transition: color var(--transition);
}

.logout-btn:hover {
  color: var(--gold);
}

.footer-text {
  font-size: 10px;
  color: var(--gray-700);
  letter-spacing: 0.5px;
}
</style>
