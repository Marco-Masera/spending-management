<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
      <ion-buttons slot="start">
          <ion-back-button :text="getBackButtonText()" default-href="/"></ion-back-button>
        </ion-buttons>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content :fullscreen="true">
      
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Settings</ion-title>
        </ion-toolbar>
      </ion-header>
      

<div class="dividercontainer">
       <ion-item-divider class="withtopborder">
        <p class="weightened">
        Choose your budget
        </p>
      </ion-item-divider>
 </div>

    <div class="amountdiv">
    <ion-item style="width:60%">
      <ion-label position="floating">Your budget:</ion-label>
      <ion-input @click="onInputClick($event)" type="number" v-model="budget.budget" placeholder="0.00 $"></ion-input>
    </ion-item>
    </div>

<p class="weightened" style="font-weight:350; margin-top:54px">
  Budget period:
</p>
<div class="dividercontainer">
    <ion-list>
    <ion-radio-group value="monthly" v-model="budget_time">
      <ion-item>
        <ion-label>Monthly</ion-label>
        <ion-radio slot="end" value="monthly"></ion-radio>
      </ion-item>

      <ion-item>
        <ion-label>Daily</ion-label>
        <ion-radio slot="end" value="daily"></ion-radio>
      </ion-item>
    </ion-radio-group>
  </ion-list>
</div>


<p v-if="!isfirst" class="weightened" style="font-weight:350;">
  New budget will be applied to current month.
</p>
<div class="middle" style="height:45px">
<ion-button :disabled="budget==0"  @click="saveBudget" style="width:200px">Save budget</ion-button>
</div>

<div class="dividercontainer">
       <ion-item-divider class="withtopborder">
        <p class="weightened">
        Default currency
        </p>
      </ion-item-divider>
 </div>


<div class="amountdiv" style="margin-top:14px; margin-bottom:24px">
    <ion-item style="width:60%">
      <ion-label position="floating">Currency:</ion-label>
      <ion-input type="text" v-model="currency" placeholder=""></ion-input>
    </ion-item>
</div>

<div class="middle" style="height:45px">
<ion-button @click="updateCurrency">Update default currency</ion-button>
</div>



<div class="dividercontainer">
       <ion-item-divider class="withtopborder">
        <p class="weightened">
        Categories
        </p>
      </ion-item-divider>
 </div>

<div style="margin-left:20px; margin-right:20px">
<div class="chipcontainer" style="margin-top:24px">
    <ion-chip v-for="(item, index) in categories" 
    :key="item"
    :color=colors[index%5]
    >
        <p style="max-width:90%">{{item}}</p>
        <ion-icon :icon="closeCircle" @click="deleteC(item)"></ion-icon>
    </ion-chip>

    <ion-chip @click="isAdding=true" :color=colors[categories.length%5]>
        Add new
    </ion-chip>
</div>
</div>

<div class="dividercontainer">
       <ion-item-divider class="withtopborder">
        <p class="weightened">
        Your data
        </p>
      </ion-item-divider>
 </div>
 <div class="middle" style = "margin-top: 24px;">
  <ion-button @click="export_data()" style="padding-left:10px; padding-right:10px">Export data</ion-button>
  <ion-button @click="import_data()" style="padding-left:10px; padding-right:10px">Import data</ion-button>
</div>

 <div style="margin-bottom:100px"></div>


<ion-popover :is-open="isAdding" :event="event" @didDismiss="isAdding = false" style="--offset-y: -220px" >
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

    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { useRouter } from 'vue-router';
import { alertController , IonIcon, IonChip, IonButtons, IonButton, IonPopover, IonRadio, IonRadioGroup, IonContent,IonBackButton, toastController, IonInput , IonHeader, IonPage, IonItem, IonLabel, IonList, IonItemDivider, IonTitle, IonToolbar } from '@ionic/vue';
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
      currency: "",
      isfirst: false,
      categories: [''],
      colors: ["primary", "secondary", "tertiary", "success", "warning"],
      isAdding: false,
      newCatName: "",
      budget: {budget:0, type:0},
      budget_time: 'monthly',
      getBackButtonText: () => {
        const win = window as any;
        const mode = win && win.Ionic && win.Ionic.mode;
        return mode === 'ios' ? 'Inbox' : '';
      }
    }
  },
  methods: {
    export_data(){
      model.export_data().then( (result: boolean) =>{
          if (result){this.presentToast("Data exported correctly")} else {this.presentToast("Could not export data")}
      })
    },
    async import_data(){
      const alert = await alertController.create({
          header: 'Warning: imported data will overwrite local app data. Continue?',
          buttons: [
            {
              text: 'Cancel',
              role: 'cancel',
              handler: () => {
                console.log(".")
              },
            },
            {
              text: 'Continue',
              role: 'confirm',
              handler: () => {
                model.import_data().then( (result: boolean) =>{
                  if (result){this.presentToast("Data imported correctly", 5000)} else {this.presentToast("Could not import data", 5000)}
                }).catch((e:any) => {
                  this.presentToast("Could not import data :(", 5000)
                })
              },
            },
          ],
        });

        await alert.present();

        await alert.onDidDismiss();
      

    },
    updateCurrency(){
      model.set_default_value(this.$data.currency)
      this.presentToast("Currency updated")
    },
    onInputClick(nativeEl:any){
      nativeEl.target.autofocus=true;
      nativeEl.target.select();
    },
    async init(){
      await model.init()
      this.$data.currency = model.get_default_value()
      this.$data.categories = model.get_categories()
      this.$data.budget = model.get_budget()
      if (this.$data.budget.type != 0){
        this.$data.budget_time = "daily"
      }
      if (this.$route.params.firsttime == "true"){
        console.log("t")
          this.$data.isfirst = true
      }
    },
    async saveBudget(){
        let x = 0
        if (this.$data.budget_time == 'daily'){
            x = 1
        }
        await model.set_budget(x,this.$data.budget.budget)
        this.router.replace({ path: '/home' })
    },
    deleteC(item:string){
        model.remove_category(item)
        this.$data.categories = this.$data.categories.filter(function(value:any){ 
        return value != item;
    });
    },
    addC(){
        if (model.add_category(this.$data.newCatName)){
            this.$data.categories = model.get_categories()
        } else {
            this.presentToast("Category already exists")
        }
        this.$data.isAdding = false
    },
    async presentToast(text: string, duration = 1500) {
        const toast = await toastController.create({
          message: text,
          duration: duration,
          position: 'bottom'
        });
        await toast.present();
      },
  },
  components: {
    IonBackButton,
    IonContent,
    IonInput,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonRadio, IonRadioGroup,
    IonButton,IonButtons,IonLabel, IonChip, IonIcon,IonList, IonItem, IonItemDivider,IonPopover
  },
  created(){
    this.init()
  }
});
</script>
