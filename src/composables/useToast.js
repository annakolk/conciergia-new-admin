import { reactive } from 'vue'

const toasts = reactive([])
let nextId = 1

function dismiss(id) {
  const i = toasts.findIndex(t => t.id === id)
  if (i !== -1) toasts.splice(i, 1)
}

function show(type, title, message = '', duration = 4500) {
  const id = nextId++
  toasts.push({ id, type, title, message })
  if (duration) setTimeout(() => dismiss(id), duration)
  return id
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (title, message, duration) => show('success', title, message, duration),
    error:   (title, message, duration) => show('error',   title, message, duration ?? 6000),
  }
}
