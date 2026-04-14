<template>
  <div v-if="open" class="recurring-form-overlay" @click.self="$emit('cancel')">
    <section class="recurring-form-panel">
      <div class="recurring-form-panel__header">
        <div>
          <h2 class="recurring-form-panel__title">{{ panelTitle }}</h2>
        </div>
        <button class="recurring-form-panel__close" type="button" @click="$emit('cancel')">
          Close
        </button>
      </div>

      <form class="recurring-form" @submit.prevent="submitForm">
        <template v-if="mode === 'create'">
          <label>
            <span>Amount</span>
            <input v-model="amount" type="number" inputmode="decimal" step="0.01" min="0" required />
          </label>

          <label>
            <span>Category</span>
            <select v-model="category" required>
              <option disabled value="">Choose a category</option>
              <option v-for="item in categories" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>

          <div class="recurring-form__two-up">
            <label>
              <span>Frequency</span>
              <select v-model="frequency">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>

            <label>
              <span>Interval</span>
              <input v-model="interval" type="number" min="1" step="1" required />
            </label>
          </div>

          <label>
            <span>Start date</span>
            <input v-model="startLocal" type="date" required />
          </label>
        </template>

        <div v-else-if="expense" class="recurring-form__summary">
          <p><strong>{{ expense.category }}</strong></p>
          <p>{{ summaryLabel }}</p>
          <p>Starts {{ formatDate(expense.startDate) }}</p>
        </div>

        <label>
          <span>End date</span>
          <input v-model="endLocal" type="date" />
        </label>

        <div class="recurring-form__actions">
          <ion-button fill="clear" type="button" @click="$emit('cancel')">Cancel</ion-button>
          <ion-button :disabled="saving || !canSubmit" type="submit">
            {{ saving ? 'Saving...' : submitLabel }}
          </ion-button>
        </div>
      </form>
    </section>
  </div>
</template>

<script lang="ts">
import { IonButton } from '@ionic/vue'
import { defineComponent, type PropType } from 'vue'

import type {
  AddRecurringExpenseInput,
  RecurringExpense,
  RecurringFrequency,
} from '@/data/model'

type RecurringExpenseFormMode = 'create' | 'edit-end'

export default defineComponent({
  name: 'RecurringExpenseForm',
  props: {
    open: {
      type: Boolean,
      default: false,
    },
    mode: {
      type: String as PropType<RecurringExpenseFormMode>,
      default: 'create',
    },
    expense: {
      type: Object as PropType<RecurringExpense | null>,
      default: null,
    },
    categories: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    saving: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['cancel', 'save'],
  data() {
    return {
      amount: '',
      category: '',
      frequency: 'monthly' as RecurringFrequency,
      interval: 1,
      startLocal: '',
      endLocal: '',
    }
  },
  watch: {
    open: {
      immediate: true,
      handler() {
        this.resetForm()
      },
    },
    mode() {
      this.resetForm()
    },
    expense() {
      this.resetForm()
    },
    categories() {
      if (!this.category && this.mode === 'create' && this.categories.length > 0) {
        this.category = this.categories[0]
      }
    },
  },
  computed: {
    panelTitle(): string {
      return this.mode === 'create' ? 'Create recurring expense' : 'Edit recurring expense end date'
    },
    submitLabel(): string {
      return this.mode === 'create' ? 'Create recurring expense' : 'Update end date'
    },
    canSubmit(): boolean {
      if (this.mode === 'edit-end') {
        return true
      }

      if (!this.amount || !this.category || !this.startLocal) return false
      if (!Number.isFinite(Number(this.amount))) return false
      if (!Number.isInteger(Number(this.interval)) || Number(this.interval) < 1) return false
      return true
    },
    summaryLabel(): string {
      if (!this.expense) return ''
      if (this.expense.frequency === 'yearly') {
        return this.expense.interval === 1
          ? 'Repeats every year'
          : `Repeats every ${this.expense.interval} years`
      }
      return this.expense.interval === 1
        ? 'Repeats every month'
        : `Repeats every ${this.expense.interval} months`
    },
  },
  methods: {
    resetForm() {
      if (!this.open) return

      if (this.mode === 'edit-end' && this.expense) {
        this.amount = String(this.expense.amount)
        this.category = this.expense.category
        this.frequency = this.expense.frequency
        this.interval = this.expense.interval
        this.startLocal = this.toDateInputValue(this.expense.startDate)
        this.endLocal = this.expense.endDate ? this.toDateInputValue(this.expense.endDate) : ''
        return
      }

      this.amount = ''
      this.category = this.categories[0] ?? ''
      this.frequency = 'monthly'
      this.interval = 1
      this.startLocal = this.toDateInputValue(new Date(Date.now()))
      this.endLocal = ''
    },
    toDateInputValue(date: Date): string {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    parseDateInput(value: string): Date | null {
      if (!value) return null

      const [year, month, day] = value.split('-').map(Number)
      if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day)
      ) {
        return null
      }

      return new Date(year, month - 1, day)
    },
    formatDate(date: Date): string {
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date)
    },
    submitForm() {
      if (!this.canSubmit) return

      if (this.mode === 'edit-end') {
        const endDate = this.endLocal ? this.parseDateInput(this.endLocal) : null
        if (this.endLocal && !endDate) return

        this.$emit('save', {
          endDate,
        })
        return
      }

      const startDate = this.parseDateInput(this.startLocal)
      if (!startDate) return

      const payload: AddRecurringExpenseInput = {
        amount: Number(this.amount),
        category: this.category,
        frequency: this.frequency,
        interval: Number(this.interval),
        startDate,
      }

      if (this.endLocal) {
        const endDate = this.parseDateInput(this.endLocal)
        if (!endDate) return
        payload.endDate = endDate
      }

      this.$emit('save', payload)
    },
  },
  components: {
    IonButton,
  },
})
</script>

