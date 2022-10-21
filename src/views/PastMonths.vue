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
      
      <ion-card v-for="month in months" :key="month">
        <ion-card-header>
          <ion-card-title>{{month.total_sum}} $</ion-card-title>
          <ion-card-subtitle>{{month.date}}</ion-card-subtitle>
        </ion-card-header>

        <ion-card-content v-if="month.remains >= 0" style="color:green;">
          {{month.remains}} $ saved!
        </ion-card-content>
        <ion-card-content v-if="month.remains < 0" style="color:red;">
          {{-month.remains}} $ overspent
        </ion-card-content>
      </ion-card>

    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { useRouter } from 'vue-router';
import { IonContent,IonBackButton, toastController , IonHeader, IonPage, IonItem, IonLabel, IonList, IonItemDivider, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle } from '@ionic/vue';
import { model } from '../data/model'
import { defineComponent } from 'vue';
import { closeCircle } from 'ionicons/icons';
import { getMessages } from '@/data/messages';

export default defineComponent({
  name: 'HomePage',
  setup(){
    const router = useRouter();
    return { router, closeCircle };
  },
  data() {
    return {
      months: model.get_past_monthly_expenses(36),
      getBackButtonText: () => {
        const win = window as any;
        const mode = win && win.Ionic && win.Ionic.mode;
        return mode === 'ios' ? 'Inbox' : '';
      }
    }
  },
  methods: {
  },
  components: {
    IonBackButton,
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar
  },
});
</script>
