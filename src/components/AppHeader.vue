<script setup>
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { computed } from 'vue'

const route = useRoute()
const auth = useAuthStore()

const pageTitle = computed(() => {
  const name = route.name || 'Dashboard'
  return name
})

const userInitials = computed(() => {
  const u = auth.user
  if (!u) return 'A'
  if (u.first_name && u.last_name) return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase()
  if (u.email) return u.email[0].toUpperCase()
  return 'A'
})

const userName = computed(() => {
  const u = auth.user
  if (!u) return 'Admin'
  return u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.email
})
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="page-title">{{ pageTitle }}</h1>
    </div>
    <div class="header-right">
      <div class="user-chip">
        <span class="user-avatar">{{ userInitials }}</span>
        <span class="user-name">{{ userName }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: var(--header-height);
  background: var(--white);
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  flex-shrink: 0;
}

.page-title {
  font-family: var(--font-heading);
  font-size: 20px;
  font-weight: 600;
  color: var(--black);
  letter-spacing: -0.3px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px 6px 6px;
  border: 1px solid var(--gray-200);
  border-radius: 100px;
  background: var(--off-white);
  cursor: default;
}

.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--gold);
  color: var(--black);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.5px;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-700);
}
</style>
