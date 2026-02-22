import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('@ionic/vue', () => {
  // Provide minimal component stubs so imports don't pull in Stencil.
  const stub = {}
  return {
    IonBackButton: stub,
    IonIcon: stub,
    IonButtons: stub,
    IonButton: stub,
    IonContent: stub,
    IonFab: stub,
    IonFabButton: stub,
    IonHeader: stub,
    IonPage: stub,
    IonLabel: stub,
    IonItemDivider: stub,
    IonTitle: stub,
    IonToolbar: stub,
    IonCard: stub,
    IonCardContent: stub,
    IonCardHeader: stub,
    IonCardSubtitle: stub,
    IonCardTitle: stub,
  }
})

vi.mock('ionicons/icons', () => ({
  add: 'add',
  closeCircleOutline: 'close',
  calendarClearOutline: 'calendar',
}))

vi.mock('@/data/model', () => {
  const model = {
    get_empty_expense: () => ({ total_sum: '0', max_budget: '0', remains: '0', budget_as_today: '0' }),
    init: vi.fn(async () => true),
    remove_expense: vi.fn(async () => undefined),
    get_all_month_expenses: vi.fn(async () => []),
    get_monthly_expense: vi.fn(async () => ({ total_sum: '0', max_budget: '0', remains: '0', budget_as_today: '0' })),
    get_weekly_expense: vi.fn(async () => ({ total_sum: '0', max_budget: '0', remains: '0', budget_as_today: '0' })),
    get_expenses_by_category: vi.fn(async () => []),
    get_default_value: vi.fn(() => '€'),
  }
  return { model }
})

describe('HomePage.vue', () => {
  it('renders home title', async () => {
    const { default: HomePage } = await import('@/views/HomePage.vue')

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: HomePage }],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(HomePage, {
      global: {
        plugins: [router],
        mocks: {
          $route: { params: {} },
        },
      },
    })

    expect(wrapper.text()).toContain('Your expenses')
  })
})
