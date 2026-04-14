<template>
  <section class="recurring-list">
    <div v-if="loading" class="recurring-list__state recurring-list__state--loading">
      <ion-spinner name="crescent" />
      <p>Loading recurring expenses...</p>
    </div>

    <div v-else-if="items.length === 0" class="recurring-list__state">
      <p>{{ emptyMessage }}</p>
    </div>

    <div v-else class="recurring-list__items">
      <RecurringExpenseRow
        v-for="item in items"
        :key="item._id"
        :expense="item"
        @edit="$emit('edit', item)"
        @delete="$emit('delete', item)"
      />
    </div>
  </section>
</template>

<script lang="ts">
import { IonSpinner } from '@ionic/vue'
import { defineComponent, type PropType } from 'vue'

import type { RecurringExpense } from '@/data/model'

import RecurringExpenseRow from './RecurringExpenseRow.vue'

export default defineComponent({
  name: 'RecurringExpenseList',
  props: {
    items: {
      type: Array as PropType<RecurringExpense[]>,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
    emptyMessage: {
      type: String,
      default: 'No recurring expenses found.',
    },
  },
  emits: ['edit', 'delete'],
  components: {
    IonSpinner,
    RecurringExpenseRow,
  },
})
</script>

<style scoped>
.recurring-list {
  width: 85%;
}

.recurring-list__items {
  display: grid;
  gap: 10px;
}

.recurring-list__state {
  padding: 18px;
  border: 1px solid rgba(var(--ion-color-medium-rgb), 0.2);
  border-radius: 8px;
  text-align: center;
  color: rgba(var(--ion-text-color-rgb), 0.68);
  background: rgba(var(--ion-color-step-100-rgb), 0.35);
}

.recurring-list__state p {
  margin: 0;
}

.recurring-list__state--loading {
  display: grid;
  justify-items: center;
  gap: 10px;
}

@media (max-width: 700px) {
  .recurring-list {
    width: 100%;
  }
}
</style>
