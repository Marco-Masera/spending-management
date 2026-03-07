<template>
  <article class="recurring-row">
    <div class="recurring-row__topline">
      <div>
        <p class="recurring-row__category">{{ expense.category }}</p>
        <p class="recurring-row__schedule">{{ scheduleLabel }}</p>
      </div>
      <div class="recurring-row__meta">
        <p class="recurring-row__amount">{{ amountLabel }}</p>
        <span class="recurring-row__status" :class="statusClass">{{ statusLabel }}</span>
      </div>
    </div>

    <dl class="recurring-row__dates">
      <div>
        <dt>Starts</dt>
        <dd>{{ formatDate(expense.startDate) }}</dd>
      </div>
      <div>
        <dt>Ends</dt>
        <dd>{{ expense.endDate ? formatDate(expense.endDate) : 'Never' }}</dd>
      </div>
    </dl>

    <div class="recurring-row__actions">
      <ion-button color="danger" fill="clear" size="small" @click="$emit('delete', expense)">
        Delete
      </ion-button>
      <ion-button fill="outline" size="small" @click="$emit('edit', expense)">
        Edit end date
      </ion-button>
    </div>
  </article>
</template>

<script lang="ts">
import { IonButton } from '@ionic/vue'
import { defineComponent, type PropType } from 'vue'

import type { RecurringExpense } from '@/data/model'

export default defineComponent({
  name: 'RecurringExpenseRow',
  props: {
    expense: {
      type: Object as PropType<RecurringExpense>,
      required: true,
    },
  },
  emits: ['edit', 'delete'],
  computed: {
    amountLabel(): string {
      return Number(this.expense.amount).toFixed(2)
    },
    scheduleLabel(): string {
      if (this.expense.frequency === 'yearly') {
        return this.expense.interval === 1
          ? 'Every year'
          : `Every ${this.expense.interval} years`
      }
      return this.expense.interval === 1
        ? 'Every month'
        : `Every ${this.expense.interval} months`
    },
    statusLabel(): string {
      const now = Date.now()
      if (this.expense.startDate.getTime() > now) return 'Upcoming'
      if (this.expense.endDate && now > this.expense.endDate.getTime()) return 'Ended'
      return 'Active'
    },
    statusClass(): string {
      return `recurring-row__status--${this.statusLabel.toLowerCase()}`
    },
  },
  methods: {
    formatDate(date: Date): string {
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date)
    },
  },
  components: {
    IonButton,
  },
})
</script>

<style scoped>
.recurring-row {
  border: 1px solid rgba(var(--ion-color-medium-rgb), 0.2);
  border-radius: 8px;
  padding: 14px 16px;
  background: rgba(var(--ion-color-step-100-rgb), 0.35);
}

.recurring-row__topline,
.recurring-row__dates,
.recurring-row__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.recurring-row__category,
.recurring-row__schedule,
.recurring-row__amount,
.recurring-row__dates dt,
.recurring-row__dates dd {
  margin: 0;
}

.recurring-row__category {
  font-size: 1rem;
  font-weight: 600;
}

.recurring-row__schedule {
  margin-top: 4px;
  color: rgba(var(--ion-text-color-rgb), 0.68);
}

.recurring-row__meta {
  text-align: right;
}

.recurring-row__amount {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-color-primary);
}

.recurring-row__status {
  display: inline-flex;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
}

.recurring-row__status--active {
  background: rgba(var(--ion-color-success-rgb), 0.14);
  color: var(--ion-color-success-shade);
}

.recurring-row__status--upcoming {
  background: rgba(var(--ion-color-warning-rgb), 0.16);
  color: var(--ion-color-warning-shade);
}

.recurring-row__status--ended {
  background: rgba(var(--ion-color-medium-rgb), 0.16);
  color: var(--ion-color-medium-shade);
}

.recurring-row__dates {
  margin: 14px 0;
  align-items: flex-start;
}

.recurring-row__dates > div {
  flex: 1;
  min-width: 0;
}

.recurring-row__dates dt {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(var(--ion-text-color-rgb), 0.55);
}

.recurring-row__dates dd {
  margin-top: 6px;
  color: var(--ion-text-color);
}

.recurring-row__actions {
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .recurring-row__topline,
  .recurring-row__dates,
  .recurring-row__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .recurring-row__meta {
    text-align: left;
  }
}
</style>
