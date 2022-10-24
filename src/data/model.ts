import { Storage } from '@ionic/storage';

export interface Budget{
    type: number,
    budget: number
}

export interface Expense{
    total_sum: number,
    max_budget: number,
    remains: number,
    budget_as_today: number
}

export interface SingleExpense{
    cost: number,
    date: Date,
    category: string
}

export interface HomePageLocalizer{
    x: string
}

export interface ExpenseWithDate{
    total_sum: number,
    remains: number,
    date: string
}

interface GeneralSettings{
    currency: string,
    language: string,
    categories: string[],
    date: Date,
    budget: Budget
}

interface MonthStorage{
    tot_spending: number,
    daily_budget: number,
    month: number,
    year: number,
    spending: SingleExpense[]
}

function round_n(n_: number){
    return Math.round(n_ * 100) / 100
}

function getDaysInMonth( month: number, year: number) {
    return new Date(year, month, 0).getDate();
}

function get_daily_budget(budget:Budget, month: number, year: number):number{
    if (budget.type == 1){
        return budget.budget
    } else {
        return round_n(budget.budget / getDaysInMonth(month, year))
    }
    return 1
}

function getFormattedDate(date:Date, language: string): string{
    if (language=='en'){
        const n = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        return n[date.getMonth()] + " " + date.getFullYear()
    } else {
        const n = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]
        return n[date.getMonth()] + " " + date.getFullYear()
    }
}

