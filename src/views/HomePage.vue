<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Your expenses</ion-title>
            <ion-buttons slot="end">
          <ion-button href="/settings/false">
            <p style="font-weight:550">Settings</p>
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
      

      <ion-card class="withborder">
        <ion-card-header>
          <ion-card-title>{{monthly_exp.total_sum}} / {{monthly_exp.max_budget}} {{currency}}</ion-card-title>
          <ion-card-subtitle>Monthly expenses</ion-card-subtitle>
        </ion-card-header>

        <ion-card-content v-if="monthly_exp.remains>=0" style="color:green;">
        You are saving {{monthly_exp.remains}} {{currency}} this month so far!
        </ion-card-content>
        <ion-card-content v-if="monthly_exp.remains<0" style="color:var(--ion-color-danger);">
        You are {{-monthly_exp.remains}} {{currency}} over your daily budget so far
        </ion-card-content>
      </ion-card>

      <ion-card class="withborder">
        <ion-card-header>
          <ion-card-title>{{weekly_exp.total_sum}} / {{weekly_exp.max_budget}} {{currency}}</ion-card-title>
          <ion-card-subtitle>Weekly expenses</ion-card-subtitle>
        </ion-card-header>

        <ion-card-content v-if="weekly_exp.remains>=0" style="color:green;">
        You are saving {{weekly_exp.remains}} {{currency}} this week so far!
        </ion-card-content>
        <ion-card-content v-if="weekly_exp.remains<0" style="color:var(--ion-color-danger);">
        You are {{-weekly_exp.remains}} {{currency}} over your daily budget so far
        </ion-card-content>
      </ion-card>

      <div style="margin-bottom:32px"></div>

<div v-if="all_exp.length>0">

      <div class="dividercontainer">
      <ion-item-divider class="withtopborder">
        <p class="weightened">
        Expenses by category this month
        </p>
      </ion-item-divider>
      </div>
      <ion-card class="withborder">
      

      <div  v-for="(item, index) in exp_by_cat" :key="item">
      <div class = "partoflist">
        <ion-label style="max-width:80%"><p class="list_int">{{item[0]}}</p></ion-label>
        <ion-label>{{item[1]}}{{currency}}</ion-label>
      </div>
      <hr v-if="index < (exp_by_cat.length - 1)">
      </div>
      </ion-card>

     <div class="dividercontainer">
       <ion-item-divider class="withtopborder">
        <p class="weightened">
        All expenses
        </p>
      </ion-item-divider>
      </div>

      <ion-card class="withborder">


      <div  v-for="(item, index) in all_exp" :key="item">
      <div class = "partoflistbig">
      <div class = "partoflistsmall">
        <ion-label><p class="list_int">{{item.date.getDate()}}/{{item.date.getMonth()+1}}/{{item.date.getFullYear()}}</p></ion-label>
        <ion-label style="max-width:45%">{{item.category}}</ion-label>
        </div>
        <div class = "partoflistsmall2">
        <ion-label style="min-width:45px; margin-right:8px;">{{item.cost}} {{currency}}</ion-label>
          <ion-button @click="deleteExpense(item)" fill="clear">
          <ion-icon :icon="closeCircleOutline">
          </ion-icon></ion-button>
        </div>
      </div>
      <hr v-if="index < (all_exp.length - 1)">
      </div>
      </ion-card>


</div>
<div v-if="all_exp.length==0" class="middle">
<p>No expenses this month so far!</p>
</div>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
  <div style = "display:flex;">
          <ion-fab-button href="/past" style="margin-right:8px">
        <ion-icon :icon="calendarClearOutline"></ion-icon>
      </ion-fab-button>

          <ion-fab-button href="/addexpense" side="left">
        <ion-icon :icon="add"></ion-icon>
      </ion-fab-button>
</div>
    </ion-fab>


      <div style="margin-bottom:100px"></div>

    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { useRouter } from 'vue-router';
import { IonIcon,IonButtons,IonButton, IonContent,IonFab,IonFabButton, IonHeader, IonPage, IonLabel, IonItemDivider, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle } from '@ionic/vue';
import { model } from '../data/model'
import { defineComponent } from 'vue';
import {add, closeCircleOutline, calendarClearOutline}from 'ionicons/icons';

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
      const isInit = await model.init()
      if (!isInit){
        this.router.replace({ path: '/settings/true' })
      }
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
    IonLabel,
    IonItemDivider,
    IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle,IonIcon, IonButtons,IonButton

  },
  setup() {
    const router = useRouter();
    return {add, closeCircleOutline,calendarClearOutline,router}
  }
});
</script>
