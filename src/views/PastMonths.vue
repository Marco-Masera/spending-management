<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
      <ion-buttons slot="start">
          <ion-back-button :text="getBackButtonText()" default-href="/"></ion-back-button>
        </ion-buttons>
        <ion-title>Past Months</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content :fullscreen="true">
      
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Past Months</ion-title>
        </ion-toolbar>
      </ion-header>
      
      <ion-card v-for="month in months" :key="month" @click="goToPast(month.month, month.year)">
        <ion-card-header>
          <ion-card-title>{{month.total_sum}} {{currency}}</ion-card-title>
          <ion-card-subtitle>{{month.date}}</ion-card-subtitle>
        </ion-card-header>

        <div style="display:flex; flex-direction: row; align-items: stretch; justify-content: space-between">
          <ion-card-content v-if="month.remains >= 0" style="color:green;">
            {{month.remains.toFixed(2)}} {{currency}} saved!
          </ion-card-content>
          <ion-card-content v-if="month.remains < 0" style="color:var(--ion-color-danger);">
            {{(-month.remains).toFixed(2)}} {{currency}} overspent
          </ion-card-content>
          <ion-card-content style="text-align:right; font-size: smaller; padding-right: 24px;">
            Tap to open month details
          </ion-card-content>
        </div>
      </ion-card>

    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { useRouter } from 'vue-router';
import { IonButtons,IonContent,IonBackButton , IonHeader, IonPage, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle } from '@ionic/vue';
import { model } from '../data/model'
import { defineComponent } from 'vue';
import { closeCircle } from 'ionicons/icons';

export default defineComponent({
  name: 'HomePage',
  setup(){
    const router = useRouter();
    return { router, closeCircle };
  },
  data() {
    return {
      months: [],
      currency: "",
      getBackButtonText: () => {
        const win = window as any;
        const mode = win && win.Ionic && win.Ionic.mode;
        return mode === 'ios' ? 'Inbox' : '';
      }
    }
  },
  methods: {
    goToPast(m: number, y: number){
      this.router.replace({ path: '/pastmonth/'+m.toString() + "/" + y.toString() })
    },
    async init(){
      await model.init()
      this.$data.currency = model.get_default_value()
      model.get_past_monthly_expenses(36).then((r:any)=>{this.$data.months = r})
    }
  },
  created(){
    this.init()
  },
  components: {
IonContent,IonButtons,IonBackButton , IonHeader, IonPage, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle 
  },
});
</script>
