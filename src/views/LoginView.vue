<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ email: '', password: '' })
const showPassword = ref(false)

async function handleLogin() {
  const ok = await auth.login(form.email, form.password)
  if (ok) router.push('/')
}
</script>

<template>
  <div class="login-page">
    <!-- Left panel -->
    <div class="login-left">
      <div class="brand-lockup">
        <span class="brand-mark">C</span>
        <div>
          <p class="brand-name">Conciergia</p>
          <p class="brand-tagline">Editorial gifting for European brands</p>
        </div>
      </div>
      <blockquote class="login-quote">
        "Curated with precision.<br />Delivered with grace."
      </blockquote>
    </div>

    <!-- Right panel -->
    <div class="login-right">
      <div class="login-card">
        <div class="card-header">
          <h2 class="card-title">Welcome back</h2>
          <p class="card-subtitle">Sign in to your admin panel</p>
        </div>

        <form class="login-form" @submit.prevent="handleLogin">
          <div class="field-group">
            <label class="field-label" for="email">Email address</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              class="field-input"
              placeholder="you@conciergia.com"
              autocomplete="email"
              required
            />
          </div>

          <div class="field-group">
            <label class="field-label" for="password">Password</label>
            <div class="input-wrapper">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="field-input"
                placeholder="••••••••"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                class="toggle-password"
                @click="showPassword = !showPassword"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
              >
                {{ showPassword ? 'Hide' : 'Show' }}
              </button>
            </div>
          </div>

          <div v-if="auth.error" class="error-alert" role="alert">
            {{ auth.error }}
          </div>

          <button type="submit" class="btn-submit" :disabled="auth.loading">
            <span v-if="auth.loading" class="spinner" />
            <span v-else>Sign In</span>
          </button>
        </form>

        <p class="forgot-link">
          Forgot your password?
          <a href="mailto:admin@theconciergia.com">Contact support</a>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  min-height: 100vh;
}

/* ── Left Panel ── */
.login-left {
  flex: 1;
  background: var(--black);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px 56px;
  position: relative;
  overflow: hidden;
}

.login-left::before {
  content: '';
  position: absolute;
  top: -120px;
  right: -120px;
  width: 420px;
  height: 420px;
  background: radial-gradient(circle, rgba(201, 164, 74, 0.12) 0%, transparent 70%);
  pointer-events: none;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  background: var(--gold);
  color: var(--black);
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.brand-name {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 600;
  color: var(--white);
  line-height: 1.2;
}

.brand-tagline {
  font-size: 12px;
  color: var(--gray-500);
  margin-top: 2px;
  letter-spacing: 0.3px;
}

.login-quote {
  font-family: var(--font-heading);
  font-size: 28px;
  font-weight: 400;
  font-style: italic;
  color: var(--white);
  line-height: 1.5;
  border: none;
  margin: 0;
  padding: 0;
}

.login-quote::before {
  content: '';
  display: block;
  width: 32px;
  height: 2px;
  background: var(--gold);
  margin-bottom: 20px;
}

/* ── Right Panel ── */
.login-right {
  width: 480px;
  min-width: 480px;
  background: var(--off-white);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
}

.login-card {
  width: 100%;
  max-width: 380px;
}

.card-header {
  margin-bottom: 36px;
}

.card-title {
  font-family: var(--font-heading);
  font-size: 28px;
  font-weight: 600;
  color: var(--black);
  letter-spacing: -0.5px;
}

.card-subtitle {
  font-size: 14px;
  color: var(--gray-500);
  margin-top: 6px;
}

/* ── Form ── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-700);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.field-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  background: var(--white);
  font-size: 14px;
  color: var(--black);
  transition: border-color var(--transition), box-shadow var(--transition);
}

.field-input::placeholder {
  color: var(--gray-300);
}

.field-input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(201, 164, 74, 0.12);
}

.input-wrapper {
  position: relative;
}

.input-wrapper .field-input {
  padding-right: 60px;
}

.toggle-password {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  color: var(--gray-500);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  transition: color var(--transition);
  padding: 0;
}

.toggle-password:hover {
  color: var(--gold-dark);
}

.error-alert {
  background: rgba(192, 57, 43, 0.08);
  border: 1px solid rgba(192, 57, 43, 0.25);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  font-size: 13px;
  color: var(--red);
}

.btn-submit {
  width: 100%;
  padding: 14px;
  background: var(--gold);
  color: var(--black);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  border-radius: var(--radius-md);
  transition: background var(--transition), transform var(--transition), box-shadow var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
  min-height: 48px;
}

.btn-submit:hover:not(:disabled) {
  background: var(--gold-dark);
  box-shadow: 0 4px 16px rgba(201, 164, 74, 0.3);
}

.btn-submit:active:not(:disabled) {
  transform: translateY(1px);
}

.btn-submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0, 0, 0, 0.25);
  border-top-color: var(--black);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.forgot-link {
  font-size: 13px;
  color: var(--gray-500);
  text-align: center;
  margin-top: 20px;
}

.forgot-link a {
  color: var(--gold-dark);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .login-page {
    flex-direction: column;
  }
  .login-left {
    padding: 32px 28px 40px;
    min-height: 220px;
  }
  .login-quote {
    font-size: 20px;
  }
  .login-right {
    width: 100%;
    min-width: 0;
    padding: 40px 24px;
  }
}
</style>
