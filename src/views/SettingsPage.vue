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
    <ion-item class="floating-input-item" style="width:60%">
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
<ion-button :disabled="budget.budget==0"  @click="saveBudget" style="width:200px">Save budget</ion-button>
</div>

<div class="dividercontainer">
       <ion-item-divider class="withtopborder">
        <p class="weightened">
        Default currency
        </p>
      </ion-item-divider>
 </div>


<div class="amountdiv" style="margin-top:14px; margin-bottom:24px">
    <ion-item class="floating-input-item" style="width:60%">
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

    <ion-chip @click="openAddPopover($event)" :color=colors[categories.length%5]>
        Add new
    </ion-chip>
</div>
</div>

<div class="dividercontainer" style="margin-top: 18px;">
       <ion-item-divider class="withtopborder">
        <p class="weightened">
        Recurring expenses
        </p>
      </ion-item-divider>
 </div>

<p class="weightened recurring-manager__subtitle">
  {{
    showAllRecurring
      ? 'Showing all non-deleted recurring expenses.'
      : 'Showing currently active recurring expenses.'
  }}
</p>

<div class="middle recurring-manager__actions">
  <ion-button
    :fill="showAllRecurring ? 'outline' : 'solid'"
    @click="setRecurringExpenseView(false)"
  >
    Active
  </ion-button>
  <ion-button
    :fill="showAllRecurring ? 'solid' : 'outline'"
    @click="setRecurringExpenseView(true)"
  >
    View all
  </ion-button>
  <ion-button @click="openCreateRecurringExpenseForm">New recurring expense</ion-button>
</div>

<div class="amountdiv recurring-manager__listwrap">
  <RecurringExpenseList
    :items="recurringExpenses"
    :loading="isRecurringLoading"
    :empty-message="showAllRecurring ? 'No recurring expenses yet.' : 'No active recurring expenses right now.'"
    @edit="openEditRecurringExpenseForm"
    @delete="confirmDeleteRecurringExpense"
  />
</div>

<div class="dividercontainer">
       <ion-item-divider class="withtopborder">
        <p class="weightened">
        Your data
        </p>
      </ion-item-divider>
 </div>
  <div class="middle data-buttons" style="margin-top: 24px;">
   <ion-button @click="export_data()">Export data</ion-button>
   <ion-button @click="import_data()">Import data</ion-button>
   <ion-button @click="import_legacy_data()">Import legacy</ion-button>
   <ion-button color="danger" @click="clear_data()">Clear data</ion-button>
  </div>

 <div class="dividercontainer" style="margin-top: 18px;">
       <ion-item-divider class="withtopborder">
        <p class="weightened">
        CouchDB sync
        </p>
      </ion-item-divider>
 </div>

 <div class="amountdiv" style="margin-top:14px; margin-bottom:12px">
    <ion-item class="floating-input-item" style="width:85%">
      <ion-label position="floating">CouchDB URL:</ion-label>
      <ion-input
        type="text"
        v-model="couchdbURL"
        :placeholder="defaultCouchdbUrl || 'https://user:pass@host:5984/db'"
      ></ion-input>
    </ion-item>
  </div>

  <div class="middle" style="height:45px">
    <ion-button @click="saveCouchdbURL">Save sync URL</ion-button>
  </div>

  <div class="dividercontainer" style="margin-top: 18px;">
       <ion-item-divider class="withtopborder">
        <p class="weightened">
        Logs
        </p>
      </ion-item-divider>
 </div>

 <div class="middle" style="height:45px">
   <ion-button @click="export_logs">Export logs</ion-button>
 </div>

   <div style="margin-bottom:100px"></div>


<ion-popover :is-open="isAdding" :event="popoverEvent" @didDismiss="isAdding = false" style="--offset-y: -220px" >
    <ion-content class="ion-padding"><p class="weightened">Add new category</p></ion-content>
        <div style="margin-left:14px; margin-bottom:10px">
          <ion-item class="floating-input-item" style="width:80%">
            <ion-label position="floating">Name:</ion-label>
            <ion-input v-model="newCatName" placeholder="category"></ion-input>
          </ion-item>
        </div>

    <ion-button :disabled="newCatName==''" @click="addC()" style="padding-left:10px; padding-right:10px">Add</ion-button>
    <ion-button @click="isAdding=false"  style="padding-left:10px; padding-right:10px; margin-bottom:12px">Cancel</ion-button>
</ion-popover>

<RecurringExpenseForm
  :open="isRecurringFormOpen"
  :mode="recurringFormMode"
  :expense="selectedRecurringExpense"
  :categories="categories"
  :saving="isRecurringSaving"
  @cancel="closeRecurringExpenseForm"
  @save="saveRecurringExpense"
/>

    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { useRouter } from 'vue-router';
