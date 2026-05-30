import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/DashboardView.vue'),
      },
      {
        path: 'requests/brands',
        name: 'BrandRequests',
        component: () => import('@/views/BrandRequestsView.vue'),
      },
      {
        path: 'requests/creators',
        name: 'CreatorRequests',
        component: () => import('@/views/CreatorRequestsView.vue'),
      },
      {
        path: 'brands/active',
        name: 'ActiveBrands',
        component: () => import('@/views/ActiveBrandsView.vue'),
      },
      {
        path: 'creators/active',
        name: 'ActiveCreators',
        component: () => import('@/views/ActiveCreatorsView.vue'),
      },
      {
        path: 'gifting/requests',
        name: 'GiftingRequests',
        component: () => import('@/views/GiftingRequestsView.vue'),
      },
      {
        path: 'billing/subscriptions',
        name: 'Subscriptions',
        component: () => import('@/views/SubscriptionsView.vue'),
      },
      {
        path: 'billing/payment-history',
        name: 'PaymentHistory',
        component: () => import('@/views/PaymentHistoryView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return '/login'
  if (to.meta.public && auth.isLoggedIn) return '/'
})

export default router
