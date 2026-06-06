import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Fetch user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('Error fetching profile:', profileError)
  }

  // Fallback profile if row is not created yet
  const userProfile = profile || {
    id: user.id,
    email: user.email,
    display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
    currency: 'USD',
    monthly_budget: null,
  }

  // 3. Fetch categories (both global defaults and user-specific)
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${user.id}`)

  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError)
  }

  // 4. Fetch transactions (joined with category info)
  const { data: transactions, error: transactionsError } = await supabase
    .from('transactions')
    .select('*, categories:category_id(*)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (transactionsError) {
    console.error('Error fetching transactions:', transactionsError)
  }

  // 5. Fetch budgets
  const { data: budgets, error: budgetsError } = await supabase
    .from('budgets')
    .select('*, categories:category_id(*)')
    .eq('user_id', user.id)

  if (budgetsError) {
    console.error('Error fetching budgets:', budgetsError)
  }

  // 6. Fetch savings goals
  const { data: savingsGoals, error: savingsGoalsError } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', user.id)

  if (savingsGoalsError) {
    console.error('Error fetching savings goals:', savingsGoalsError)
  }

  return (
    <DashboardClient
      user={user}
      initialProfile={userProfile}
      initialCategories={categories || []}
      initialTransactions={transactions || []}
      initialBudgets={budgets || []}
      initialSavingsGoals={savingsGoals || []}
    />
  )
}