export const model: any = {
    isInit: false,
    storage: new Storage,
    settings: undefined,
    currentMonth: undefined,
    weekly_exp: undefined,
    monthly_exp: undefined,

    async load_month(month: number, year: number, doNotCreate = false):Promise<MonthStorage | undefined>{
        const key = month + "_" + year 
        let m: MonthStorage = await this.storage.get(key)
        if (m == undefined){
            if (doNotCreate){
                return undefined
            }
            m = {
                tot_spending:0,
                daily_budget: get_daily_budget(this.settings.budget, month, year),
                month: month,
                year: year,
                spending: []
            },
            await this.storage.set(key, m)
        } else {
            m.tot_spending = Number(m.tot_spending)
            m.daily_budget = Number(m.daily_budget)
        }
        return m
    }, 

    async load_current_month():Promise<MonthStorage>{
        if (this.currentMonth != undefined){
            return this.currentMonth
        } else {
            return await this.load_month(this.settings.date.getMonth(), this.settings.date.getFullYear() )
        }
    },

    async save_month(month: MonthStorage){
        const key = month.month + "_" + month.year 
        await this.storage.set(key, month)
    },


    //Returns false if it is first time
    async init(): Promise<boolean>{
        if (this.isInit){
            return true;
        }
        this.isInit = true
        await this.storage.create();
        this.settings = await this.storage.get('settings');
        if (this.settings == undefined){
            this.settings = {
                currency: "€",
                language: "en",
                categories: [
                    "Rent 🏠", "Grocery 🍴", "Eating out 🌮", "Drinks 🍸", "Hobbies 🥏", "Travel 🚞", 
                    "Clothes 👖", "Car expenses 🚗", "Bills 📄", "Subscriptions 🖥", "Other expenses 📁"
                ],
                date: new Date(Date.now()),
                budget: {
                    type: 0,
                    budget: 0
                }
            }
            await this.storage.set('settings', this.settings)
            return false
        } else {
            this.settings.date = new Date(Date.now())
            return true
        }
        
    },


    //Settings
    set_budget: async function(type: number, budget: number){
        this.settings.budget.type = type 
        this.settings.budget.budget = budget 
        this.storage.set('settings', this.settings)
        //Must update last month budget!
        const m: MonthStorage = await this.load_current_month()
        m.daily_budget = get_daily_budget(this.settings.budget, m.month, m.year)
        await this.save_month(m)
    },

    get_budget: function(): Budget{
        return this.settings.budget 
    },

    get_categories: function(): string[]{
        return this.settings.categories
    },

    add_category: function(category: string): boolean{
        console.log(this.settings.categories)
        if (this.settings.categories.includes(category)){
            return false
        }
        this.settings.categories.push(category)
        console.log(this.settings.categories)
        console.log("Added")
        this.storage.set('settings', this.settings)
        return true
    },

    remove_category: function(category: string){
        this.settings.categories = this.settings.categories.filter((x:string) => x != category)
        this.storage.set('settings', this.settings)
    },

    //Dollars or euros or whathever
    get_default_value():string{
        return this.settings.currency
    },
    set_default_value(value: string){
        this.settings.currency = value
        this.storage.set('settings', this.settings)
    },

    //Expenses:
    async get_past_monthly_expenses(n_months: number): Promise<ExpenseWithDate[]>{
        const date = new Date(Date.now())
        const r: ExpenseWithDate[] = []
        for (let i=0; i<n_months; i++){
            const m = await this.load_month(date.getMonth(), date.getFullYear(), true)
            if (m == undefined){
                break;
            }

            const budget = m.daily_budget * getDaysInMonth(date.getMonth(), date.getFullYear())
            r.push({
                total_sum: round_n(m.tot_spending),
                remains: round_n(budget - m.tot_spending),
                date: getFormattedDate(date, this.settings.language)
            })
            date.setMonth(date.getMonth() - 1);
        }
        return r
    },

    async get_expenses_by_category(): Promise<any[]>{
        const m = await this.load_current_month()
        const d:any = {}
        m.spending.forEach((element:SingleExpense) => {
            if (d[element.category]){
                d[element.category] += Number(element.cost)
            } else {
                d[element.category] = Number(element.cost)
            }
        });
        console.log(d)
        const a:any = []
        for (const property in d) {
            a.push([property, d[property]])
        }
        a.sort((a: any, b: any) =>b[1]-a[1] )
        return a
    },

    async get_all_month_expenses(): Promise<SingleExpense[]>{
        const m = await this.load_current_month()
        m.spending.forEach((s:any)=>{s.cost = Number(s.cost)})
        return m.spending
    },

    get_empty_expense: function(): Expense {
        const exp: Expense = {
            total_sum: 0,
            max_budget: 0,
            remains: 0,
            budget_as_today: 0
        }
        return exp 
    },

    get_monthly_expense: async function(): Promise<Expense> {
        if (this.monthly_exp != undefined){
            return this.monthly_exp
        }
        const m = await this.load_current_month()
        const exp: Expense = {
            total_sum: round_n(m.tot_spending),
            max_budget: round_n(m.daily_budget * getDaysInMonth(m.month, m.year)),
            remains: round_n((m.daily_budget*this.settings.date.getDate()) - m.tot_spending),
            budget_as_today: (m.daily_budget*this.settings.date.getDate())
        }
        this.monthly_exp = exp
        return exp 
    },

    get_weekly_expense: async function(): Promise<Expense> {
        if (this.weekly_exp != undefined){
            return this.weekly_exp
        }
        const m = await this.load_current_month()
        let weekSpending = 0
        const today = new Date(Date.now())
        let dayOfWeek = (today).getDay()-1;
        if (dayOfWeek == -1){
            dayOfWeek = 6
        }
        const targetDate = new Date(today.getFullYear(),today.getMonth(), today.getDate()-dayOfWeek)
    

        m.spending.forEach((s: SingleExpense) => {
            if (s.date.getTime() >= targetDate.getTime()){
                weekSpending += Number(s.cost)
            }
        })
        if (targetDate.getMonth() < m.month){
            const old_m = await this.load_month(targetDate.getMonth(), targetDate.getFullYear())
            old_m.spending.forEach((s: SingleExpense) => {
                if (s.date.getTime() >= targetDate.getTime()){
                    weekSpending += Number(s.cost)
                }
            })
        }
        const exp: Expense = {
            total_sum: round_n(weekSpending),
            max_budget: round_n(m.daily_budget * 7),
            remains: round_n((m.daily_budget*(dayOfWeek+1)) - weekSpending),
            budget_as_today: round_n(m.daily_budget*(dayOfWeek+1))
        }
        this.weekly_exp = exp
        return exp 
    },

    async add_expense(amount: number, category: string){
        const m = await this.load_current_month()
        m.tot_spending =  Number(m.tot_spending) + Number(amount)
        m.spending.push(
            {
                cost: amount,
                date: this.settings.date,
                category: category
            }
        ) 
        await this.save_month(m)
        if (this.weekly_exp != undefined){
            this.weekly_exp.total_sum += amount 
            this.weekly_exp.remains -= amount 
        }
        if (this.monthly_exp != undefined){
            this.monthly_exp.total_sum += amount 
            this.monthly_exp.remains -= amount 
        }
    },

    async remove_expense(expense: SingleExpense){
        this.weekly_exp = undefined
        this.monthly_exp = undefined 
        const m = await this.load_current_month()
        m.tot_spending -= Number(expense.cost)
        for (let i=0; i<m.spending.length; i++){
            if (m.spending[i].cost == expense.cost && m.spending[i].date.getTime() == expense.date.getTime() && m.spending[i].category==expense.category){
                m.spending.splice(i, 1)
                break
            }
        }
        await this.save_month(m)
    }

}