<style scoped>
.recurring-form-overlay {
  --recurring-form-top-offset: calc(var(--ion-safe-area-top, 0px) + 56px);
  position: fixed;
  inset: var(--recurring-form-top-offset) 0 0 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.55);
}

.recurring-form-panel {
  width: min(100%, 560px);
  max-height: min(calc(100vh - var(--recurring-form-top-offset) - 40px), 760px);
  overflow: auto;
  border-radius: 12px;
  background: var(--ion-background-color);
  border: 1px solid rgba(var(--ion-color-medium-rgb), 0.2);
  padding: 20px;
}

.recurring-form-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.recurring-form-panel__title,
.recurring-form__summary p,
.recurring-form label span {
  margin: 0;
}

.recurring-form-panel__title {
  font-size: 1.2rem;
  font-weight: 600;
}

.recurring-form-panel__close {
  border: 1px solid rgba(var(--ion-color-medium-rgb), 0.25);
  border-radius: 8px;
  background: transparent;
  color: var(--ion-text-color);
  padding: 8px 12px;
  font-weight: 500;
}

.recurring-form {
  display: grid;
  gap: 16px;
}

.recurring-form label {
  display: grid;
  gap: 8px;
}

.recurring-form label span {
  font-size: 0.88rem;
  font-weight: 500;
  color: rgba(var(--ion-text-color-rgb), 0.72);
}

.recurring-form input,
.recurring-form select {
  width: 100%;
  border: 1px solid rgba(var(--ion-color-medium-rgb), 0.25);
  border-radius: 8px;
  background: rgba(var(--ion-color-step-100-rgb), 0.35);
  color: var(--ion-text-color);
  padding: 12px 14px;
  font: inherit;
}

.recurring-form option {
  background: var(--ion-background-color);
  color: var(--ion-text-color);
}

.recurring-form input:disabled {
  background: rgba(var(--ion-color-step-150-rgb), 0.25);
  color: rgba(var(--ion-text-color-rgb), 0.4);
}

.recurring-form__two-up {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.recurring-form__summary {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid rgba(var(--ion-color-medium-rgb), 0.2);
  background: rgba(var(--ion-color-step-100-rgb), 0.35);
}

.recurring-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

@media (max-width: 640px) {
  .recurring-form-panel {
    padding: 20px;
  }

  .recurring-form__two-up {
    grid-template-columns: 1fr;
  }

  .recurring-form__actions {
    flex-direction: column-reverse;
  }
}

@media (prefers-color-scheme: dark) {
  .recurring-form input,
  .recurring-form select,
  .recurring-form option {
    color-scheme: dark;
  }
}
</style>
