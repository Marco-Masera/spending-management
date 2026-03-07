import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import HomePage from '../views/HomePage.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage
  },
  {
    path: '/addexpense',
    component: () => import('../views/AddExpensePage.vue')
  },
  {
    path: '/settings/:firsttime',
    component: () => import('../views/SettingsPage.vue')
  },
  {
    path: '/past',
    component: () => import('../views/PastMonths.vue')
  },
  {
    path: '/pastmonth/:month/:year',
    component: () => import('../views/HomePage.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
