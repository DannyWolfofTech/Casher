-- Create upload_history table to track past CSV uploads
CREATE TABLE public.upload_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_spending NUMERIC NOT NULL,
  subscriptions_count INTEGER NOT NULL DEFAULT 0,
  potential_savings NUMERIC NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.upload_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own upload history"
  ON public.upload_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own upload history"
  ON public.upload_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add monthly spending history to profiles
ALTER TABLE public.profiles
ADD COLUMN monthly_spending_history JSONB DEFAULT '[]'::jsonb;