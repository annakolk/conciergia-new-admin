import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://secure-api.theconciergia.com/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('auth_token') || null)
  const user = ref(JSON.parse(localStorage.getItem('auth_user') || 'null'))
  const loading = ref(false)
  const error = ref(null)

  const isLoggedIn = computed(() => !!token.value)

  function setAuth(data) {
    token.value = data.token
    user.value = data.user
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('auth_user', JSON.stringify(data.user))
    axios.defaults.headers.common['Authorization'] = `Token ${data.token}`
  }

  async function login(email, password) {
    loading.value = true
    error.value = null
    try {
      const { data } = await axios.post(`${API_BASE}/users/admin/login/`, { email, password })
      setAuth(data)
      return true
    } catch (err) {
      const status = err.response?.status
      if (status === 403) {
        error.value = 'You do not have admin access.'
      } else {
        error.value = err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Invalid credentials'
      }
      return false
    } finally {
      loading.value = false
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    delete axios.defaults.headers.common['Authorization']
  }

  if (token.value) {
    axios.defaults.headers.common['Authorization'] = `Token ${token.value}`
  }

  return { token, user, loading, error, isLoggedIn, login, logout }
})
