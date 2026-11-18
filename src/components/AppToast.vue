<script setup>
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="`toast-${t.type}`"
          role="status"
        >
          <span class="toast-icon">
            <svg v-if="t.type === 'success'" viewBox="0 0 20 20" fill="none">
              <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else viewBox="0 0 20 20" fill="none">
              <path d="M10 6v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              <circle cx="10" cy="14" r="1.1" fill="currentColor" />
            </svg>
          </span>
          <div class="toast-body">
            <p class="toast-title">{{ t.title }}</p>
            <p v-if="t.message" class="toast-message">{{ t.message }}</p>
          </div>
          <button class="toast-close" aria-label="Dismiss" @click="dismiss(t.id)">✕</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 360px;
  max-width: calc(100vw - 32px);
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-left: 3px solid var(--gold);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  font-family: var(--font-body);
}

.toast-success { border-left-color: var(--green); }
.toast-error   { border-left-color: var(--red); }

.toast-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-icon svg { width: 16px; height: 16px; }

.toast-success .toast-icon { background: rgba(39, 174, 96, 0.12); color: #1a7a42; }
.toast-error   .toast-icon { background: rgba(192, 57, 43, 0.10); color: var(--red); }

.toast-body {
  flex: 1;
  min-width: 0;
  padding-top: 3px;
}

.toast-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--black);
  line-height: 1.35;
}

.toast-message {
  font-size: 12.5px;
  color: var(--gray-500);
  margin-top: 3px;
  line-height: 1.45;
  word-break: break-word;
}

.toast-close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--gray-500);
  font-size: 12px;
  line-height: 1;
  padding: 6px;
  margin: -2px -4px 0 0;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color var(--transition), background var(--transition);
}

.toast-close:hover { color: var(--black); background: var(--gray-100); }

/* Transitions */
.toast-enter-active,
.toast-leave-active { transition: all 0.28s cubic-bezier(0.2, 0.8, 0.2, 1); }
.toast-enter-from   { opacity: 0; transform: translateX(24px); }
.toast-leave-to     { opacity: 0; transform: translateX(24px) scale(0.97); }
.toast-leave-active { position: absolute; width: 100%; }
.toast-move         { transition: transform 0.28s ease; }
</style>
