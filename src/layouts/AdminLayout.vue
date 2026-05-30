<script setup>
import AppSidebar from '@/components/AppSidebar.vue'
import AppHeader from '@/components/AppHeader.vue'
</script>

<template>
  <div class="admin-layout">
    <AppSidebar />
    <div class="admin-main">
      <AppHeader />
      <main class="admin-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--off-white);
}

.admin-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}
</style>