import { alertController , IonIcon, IonChip, IonButtons, IonButton, IonPopover, IonRadio, IonRadioGroup, IonContent,IonBackButton, toastController, IonInput , IonHeader, IonPage, IonItem, IonLabel, IonList, IonItemDivider, IonTitle, IonToolbar } from '@ionic/vue';
import { model, type AddRecurringExpenseInput, type RecurringExpense } from '../data/model'
import { defineComponent } from 'vue';
import { closeCircle } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { LOG_FILE_PATH } from '@/lib/logger'
import { logger } from '@/lib/logger'
import { DEFAULT_COUCHDB_URL } from '@/data/modelDefaults'
import RecurringExpenseForm from '@/components/settings/RecurringExpenseForm.vue'
import RecurringExpenseList from '@/components/settings/RecurringExpenseList.vue'

export default defineComponent({
  name: 'SettingsPage',
  setup(){
    const router = useRouter();
    return { router, closeCircle };
  },
  data() {
    return {
      currency: "",
      couchdbURL: "",
      defaultCouchdbUrl: DEFAULT_COUCHDB_URL,
      isfirst: false,
      categories: [''],
      colors: ["primary", "secondary", "tertiary", "success", "warning"],
      isAdding: false,
      popoverEvent: undefined as Event | undefined,
      newCatName: "",
      budget: {budget:0, type:0},
      budget_time: 'monthly',
      recurringExpenses: [] as RecurringExpense[],
      showAllRecurring: false,
      isRecurringLoading: false,
      isRecurringFormOpen: false,
      isRecurringSaving: false,
      recurringFormMode: 'create' as 'create' | 'edit-end',
      selectedRecurringExpense: null as RecurringExpense | null,
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
    async loadRecurringExpenses(){
      this.$data.isRecurringLoading = true
      try {
        const now = new Date(Date.now())
        this.$data.recurringExpenses = this.$data.showAllRecurring
          ? await model.list_all_recurring_expenses()
          : await model.list_recurring_expenses({ start: now, end: now })
      } catch {
        this.$data.recurringExpenses = []
        this.presentToast('Could not load recurring expenses', 2500)
      } finally {
        this.$data.isRecurringLoading = false
      }
    },
    async setRecurringExpenseView(showAll: boolean){
      if (this.$data.showAllRecurring === showAll && this.$data.recurringExpenses.length > 0){
        return
      }
      this.$data.showAllRecurring = showAll
      await this.loadRecurringExpenses()
    },
    openCreateRecurringExpenseForm(){
      this.$data.recurringFormMode = 'create'
      this.$data.selectedRecurringExpense = null
      this.$data.isRecurringFormOpen = true
    },
    openEditRecurringExpenseForm(expense: RecurringExpense){
      this.$data.recurringFormMode = 'edit-end'
      this.$data.selectedRecurringExpense = expense
      this.$data.isRecurringFormOpen = true
    },
    async confirmDeleteRecurringExpense(expense: RecurringExpense){
      const alert = await alertController.create({
        header: 'Delete recurring expense?',
        message: `Delete the recurring expense for ${expense.category}? This cannot be undone.`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Delete',
            role: 'destructive',
            handler: () => {
              this.deleteRecurringExpense(expense)
            },
          },
        ],
      })

      await alert.present()
      await alert.onDidDismiss()
    },
    async deleteRecurringExpense(expense: RecurringExpense){
      if (this.$data.isRecurringSaving) {
        return
      }

      this.$data.isRecurringSaving = true
      try {
        const removed = await model.remove_recurring_expense(expense._id)
        if (!removed) {
          this.presentToast('Could not delete recurring expense', 2500)
          return
        }

        if (this.$data.selectedRecurringExpense?._id === expense._id) {
          this.closeRecurringExpenseForm()
        }

        this.presentToast('Recurring expense deleted')
        await this.loadRecurringExpenses()
      } catch {
        this.presentToast('Could not delete recurring expense', 2500)
      } finally {
        this.$data.isRecurringSaving = false
      }
    },
    closeRecurringExpenseForm(){
      this.$data.isRecurringFormOpen = false
      this.$data.selectedRecurringExpense = null
      this.$data.isRecurringSaving = false
    },
    async saveRecurringExpense(payload: AddRecurringExpenseInput | { endDate: Date | null }){
      if (this.$data.isRecurringSaving){
        return
      }

      this.$data.isRecurringSaving = true
      try {
        let success = false
        if (this.$data.recurringFormMode === 'create'){
          success = await model.add_recurring_expense(payload as AddRecurringExpenseInput)
        } else if (this.$data.selectedRecurringExpense) {
          success = await model.update_recurring_expense_end_date(
            this.$data.selectedRecurringExpense._id,
            (payload as { endDate: Date | null }).endDate,
          )
        }

        if (!success){
          this.presentToast(
            this.$data.recurringFormMode === 'create'
              ? 'Could not create recurring expense'
              : 'Could not update recurring expense',
            2500,
          )
          return
        }

        this.presentToast(
          this.$data.recurringFormMode === 'create'
            ? 'Recurring expense created'
            : 'Recurring expense updated',
        )
        this.closeRecurringExpenseForm()
        await this.loadRecurringExpenses()
      } catch {
        this.presentToast(
          this.$data.recurringFormMode === 'create'
            ? 'Could not create recurring expense'
            : 'Could not update recurring expense',
          2500,
        )
      } finally {
        this.$data.isRecurringSaving = false
      }
    },
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
                }).catch(() => {
                  this.presentToast("Could not import data :(", 5000)
                })
              },
            },
          ],
        });

        await alert.present();

        await alert.onDidDismiss();
      

    },
    async import_legacy_data(){
      logger.info('[settings] import legacy clicked')
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
                model.import_legacy_data().then(async (result: boolean) =>{
                  logger.info('[settings] import legacy finished', { result })
                  if (result){
                    this.presentToast("Data imported correctly", 5000)
                    await this.init()
                  } else {
                    this.presentToast("Could not import data", 5000)
                  }
                }).catch(() => {
                  logger.warn('[settings] import legacy threw')
                  this.presentToast("Could not import data :(", 5000)
                })
              },
            },
          ],
        });

        await alert.present();

        await alert.onDidDismiss();
    },
    async clear_data(){
      const alert = await alertController.create({
        header: 'Clear all data?',
        message: 'This will delete all local app data and reset the app to defaults. This cannot be undone.',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              console.log(".")
            },
          },
          {
            text: 'Clear data',
            role: 'destructive',
            handler: () => {
              this.doClearData()
            },
          },
        ],
      });

      await alert.present();
      await alert.onDidDismiss();
    },
    async doClearData(){
      try {
        await model.clear_data()
        // Multiple pages only init on created(); a full reload avoids stale cached state.
        window.location.reload()
      } catch {
        this.presentToast('Could not clear data', 2500)
      }
    },
    updateCurrency(){
      model.set_default_value(this.$data.currency)
      this.presentToast("Currency updated")
    },
    async saveCouchdbURL(){
      try{
        await model.set_couchdb_url(this.$data.couchdbURL)
        this.presentToast("Sync URL updated")
      } catch {
        // Never error the user for sync failures.
        this.presentToast("Sync URL updated")
      }
    },
    async export_logs(){
      if (Capacitor.getPlatform() !== 'android'){
        this.presentToast('Export logs is only available on Android', 2500)
        return
      }

      try {
        // If the file doesn't exist yet, create it.
        try {
          await Filesystem.stat({ directory: Directory.Data, path: LOG_FILE_PATH })
        } catch {
          await Filesystem.mkdir({ directory: Directory.Data, path: 'logs', recursive: true })
          await Filesystem.writeFile({
            directory: Directory.Data,
            path: LOG_FILE_PATH,
            data: `${new Date().toISOString()} INFO [log] created via export\n`,
            encoding: Encoding.UTF8,
          })
        }

        const uriRes: any = await Filesystem.getUri({ directory: Directory.Data, path: LOG_FILE_PATH })
        const uri = uriRes?.uri
        if (!uri) throw new Error('missing log uri')

        await Share.share({
          title: 'app.log',
          url: uri,
          dialogTitle: 'Save log file',
        })
        this.presentToast('Log exported', 1500)
      } catch {
        this.presentToast('Could not export logs', 2500)
      }
    },
    onInputClick(nativeEl:any){
      const t = nativeEl?.target
      if (!t) return
      try {
        t.autofocus = true
      } catch {
        // ignore
      }
      if (typeof t.select === 'function') {
        t.select()
      }
    },
    async init(){
      await model.init()
      this.$data.currency = model.get_default_value()
      const savedUrl = model.get_couchdb_url ? model.get_couchdb_url() : ""
      this.$data.couchdbURL = savedUrl || this.$data.defaultCouchdbUrl || ""
      this.$data.categories = model.get_categories()
      this.$data.budget = model.get_budget()
      if (this.$data.budget.type != 0){
        this.$data.budget_time = "daily"
      }
      if (this.$route.params.firsttime == "true"){
        console.log("t")
          this.$data.isfirst = true
      }
      await this.loadRecurringExpenses()
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
    IonButton,IonButtons,IonLabel, IonChip, IonIcon,IonList, IonItem, IonItemDivider,IonPopover,
    RecurringExpenseForm,
    RecurringExpenseList,
  },
  created(){
    this.init()
  }
});
</script>

<style scoped>
.data-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.data-buttons ion-button {
  margin: 0;
  --padding-start: 10px;
  --padding-end: 10px;
  white-space: nowrap;
}

.recurring-manager__title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ion-color-dark);
}

.recurring-manager__subtitle {
  margin-top: 18px;
  margin-bottom: 0;
}

.recurring-manager__actions {
  margin-top: 18px;
  gap: 10px;
  flex-wrap: wrap;
}

.recurring-manager__listwrap {
  margin-top: 18px;
  margin-bottom: 8px;
}

@media (max-width: 640px) {
  .recurring-manager__actions {
    height: auto;
  }
}
</style>
