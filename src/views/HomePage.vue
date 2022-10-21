<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Your expenses</ion-title>
            <ion-buttons slot="end">
          <ion-button href="/settings">
            Setting
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    
    <ion-content :fullscreen="true">
      
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Your expenses</ion-title>
        </ion-toolbar>
      </ion-header>
      

      <ion-card>
        <ion-card-header>
          <ion-card-title>{{monthly_exp.total_sum}} / {{monthly_exp.max_budget}} {{currency}}</ion-card-title>
          <ion-card-subtitle>Monthly expenses</ion-card-subtitle>
        </ion-card-header>

        <ion-card-content v-if="monthly_exp.remains>=0" style="color:green;">
        You are saving {{monthly_exp.remains}} {{currency}} this month so far!
        </ion-card-content>
        <ion-card-content v-if="monthly_exp.remains<0" style="color:red;">
        You are {{-monthly_exp.remains}} {{currency}} over your daily budget so far
        </ion-card-content>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>{{weekly_exp.total_sum}} / {{weekly_exp.max_budget}} {{currency}}</ion-card-title>
          <ion-card-subtitle>Weekly expenses</ion-card-subtitle>
        </ion-card-header>

        <ion-card-content v-if="weekly_exp.remains>=0" style="color:green;">
        You are saving {{weekly_exp.remains}} {{currency}} this week so far!
        </ion-card-content>
        <ion-card-content v-if="weekly_exp.remains<0" style="color:red;">
        You are {{-weekly_exp.remains}} {{currency}} over your daily budget so far
        </ion-card-content>
      </ion-card>

      <ion-item-divider>
        <ion-label>
        Expenses by category this month
        </ion-label>
      </ion-item-divider>

      <ion-list>
      <ion-item v-for="item in exp_by_cat" :key="item">
        <ion-label>{{item[0]}}</ion-label>
        <ion-label>{{item[1]}}</ion-label>
      </ion-item>
      </ion-list>

      <ion-button href="/past">Show previous months</ion-button>

      <ion-item-divider>
        <ion-label>
        All expenses
        </ion-label>
      </ion-item-divider>

      <ion-list>
      <ion-item v-for="item in all_exp" :key="item">
        <ion-label>{{item.date.getDate()}}/{{item.date.getMonth()+1}}/{{item.date.getFullYear()}}</ion-label>
        <ion-label>{{item.category}}</ion-label>
        <ion-label>{{item.cost}} {{currency}}</ion-label>
        <ion-button @click="deleteExpense(item)">X</ion-button>
      </ion-item>
      </ion-list>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button href="/addexpense">
        <ion-icon :icon="add"></ion-icon>
      </ion-fab-button>
    </ion-fab>
      
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonIcon,IonButtons,IonButton, IonContent,IonFab,IonFabButton, IonHeader, IonPage, IonItem, IonLabel, IonList, IonItemDivider, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle } from '@ionic/vue';
import { model } from '../data/model'
import { defineComponent } from 'vue';
import {add}from 'ionicons/icons';

export default defineComponent({
  name: 'HomePage',
  data() {
    return {
      monthly_exp: model.get_empty_expense(),
      weekly_exp:  model.get_empty_expense(),
      exp_by_cat: [],
      currency: "€",
      all_exp: [],
    }
  },
  methods: {
    async deleteExpense(expense: any){
      await model.remove_expense(expense)
      this.$data.all_exp = await model.get_all_month_expenses()
      this.$data.monthly_exp = await model.get_monthly_expense()
      this.$data.weekly_exp = await model.get_weekly_expense()
      this.$data.exp_by_cat = await model.get_expenses_by_category()
    },
    async init(){
      await model.init()
      this.$data.currency = model.get_default_value()
      model.get_monthly_expense().then((result:any) => this.$data.monthly_exp = result)
      model.get_weekly_expense().then((result:any) => this.$data.weekly_exp = result)
      model.get_expenses_by_category().then((result:any) => this.$data.exp_by_cat = result)
      model.get_all_month_expenses().then((result:any) => this.$data.all_exp = result)
    }
  },
  created(){
    this.init()
  },
  components: {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonFab,
    IonFabButton,
    IonItem,
    IonLabel,
    IonList,
    IonItemDivider,
    IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle,IonIcon, IonButtons,IonButton

  },
  setup() {
    return {add}
  }
});
</script>
