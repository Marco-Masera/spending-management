import { afterEach, vi } from 'vitest'
import { config } from '@vue/test-utils'
import 'fake-indexeddb/auto'

// Keep tests lightweight: stub Ionic components by tag name.
// This avoids having to register the entire IonicVue plugin.
const slotStub = {
  template: '<div><slot /></div>',
}

config.global.stubs = {
  ...config.global.stubs,
  'ion-app': slotStub,
  'ion-router-outlet': slotStub,
  'ion-page': slotStub,
  'ion-header': slotStub,
  'ion-toolbar': slotStub,
  'ion-title': slotStub,
  'ion-buttons': slotStub,
  'ion-button': slotStub,
  'ion-back-button': slotStub,
  'ion-content': slotStub,
  'ion-card': slotStub,
  'ion-card-header': slotStub,
  'ion-card-title': slotStub,
  'ion-card-subtitle': slotStub,
  'ion-card-content': slotStub,
  'ion-item-divider': slotStub,
  'ion-label': slotStub,
  'ion-fab': slotStub,
  'ion-fab-button': slotStub,
  'ion-icon': slotStub,
}

afterEach(() => {
  vi.restoreAllMocks()
})
