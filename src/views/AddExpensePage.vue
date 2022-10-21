<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
      <ion-buttons slot="start">
          <ion-back-button :text="getBackButtonText()" default-href="/"></ion-back-button>
        </ion-buttons>
        <ion-title>Add expense</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content :fullscreen="true">
      
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Add Expense</ion-title>
        </ion-toolbar>
      </ion-header>
      

    <ion-item>
      <ion-label>Ampunt</ion-label>
      <ion-input @click="onInputClick($event)" type="number" v-model="amount" placeholder="0.00 $"></ion-input>
    </ion-item>

    <ion-item-divider>
        <ion-label>
            Category
        </ion-label>
    </ion-item-divider>


    <ion-chip v-for="(item, index) in categories" 
    :key="item"
    :color=colors[index%5]
    :outline="selectedCategory==item"
    @click="selectedCategory = item"
    >
        {{item}}
    </ion-chip>
    <ion-chip @click="isAdding=true" :color=colors[categories.length%5]>
        Add new
        <ion-icon :icon="add"></ion-icon>
    </ion-chip>


    <ion-popover :is-open="isAdding" :event="event" @didDismiss="isAdding = false">
        <ion-content class="ion-padding">Add new category</ion-content>
        <ion-item>
            <ion-label>Name</ion-label>
            <ion-input v-model="newCatName" placeholder="category"></ion-input>
        </ion-item>
        <ion-button :disabled="newCatName==''" @click="addC()">Add</ion-button>
        <ion-button @click="isAdding=false">Cancel</ion-button>
    </ion-popover>
    

    <ion-button :disabled="selectedCategory=='' || amount==0" @click="addExp()">Insert</ion-button>
      
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { useRouter } from 'vue-router';
import { IonIcon,IonPopover, IonChip, IonButton, IonButtons, IonContent,IonBackButton, toastController, IonInput , IonHeader, IonPage, IonItem, IonLabel, IonItemDivider, IonTitle, IonToolbar } from '@ionic/vue';
import { model } from '../data/model'
import { add } from 'ionicons/icons';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'HomePage',
  setup(){
    const router = useRouter();
    return { router, add };
  },
  data() {
    return {
      categories: [''],
      colors: ["primary", "secondary", "tertiary", "success", "warning"],
      selectedCategory: "",
      isAdding: false,
      newCatName: "",
      amount: 0,
      getBackButtonText: () => {
        const win = window as any;
        const mode = win && win.Ionic && win.Ionic.mode;
        return mode === 'ios' ? 'Inbox' : '';
      }
    }
  },
  methods: {
    onInputClick(nativeEl:any){
      nativeEl.target.autofocus=true;
      nativeEl.target.select();
    },
    async init(){
      await model.init()
      this.$data.categories = model.get_categories()
    },
    async addExp(){
        await model.add_expense(this.$data.amount, this.$data.selectedCategory)
        this.router.replace({ path: '/home' })
    },
    addC(){
        if (model.add_category(this.$data.newCatName)){
            this.$data.categories.push(this.$data.newCatName)
        } else {
            this.presentToast("Categoria già esistente")
        }
        this.$data.isAdding = false
    },
    async presentToast(text: string) {
        const toast = await toastController.create({
          message: text,
          duration: 1500,
          position: 'bottom'
        });
        await toast.present();
      },
  },
  created(){
    this.init()
  },
  components: {
    IonBackButton,
    IonContent,
    IonInput,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonPopover, IonButton, IonChip, IonItem, IonLabel, IonButtons, IonItemDivider,IonIcon
  },
});
</script>
