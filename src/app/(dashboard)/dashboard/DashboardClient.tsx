'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { signOut } from '@/app/auth-actions'
import toast from 'react-hot-toast'
import {
  LayoutDashboard,
  ReceiptText,
  PiggyBank,
  LogOut,
  Plus,
  Trash2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Percent,
  ChevronRight,
  Filter,
  CheckCircle2,
  X,
  Pencil,
  Check
} from 'lucide-react'
import * as Icons from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

// Dynamic icon helper
function CategoryIcon({ iconName, className = "h-5 w-5" }: { iconName: string; className?: string }) {
  const IconComponent = (Icons as any)[iconName || 'HelpCircle']
  return IconComponent ? <IconComponent className={className} /> : <Icons.HelpCircle className={className} />
}

interface DashboardClientProps {
  user: any
  initialProfile: any
  initialCategories: any[]
  initialTransactions: any[]
  initialBudgets: any[]
  initialSavingsGoals: any[]
}

export default function DashboardClient({
  user,
  initialProfile,
  initialCategories,
  initialTransactions,
  initialBudgets,
  initialSavingsGoals
}: DashboardClientProps) {
  const router = useRouter()
  const supabase = createClient()

  // App State
  const [profile, setProfile] = useState(initialProfile)
  const [categories] = useState(initialCategories)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [budgets, setBudgets] = useState(initialBudgets)
  const [savingsGoals, setSavingsGoals] = useState(initialSavingsGoals)

  // UI State
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'budgets' | 'savings'>('overview')
  const [isMounted, setIsMounted] = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Form States
  // Transaction Form
  const [txAmount, setTxAmount] = useState('')
  const [txType, setTxType] = useState<'expense' | 'income'>('expense')
  const [txCategory, setTxCategory] = useState('')
  const [txDescription, setTxDescription] = useState('')
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0])
  const [txLoading, setTxLoading] = useState(false)

  // Budget Form
  const [budgetCategory, setBudgetCategory] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetPeriod, setBudgetPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly')
  const [budgetLoading, setBudgetLoading] = useState(false)

  // Edit Budget State
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null)
  const [editBudgetAmount, setEditBudgetAmount] = useState('')

  // Savings Form
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalTargetDate, setGoalTargetDate] = useState('')
  const [goalLoading, setGoalLoading] = useState(false)
  const [contributionAmount, setContributionAmount] = useState<{ [key: string]: string }>({})

  // Transactions Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Budget alert dedup tracker: budgetId -> last alerted state
  const notifiedBudgetsRef = useRef<Map<string, 'safe' | 'warning' | 'over'>>(new Map())

  // Auto-clear notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Set default category when type or category list changes
  useEffect(() => {
    const filtered = categories.filter(c => c.type === txType)
    if (filtered.length > 0) {
      setTxCategory(filtered[0].id)
    }
  }, [txType, categories])

  useEffect(() => {
    if (categories.length > 0 && !budgetCategory) {
      const expenseCats = categories.filter(c => c.type === 'expense')
      if (expenseCats.length > 0) {
        setBudgetCategory(expenseCats[0].id)
      }
    }
  }, [categories, budgetCategory])

  // --- Calculations ---

  // Totals
  const totals = useMemo(() => {
    let income = 0
    let expenses = 0
    transactions.forEach(t => {
      if (t.type === 'income') {
        income += Number(t.amount)
      } else {
        expenses += Number(t.amount)
      }
    })
    return {
      income,
      expenses,
      balance: income - expenses
    }
  }, [transactions])

  // Donut Chart Data: Expenses by Category
  const pieChartData = useMemo(() => {
    const expensesByCategory: { [key: string]: { amount: number; color: string; name: string } } = {}

    transactions
      .filter(t => t.type === 'expense' && t.categories)
      .forEach(t => {
        const cat = t.categories
        if (expensesByCategory[cat.name]) {
          expensesByCategory[cat.name].amount += Number(t.amount)
        } else {
          expensesByCategory[cat.name] = {
            amount: Number(t.amount),
            color: cat.color || '#6B7280',
            name: cat.name
          }
        }
      })

    return Object.values(expensesByCategory).map(item => ({
      name: item.name,
      value: Number(item.amount.toFixed(2)),
      color: item.color
    }))
  }, [transactions])

  // Trend Chart Data (Last 7 Days)
  const trendChartData = useMemo(() => {
    const data = []
    const today = new Date()

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(today.getDate() - i)
      const dateString = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      let income = 0
      let expense = 0

      transactions.forEach(t => {
        const tDate = new Date(t.date).toISOString().split('T')[0]
        if (tDate === dateString) {
          if (t.type === 'income') {
            income += Number(t.amount)
          } else {
            expense += Number(t.amount)
          }
        }
      })

      data.push({
        name: label,
        Income: Number(income.toFixed(2)),
        Expense: Number(expense.toFixed(2))
      })
    }
    return data
  }, [transactions])

  // Category-wise spending for budgets
  const categorySpending = useMemo(() => {
    const spending: { [key: string]: number } = {}
    transactions.forEach(t => {
      if (t.type === 'expense') {
        spending[t.category_id] = (spending[t.category_id] || 0) + Number(t.amount)
      }
    })
    return spending
  }, [transactions])

  // Fire budget alerts once per threshold crossing (placed after categorySpending)
  useEffect(() => {
    if (!isMounted) return
    budgets.forEach((b) => {
      const spent = categorySpending[b.category_id] || 0
      const limit = Number(b.limit_amount)
      if (limit <= 0) return
      const usage = spent / limit
      const catName = b.categories?.name || 'Unknown'

      const currentState: 'safe' | 'warning' | 'over' =
        usage >= 1 ? 'over' : usage >= 0.75 ? 'warning' : 'safe'

      const prevState = notifiedBudgetsRef.current.get(b.id)

      if (prevState !== currentState) {
        if (currentState === 'over') {
          toast.error(`Over budget in ${catName}!`, { id: `over-${b.id}` })
        } else if (currentState === 'warning') {
          toast(`⚠️ Warning: 75%+ budget used in ${catName}`, {
            id: `warn-${b.id}`,
            style: {
              background: '#0F172A',
              color: '#FCD34D',
              border: '1px solid #F59E0B',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              padding: '12px 16px',
            },
          })
        }
        notifiedBudgetsRef.current.set(b.id, currentState)
      }
    })
  }, [budgets, categorySpending, isMounted])

  // Filtered Transactions for List
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.categories?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = typeFilter === 'all' || t.type === typeFilter
      const matchesCategory = categoryFilter === 'all' || t.category_id === categoryFilter

      return matchesSearch && matchesType && matchesCategory
    })
  }, [transactions, searchQuery, typeFilter, categoryFilter])

  // --- Database Mutators ---

  // Add Transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!txAmount || !txCategory || isNaN(Number(txAmount))) {
      setNotification({ message: 'Please enter a valid amount and category.', type: 'error' })
      return
    }

    setTxLoading(true)
    try {
      const amountNum = parseFloat(txAmount)
      const { data, error } = await supabase
        .from('transactions')
        .insert([
          {
            user_id: user.id,
            category_id: txCategory,
            amount: amountNum,
            type: txType,
            description: txDescription,
            date: new Date(txDate).toISOString()
          }
        ])
        .select('*, categories:category_id(*)')
        .single()

      if (error) throw error

      setTransactions([data, ...transactions])
      setTxAmount('')
      setTxDescription('')
      setNotification({ message: 'Transaction added successfully!', type: 'success' })
    } catch (err: any) {
      setNotification({ message: err.message || 'Error adding transaction', type: 'error' })
    } finally {
      setTxLoading(false)
    }
  }

  // Delete Transaction
  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return

    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error

      setTransactions(transactions.filter(t => t.id !== id))
      setNotification({ message: 'Transaction deleted.', type: 'success' })
    } catch (err: any) {
      setNotification({ message: err.message || 'Error deleting transaction', type: 'error' })
    }
  }

  // Set Budget
  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!budgetAmount || !budgetCategory || isNaN(Number(budgetAmount))) {
      setNotification({ message: 'Please enter a valid budget amount.', type: 'error' })
      return
    }

    setBudgetLoading(true)
    try {
      const amountNum = parseFloat(budgetAmount)
      const now = new Date()
      let start_date = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      let end_date = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

      if (budgetPeriod === 'weekly') {
        const start = new Date()
        start.setDate(now.getDate() - now.getDay())
        const end = new Date()
        end.setDate(start.getDate() + 6)
        start_date = start.toISOString().split('T')[0]
        end_date = end.toISOString().split('T')[0]
      } else if (budgetPeriod === 'yearly') {
        start_date = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
        end_date = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0]
      }

      // Check if a budget already exists for this category/period/dates to update it,
      // otherwise insert it. Using upsert based on constraint unique_user_category_period_dates
      const { data, error } = await supabase
        .from('budgets')
        .upsert(
          {
            user_id: user.id,
            category_id: budgetCategory,
            limit_amount: amountNum,
            period: budgetPeriod,
            start_date,
            end_date
          },
          { onConflict: 'user_id,category_id,period,start_date,end_date' }
        )
        .select('*, categories:category_id(*)')

      if (error) throw error

      if (data && data.length > 0) {
        const updatedBudget = data[0]
        const exists = budgets.some(b => b.id === updatedBudget.id)
        if (exists) {
          setBudgets(budgets.map(b => (b.id === updatedBudget.id ? updatedBudget : b)))
        } else {
          setBudgets([updatedBudget, ...budgets])
        }
      }

      setBudgetAmount('')
      setNotification({ message: 'Budget configured successfully!', type: 'success' })
    } catch (err: any) {
      setNotification({ message: err.message || 'Error configuring budget', type: 'error' })
    } finally {
      setBudgetLoading(false)
    }
  }

  // Delete Budget
  const handleDeleteBudget = async (id: string) => {
    try {
      const { error } = await supabase.from('budgets').delete().eq('id', id)
      if (error) throw error

      setBudgets(budgets.filter(b => b.id !== id))
      setNotification({ message: 'Budget removed.', type: 'success' })
    } catch (err: any) {
      setNotification({ message: err.message || 'Error removing budget', type: 'error' })
    }
  }

  // Update Budget (Edit)
  const handleUpdateBudget = async (id: string) => {
    const parsed = parseFloat(editBudgetAmount)
    if (!editBudgetAmount || isNaN(parsed) || parsed <= 0) {
      setNotification({ message: 'Please enter a valid budget amount.', type: 'error' })
      return
    }

    try {
      const { data, error } = await supabase
        .from('budgets')
        .update({ limit_amount: parsed })
        .eq('id', id)
        .select('*, categories:category_id(*)')
        .single()

      if (error) throw error

      setBudgets(budgets.map(b => (b.id === id ? data : b)))
      setEditingBudgetId(null)
      setEditBudgetAmount('')
      setNotification({ message: 'Budget updated successfully!', type: 'success' })
    } catch (err: any) {
      setNotification({ message: err.message || 'Error updating budget', type: 'error' })
    }
  }

  // Add Savings Goal
  const handleAddSavingsGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!goalName || !goalTarget || isNaN(Number(goalTarget))) {
      setNotification({ message: 'Please enter a valid target details.', type: 'error' })
      return
    }

    setGoalLoading(true)
    try {
      const targetNum = parseFloat(goalTarget)
      const { data, error } = await supabase
        .from('savings_goals')
        .insert([
          {
            user_id: user.id,
            name: goalName,
            target_amount: targetNum,
            current_amount: 0,
            target_date: goalTargetDate || null
          }
        ])
        .select()
        .single()

      if (error) throw error

      setSavingsGoals([data, ...savingsGoals])
      setGoalName('')
      setGoalTarget('')
      setGoalTargetDate('')
      setNotification({ message: 'Savings goal created!', type: 'success' })
    } catch (err: any) {
      setNotification({ message: err.message || 'Error creating savings goal', type: 'error' })
    } finally {
      setGoalLoading(false)
    }
  }

  // Add Contribution to Savings Goal
  const handleContributeSavings = async (id: string) => {
    const contribution = contributionAmount[id]
    if (!contribution || isNaN(Number(contribution)) || parseFloat(contribution) <= 0) {
      setNotification({ message: 'Enter a valid amount to contribute.', type: 'error' })
      return
    }

    try {
      const amountNum = parseFloat(contribution)
      const goal = savingsGoals.find(g => g.id === id)
      if (!goal) return

      const newCurrent = Number(goal.current_amount) + amountNum

      const { data, error } = await supabase
        .from('savings_goals')
        .update({ current_amount: newCurrent })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setSavingsGoals(savingsGoals.map(g => (g.id === id ? data : g)))
      setContributionAmount({ ...contributionAmount, [id]: '' })
      setNotification({ message: 'Savings progress updated!', type: 'success' })
    } catch (err: any) {
      setNotification({ message: err.message || 'Error updating progress', type: 'error' })
    }
  }

  // Delete Savings Goal
  const handleDeleteSavingsGoal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this savings goal?')) return

    try {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id)
      if (error) throw error

      setSavingsGoals(savingsGoals.filter(g => g.id !== id))
      setNotification({ message: 'Savings goal deleted.', type: 'success' })
    } catch (err: any) {
      setNotification({ message: err.message || 'Error deleting goal', type: 'error' })
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">

      {/* 1. SIDEBAR NAVIGATION */}
      <aside className="hidden w-64 border-r border-slate-800 bg-slate-900/40 p-6 flex-col justify-between md:flex backdrop-blur-xl">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20 text-white">
              <span className="font-bold text-lg">₮</span>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight">Antigravity</h1>
              <span className="text-sm text-slate-500 font-medium">Expense Tracker</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
            >
              <LayoutDashboard className="h-5 w-5" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${activeTab === 'transactions'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
            >
              <ReceiptText className="h-5 w-5" />
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('budgets')}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${activeTab === 'budgets'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
            >
              <Percent className="h-5 w-5" />
              Budgets
            </button>
            <button
              onClick={() => setActiveTab('savings')}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${activeTab === 'savings'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
            >
              <PiggyBank className="h-5 w-5" />
              Savings Goals
            </button>
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
              <span className="font-semibold text-sm text-slate-300">
                {profile.display_name?.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-white truncate">{profile.display_name}</p>
              <p className="text-sm text-slate-500 truncate">{profile.email}</p>
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl border border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition duration-200"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/30 px-6 py-4 md:hidden backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">₮</div>
            <span className="font-bold text-sm tracking-tight text-white">Expense Tracker</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 font-semibold">{profile.display_name}</span>
            <form action={signOut}>
              <button type="submit" className="text-slate-400 hover:text-red-400">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </header>

        {/* Mobile Navigation Bar */}
        <nav className="flex items-center justify-around border-b border-slate-800 bg-slate-900/40 p-2 md:hidden">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'overview' ? 'text-blue-500' : 'text-slate-500'
              }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'transactions' ? 'text-blue-500' : 'text-slate-500'
              }`}
          >
            <ReceiptText className="h-4 w-4" />
            Ledger
          </button>
          <button
            onClick={() => setActiveTab('budgets')}
            className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'budgets' ? 'text-blue-500' : 'text-slate-500'
              }`}
          >
            <Percent className="h-4 w-4" />
            Budgets
          </button>
          <button
            onClick={() => setActiveTab('savings')}
            className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'savings' ? 'text-blue-500' : 'text-slate-500'
              }`}
          >
            <PiggyBank className="h-4 w-4" />
            Savings
          </button>
        </nav>

        {/* Body content wrapper */}
        <div className="flex-1 p-6 md:p-8 space-y-6">

          {/* Notification Alert Banner */}
          {notification && (
            <div
              className={`flex items-center justify-between rounded-xl border p-4 text-sm shadow-lg backdrop-blur-md animate-in slide-in-from-top-4 duration-300 ${notification.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-950/40 text-emerald-400'
                : 'border-red-500/20 bg-red-950/40 text-red-400'
                }`}
            >
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                )}
                <span>{notification.message}</span>
              </div>
              <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Heading */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white capitalize tracking-tight">
                {activeTab} Dashboard
              </h2>
              <p className="text-sm text-slate-500">
                Manage your expenses, view trends, and meet your savings goals.
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider block">Today</span>
              <span className="text-sm font-bold text-slate-300">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>

          {/* --- TABS RENDERING --- */}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* Financial Metrics Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                {/* Net Balance Card */}
                <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur-xl">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 h-16 w-16 rounded-full bg-blue-500/5 blur-xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-400">Net Balance</span>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${totals.balance >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      ₮
                    </span>
                  </div>
                  <div className="mt-4">
                    <h3 className={`text-3xl font-extrabold tracking-tight ${totals.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${totals.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">Available financial capacity</p>
                  </div>
                </div>

                {/* Total Income Card */}
                <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur-xl">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 h-16 w-16 rounded-full bg-emerald-500/5 blur-xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-400">Total Income</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <ArrowUpRight className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-3xl font-extrabold tracking-tight text-white">
                      ${totals.income.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <p className="mt-1 text-sm text-emerald-500 font-medium flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Cumulative earnings
                    </p>
                  </div>
                </div>

                {/* Total Expenses Card */}
                <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur-xl">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 h-16 w-16 rounded-full bg-rose-500/5 blur-xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-400">Total Expenses</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                      <ArrowDownRight className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-3xl font-extrabold tracking-tight text-white">
                      ${totals.expenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <p className="mt-1 text-sm text-rose-500 font-medium">
                      Total tracked outflow
                    </p>
                  </div>
                </div>

              </div>

              {/* Charts & Interactive Forms Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left side: Charts & Form (2 columns wide) */}
                <div className="lg:col-span-2 space-y-6">

                  {/* Spend Trend Chart */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-xl">
                    <h4 className="font-bold text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      Income vs Expenses Trend (Last 7 Days)
                    </h4>
                    <div className="h-80 w-full">
                      {isMounted && (
                        <ResponsiveContainer width="100%" height={320}>
                          <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} />
                            <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px' }}
                              labelStyle={{ fontWeight: 'bold', color: '#F1F5F9' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Area type="monotone" dataKey="Income" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                            <Area type="monotone" dataKey="Expense" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Add Transaction Quick Form */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-xl">
                    <h4 className="font-bold text-white mb-6 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
                      <Plus className="h-4 w-4 text-blue-500" />
                      Quick Add Transaction
                    </h4>
                    <form onSubmit={handleAddTransaction} className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Amount ($)</label>
                        <div className="relative mt-1">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                            <DollarSign className="h-4 w-4" />
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="0.00"
                            value={txAmount}
                            onChange={(e) => setTxAmount(e.target.value)}
                            className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 transition duration-200 hover:border-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Type Toggle */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Type</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => setTxType('expense')}
                            className={`rounded-xl py-3 text-sm font-semibold border transition-all duration-200 ${txType === 'expense'
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                          >
                            Expense
                          </button>
                          <button
                            type="button"
                            onClick={() => setTxType('income')}
                            className={`rounded-xl py-3 text-sm font-semibold border transition-all duration-200 ${txType === 'income'
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                          >
                            Income
                          </button>
                        </div>
                      </div>

                      {/* Category Selection */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Category</label>
                        <select
                          value={txCategory}
                          onChange={(e) => setTxCategory(e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 px-4 text-sm text-white transition duration-200 hover:border-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {categories
                            .filter((c) => c.type === txType)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Date selection */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Date</label>
                        <div className="relative mt-1">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <input
                            type="date"
                            required
                            value={txDate}
                            onChange={(e) => setTxDate(e.target.value)}
                            className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 transition duration-200 hover:border-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Description</label>
                        <input
                          type="text"
                          placeholder="e.g. Weekly grocery shopping"
                          value={txDescription}
                          onChange={(e) => setTxDescription(e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 px-4 text-sm text-white placeholder-slate-600 transition duration-200 hover:border-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={txLoading}
                        className="sm:col-span-2 mt-2 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 disabled:opacity-50"
                      >
                        {txLoading ? 'Adding...' : 'Add Transaction'}
                      </button>
                    </form>
                  </div>

                </div>

                {/* Right side: Category Breakdown & Recent Transactions (1 column wide) */}
                <div className="space-y-6">

                  {/* Category Pie Chart */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-xl">
                    <h4 className="font-bold text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
                      <Percent className="h-4 w-4 text-blue-500" />
                      Expenses by Category
                    </h4>
                    <div className="h-64 w-full">
                      {isMounted && pieChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={256}>
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px' }}
                              itemStyle={{ color: '#F1F5F9' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-slate-500 text-center">No expense logs recorded yet.</p>
                      )}
                    </div>

                    {/* Custom Legend */}
                    {pieChartData.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-400">
                        {pieChartData.slice(0, 6).map((item, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="truncate">{item.name} (${item.value})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Transactions */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
                        <ReceiptText className="h-4 w-4 text-blue-500" />
                        Recent Logs
                      </h4>
                      <button
                        onClick={() => setActiveTab('transactions')}
                        className="text-sm font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline"
                      >
                        See All
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {transactions.slice(0, 5).map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-xl bg-slate-950/40 p-3 border border-slate-900/60 hover:border-slate-800/40 transition">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                              style={{
                                backgroundColor: `${t.categories?.color || '#3B82F6'}15`,
                                color: t.categories?.color || '#3B82F6'
                              }}
                            >
                              <CategoryIcon iconName={t.categories?.icon} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-slate-100 truncate">{t.description || t.categories?.name}</p>
                              <p className="text-sm text-slate-500">
                                {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {t.categories?.name}
                              </p>
                            </div>
                          </div>
                          <span className={`font-bold text-sm ml-2 ${t.type === 'income' ? 'text-emerald-400' : 'text-slate-100'}`}>
                            {t.type === 'income' ? '+' : '-'}${Number(t.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}

                      {transactions.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-4">No transactions found.</p>
                      )}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 2: TRANSACTIONS (LOCKED LEDGER) */}
          {activeTab === 'transactions' && (
            <div className="space-y-6">

              {/* Filters Box */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-2xl border border-slate-800 bg-slate-900/30 p-4 backdrop-blur-xl">

                {/* Search */}
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Type Filter */}
                <div>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 px-4 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">All Types</option>
                    <option value="expense">Expenses Only</option>
                    <option value="income">Income Only</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 px-4 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick reset */}
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setTypeFilter('all')
                    setCategoryFilter('all')
                  }}
                  className="rounded-xl border border-slate-800 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition"
                >
                  Clear Filters
                </button>

              </div>

              {/* Transactions Ledger Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/50 text-sm font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-6 py-4">Transaction</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4 text-right">Amount</th>
                        <th className="px-6 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-900/20 transition">
                          {/* Name/Desc */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
                                style={{
                                  backgroundColor: `${t.categories?.color || '#6B7280'}15`,
                                  color: t.categories?.color || '#6B7280'
                                }}
                              >
                                <CategoryIcon iconName={t.categories?.icon} className="h-4.5 w-4.5" />
                              </div>
                              <span className="font-semibold text-sm text-slate-200">
                                {t.description || t.categories?.name || 'Untitled'}
                              </span>
                            </div>
                          </td>
                          {/* Category Badge */}
                          <td className="px-6 py-4">
                            <span
                              className="rounded-full px-2.5 py-1 text-sm font-bold"
                              style={{
                                backgroundColor: `${t.categories?.color || '#6B7280'}15`,
                                color: t.categories?.color || '#6B7280'
                              }}
                            >
                              {t.categories?.name}
                            </span>
                          </td>
                          {/* Date */}
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {new Date(t.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          {/* Amount */}
                          <td className={`px-6 py-4 text-right font-extrabold text-sm ${t.type === 'income' ? 'text-emerald-400' : 'text-slate-100'}`}>
                            {t.type === 'income' ? '+' : '-'}${Number(t.amount).toFixed(2)}
                          </td>
                          {/* Actions */}
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleDeleteTransaction(t.id)}
                              className="text-slate-500 hover:text-red-400 transition p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                            No ledger logs found matching criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: BUDGETS */}
          {activeTab === 'budgets' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Config Budgets Form (Left Column) */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-xl h-fit">
                <h4 className="font-bold text-white mb-6 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
                  <Percent className="h-4 w-4 text-blue-500" />
                  Configure Category Budget
                </h4>
                <form onSubmit={handleSetBudget} className="space-y-4">

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Select Category</label>
                    <select
                      value={budgetCategory}
                      onChange={(e) => setBudgetCategory(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 px-4 text-sm text-white focus:outline-none"
                    >
                      {categories
                        .filter((c) => c.type === 'expense')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Limit Amount */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Limit Limit ($)</label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="0.00"
                        value={budgetAmount}
                        onChange={(e) => setBudgetAmount(e.target.value)}
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 pl-10 pr-4 text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Period Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Budget Cycle</label>
                    <select
                      value={budgetPeriod}
                      onChange={(e) => setBudgetPeriod(e.target.value as any)}
                      className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 px-4 text-sm text-white focus:outline-none"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={budgetLoading}
                    className="w-full mt-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition"
                  >
                    {budgetLoading ? 'Saving...' : 'Set Budget'}
                  </button>
                </form>
              </div>

              {/* Budgets Tracker list (Right Columns) */}
              <div className="lg:col-span-2 space-y-4">

                {budgets.map((b) => {
                  const spent = categorySpending[b.category_id] || 0
                  const limit = Number(b.limit_amount)
                  const pct = Math.min((spent / limit) * 100, 100)
                  const isEditing = editingBudgetId === b.id

                  let progressColor = 'bg-emerald-500'
                  let strokeColor = 'border-emerald-500/20'
                  let bgColor = 'bg-emerald-500/5'
                  if (spent >= limit) {
                    progressColor = 'bg-red-500'
                    strokeColor = 'border-red-500/20'
                    bgColor = 'bg-red-500/5'
                  } else if (spent / limit >= 0.75) {
                    progressColor = 'bg-amber-500'
                    strokeColor = 'border-amber-500/20'
                    bgColor = 'bg-amber-500/5'
                  }

                  return (
                    <div
                      key={b.id}
                      className={`rounded-2xl border p-6 backdrop-blur-xl transition ${strokeColor} ${bgColor}`}
                    >
                      {/* Card Header: icon + name + action buttons */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                            style={{ backgroundColor: b.categories?.color || '#6B7280' }}
                          >
                            <CategoryIcon iconName={b.categories?.icon} />
                          </div>
                          <div>
                            <h5 className="font-bold text-white">{b.categories?.name}</h5>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-sm text-slate-500 capitalize">{b.period} limit</span>
                              {/* Status badge */}
                              {(() => {
                                const usage = limit > 0 ? spent / limit : 0
                                if (usage >= 1) return (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">Over Budget</span>
                                )
                                if (usage >= 0.75) return (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">Warning</span>
                                )
                                return (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Safe</span>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingBudgetId(isEditing ? null : b.id)
                              setEditBudgetAmount(isEditing ? '' : String(b.limit_amount))
                            }}
                            className="text-slate-500 hover:text-blue-400 p-1 transition"
                            title={isEditing ? 'Cancel edit' : 'Edit budget limit'}
                          >
                            {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteBudget(b.id)}
                            className="text-slate-500 hover:text-red-400 p-1 transition"
                            title="Delete budget"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Edit Form */}
                      {isEditing && (
                        <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            New Limit Amount ($)
                          </label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                                <DollarSign className="h-3.5 w-3.5" />
                              </div>
                              <input
                                type="text"
                                placeholder="0.00"
                                value={editBudgetAmount}
                                onChange={(e) => setEditBudgetAmount(e.target.value)}
                                className="block w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                              />
                            </div>
                            <button
                              onClick={() => handleUpdateBudget(b.id)}
                              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Save
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Progress Metrics */}
                      <div className="flex justify-between items-baseline mb-2">
                        <p className="text-sm font-semibold text-slate-300">
                          Spent: <span className="font-extrabold text-white">${spent.toFixed(2)}</span>
                        </p>
                        <p className="text-sm text-slate-400">
                          Budget: <span className="font-bold">${limit.toFixed(2)}</span>
                        </p>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center mt-3 text-sm">
                        <span className="text-slate-500">
                          {pct.toFixed(0)}% Consumed
                        </span>
                        {spent >= limit ? (
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Over budget!
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            ${(limit - spent).toFixed(2)} Remaining
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {budgets.length === 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center backdrop-blur-xl">
                    <p className="text-sm text-slate-500">No category limits set yet. Use the configuration form on the left.</p>
                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB 4: SAVINGS GOALS */}
          {activeTab === 'savings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Savings Goals Form (Left Column) */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 backdrop-blur-xl h-fit">
                <h4 className="font-bold text-white mb-6 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
                  <PiggyBank className="h-4 w-4 text-blue-500" />
                  Create Savings Goal
                </h4>
                <form onSubmit={handleAddSavingsGoal} className="space-y-4">

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Goal Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. New Car Fund"
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 px-4 text-sm text-white focus:outline-none"
                    />
                  </div>

                  {/* Target Amount */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Target Amount ($)</label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="0.00"
                        value={goalTarget}
                        onChange={(e) => setGoalTarget(e.target.value)}
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 pl-10 pr-4 text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Target Date */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Target Date (Optional)</label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <input
                        type="date"
                        value={goalTargetDate}
                        onChange={(e) => setGoalTargetDate(e.target.value)}
                        className="block w-full rounded-xl border border-slate-800 bg-slate-950 py-3 pl-10 pr-4 text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={goalLoading}
                    className="w-full mt-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition"
                  >
                    {goalLoading ? 'Creating...' : 'Create Goal'}
                  </button>
                </form>
              </div>

              {/* Goals Cards List (Right Columns) */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">

                {savingsGoals.map((g) => {
                  const current = Number(g.current_amount)
                  const target = Number(g.target_amount)
                  const pct = Math.min((current / target) * 100, 100)

                  return (
                    <div
                      key={g.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-xl flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="font-bold text-lg text-white truncate pr-2">{g.name}</h5>
                          <button
                            onClick={() => handleDeleteSavingsGoal(g.id)}
                            className="text-slate-500 hover:text-red-400 p-1 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-baseline text-sm">
                            <span className="font-extrabold text-blue-400">${current.toLocaleString()}</span>
                            <span className="text-slate-500">of ${target.toLocaleString()}</span>
                          </div>

                          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                          </div>

                          <div className="flex justify-between text-sm text-slate-500">
                            <span>{pct.toFixed(0)}% Saved</span>
                            {g.target_date && (
                              <span>By {new Date(g.target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contribution Quick Form */}
                      <div className="mt-6 pt-4 border-t border-slate-800/60">
                        <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider">Quick Save</label>
                        <div className="flex gap-2 mt-1">
                          <div className="relative flex-1">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-600">
                              <DollarSign className="h-3.5 w-3.5" />
                            </div>
                            <input
                              type="text"
                              placeholder="Add funds"
                              value={contributionAmount[g.id] || ''}
                              onChange={(e) => setContributionAmount({ ...contributionAmount, [g.id]: e.target.value })}
                              className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-2 text-sm text-white focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={() => handleContributeSavings(g.id)}
                            className="rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-500 transition"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                    </div>
                  )
                })}

                {savingsGoals.length === 0 && (
                  <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center backdrop-blur-xl">
                    <p className="text-sm text-slate-500">No savings goals created yet. Use the configuration form on the left.</p>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

      </main>

    </div>
  )
}
