-- Supabase Database Schema for Expense Tracker

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. FUNCTIONS & TRIGGERS FOR TIMESTAMP UPDATES
-- =========================================================================

-- Function to automatically update updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =========================================================================
-- 2. TABLES DEFINITIONS
-- =========================================================================

-- PROFILES TABLE
-- Synced with auth.users for general user preferences
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    monthly_budget NUMERIC(12, 2) CHECK (monthly_budget >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CATEGORIES TABLE
-- Supports global categories (user_id IS NULL) and custom user categories
CREATE TABLE public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon TEXT, -- Lucide icon name (e.g., 'utensils', 'home')
    color TEXT, -- Tailwind color or HEX code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TRANSACTIONS TABLE
-- Ledger of all income and expenses
CREATE TABLE public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
    category_id UUID REFERENCES public.categories ON DELETE RESTRICT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- BUDGETS TABLE
-- Budget limits set by category for specific periods
CREATE TABLE public.budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
    category_id UUID REFERENCES public.categories ON DELETE CASCADE NOT NULL,
    limit_amount NUMERIC(12, 2) NOT NULL CHECK (limit_amount > 0),
    period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_category_period_dates UNIQUE (user_id, category_id, period, start_date, end_date)
);

-- SAVINGS GOALS TABLE
-- Goals to track savings progression
CREATE TABLE public.savings_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
    name TEXT NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
    target_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RECEIPTS TABLE
-- Receipt images and parsed AI data, optionally linked to a transaction
CREATE TABLE public.receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
    image_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    parsed_data JSONB, -- AI-extracted fields: merchant, date, amount, line items
    transaction_id UUID REFERENCES public.transactions ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 3. TRIGGERS FOR TIMESTAMP UPDATES
-- =========================================================================

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_savings_goals_updated_at
    BEFORE UPDATE ON public.savings_goals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 4. PROFILE SYNCRONIZATION TRIGGER (FROM AUTH.USERS)
-- =========================================================================

-- Trigger function to automatically create a public profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, currency)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'currency', 'USD')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run handle_new_user function on new user insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 5. INDEXES FOR PERFORMANCE
-- =========================================================================

-- Categories unique indexes
CREATE UNIQUE INDEX categories_global_name_type_idx ON public.categories (name, type) WHERE user_id IS NULL;
CREATE UNIQUE INDEX categories_user_name_type_idx ON public.categories (user_id, name, type) WHERE user_id IS NOT NULL;

-- Query optimization indexes
CREATE INDEX idx_transactions_user_id_date ON public.transactions (user_id, date DESC);
CREATE INDEX idx_transactions_category_id ON public.transactions (category_id);
CREATE INDEX idx_categories_user_id ON public.categories (user_id);
CREATE INDEX idx_budgets_user_id ON public.budgets (user_id);
CREATE INDEX idx_savings_goals_user_id ON public.savings_goals (user_id);
CREATE INDEX idx_receipts_user_id ON public.receipts (user_id);

-- =========================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Categories Policies
CREATE POLICY "Users can view global categories and their own custom categories" 
    ON public.categories FOR SELECT 
    USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can create their own custom categories" 
    ON public.categories FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom categories" 
    ON public.categories FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom categories" 
    ON public.categories FOR DELETE 
    USING (auth.uid() = user_id);

-- Transactions Policies
CREATE POLICY "Users can view their own transactions" 
    ON public.transactions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" 
    ON public.transactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" 
    ON public.transactions FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions" 
    ON public.transactions FOR DELETE 
    USING (auth.uid() = user_id);

-- Budgets Policies
CREATE POLICY "Users can view their own budgets" 
    ON public.budgets FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets" 
    ON public.budgets FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets" 
    ON public.budgets FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets" 
    ON public.budgets FOR DELETE 
    USING (auth.uid() = user_id);

-- Savings Goals Policies
CREATE POLICY "Users can view their own savings goals" 
    ON public.savings_goals FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own savings goals" 
    ON public.savings_goals FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own savings goals" 
    ON public.savings_goals FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own savings goals" 
    ON public.savings_goals FOR DELETE 
    USING (auth.uid() = user_id);

-- Receipts Policies
CREATE POLICY "Users can view their own receipts" 
    ON public.receipts FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own receipts" 
    ON public.receipts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts" 
    ON public.receipts FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receipts" 
    ON public.receipts FOR DELETE 
    USING (auth.uid() = user_id);

-- =========================================================================
-- 7. SEED DATA - DEFAULT GLOBAL CATEGORIES
-- =========================================================================

INSERT INTO public.categories (user_id, name, type, icon, color) VALUES
-- Expenses
(NULL, 'Food & Dining', 'expense', 'Utensils', '#F59E0B'),
(NULL, 'Housing & Rent', 'expense', 'Home', '#3B82F6'),
(NULL, 'Utilities', 'expense', 'Zap', '#10B981'),
(NULL, 'Transportation', 'expense', 'Car', '#EF4444'),
(NULL, 'Entertainment', 'expense', 'Tv', '#8B5CF6'),
(NULL, 'Shopping', 'expense', 'ShoppingBag', '#EC4899'),
(NULL, 'Health & Fitness', 'expense', 'Activity', '#06B6D4'),
(NULL, 'Travel', 'expense', 'Plane', '#14B8A6'),
(NULL, 'Education', 'expense', 'BookOpen', '#6366F1'),
(NULL, 'Miscellaneous', 'expense', 'HelpCircle', '#6B7280'),
-- Income
(NULL, 'Salary', 'income', 'DollarSign', '#10B981'),
(NULL, 'Freelance & Side Hustles', 'income', 'Briefcase', '#3B82F6'),
(NULL, 'Investments', 'income', 'TrendingUp', '#8B5CF6'),
(NULL, 'Gifts & Grants', 'income', 'Gift', '#EC4899'),
(NULL, 'Other Income', 'income', 'PlusCircle', '#6B7280')
ON CONFLICT DO NOTHING;
