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
      

    <div class="amountdiv">
    <ion-item style="width:60%">
      <ion-label position="floating">Amount:</ion-label>
      <ion-input @click="onInputClick($event)" type="number" v-model="amount" placeholder="0.00"></ion-input>
    </ion-item>
    </div>

    <div class="dividercontainer">
       <ion-item-divider class="withtopborder">
        <p class="weightened">
        Choose a category
        </p>
      </ion-item-divider>
      </div>


<div style="margin-left:20px; margin-right:20px">
<div class="chipcontainer" style="margin-top:24px">
    <ion-chip v-for="(item, index) in categories" 
    :key="item"
    :color=colors[index%5]
    :outline="selectedCategory==item"
    @click="selectedCategory = item"
    class="chip"
    >
        {{item}}
    </ion-chip>
    <ion-chip @click="openAddPopover($event)" :color=colors[categories.length%5] class="chip">
        Add new
        <ion-icon :icon="add"></ion-icon>
    </ion-chip>
</div>
</div>


<ion-popover :is-open="isAdding" :event="popoverEvent" @didDismiss="isAdding = false" style="--offset-y: -220px" >
    <ion-content class="ion-padding"><p class="weightened">Add new category</p></ion-content>
        <div style="margin-left:14px; margin-bottom:10px">
          <ion-item style="width:80%">
            <ion-label position="floating">Name:</ion-label>
            <ion-input v-model="newCatName" placeholder="category"></ion-input>
          </ion-item>
        </div>

    <ion-button :disabled="newCatName==''" @click="addC()" style="padding-left:10px; padding-right:10px">Add</ion-button>
    <ion-button @click="isAdding=false"  style="padding-left:10px; padding-right:10px; margin-bottom:12px">Cancel</ion-button>
</ion-popover>




<ion-fab vertical="bottom" horizontal="end" slot="fixed">
  <ion-fab-button v-show="!(selectedCategory=='' || (amount == undefined || amount==0))" @click="addExp()"
    style="margin-right:12px; margin-bottom:12px">
        <ion-icon :icon="checkmarkOutline"></ion-icon>
  </ion-fab-button>
    
</ion-fab>

 
 <div style="margin-bottom:100px"></div>

    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { useRouter } from 'vue-router';
import { IonIcon,IonPopover, IonChip, IonButton, IonButtons, IonContent,IonBackButton, toastController, IonInput , IonHeader, IonPage, IonItem, IonLabel, IonItemDivider, IonTitle, IonToolbar } from '@ionic/vue';
import { model } from '../data/model'
import { add } from 'ionicons/icons';
import { defineComponent } from 'vue';
import {checkmarkOutline}from 'ionicons/icons';


export default defineComponent({
  name: 'AddExpensePage',
  setup(){
    const router = useRouter();
    return { router, add, checkmarkOutline };
  },
  data() {
    return {
      categories: [''],
      colors: ["primary", "secondary", "tertiary", "success", "warning"],
      selectedCategory: "",
      isAdding: false,
      popoverEvent: undefined as Event | undefined,
      newCatName: "",
      amount: undefined,
      getBackButtonText: () => {
        const win = window as any;
        const mode = win && win.Ionic && win.Ionic.mode;
        return mode === 'ios' ? 'Inbox' : '';
      }
    }
  },
  methods: {
    openAddPopover(ev: Event) {
      this.$data.popoverEvent = ev
      this.$data.isAdding = true
    },
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
            this.$data.categories = model.get_categories()
        } else {
            this.presentToast("Category already exists")
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
