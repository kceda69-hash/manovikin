
CREATE TABLE public.ai_balance (
  user_id uuid PRIMARY KEY,
  credits integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_balance TO authenticated;
GRANT ALL ON public.ai_balance TO service_role;
ALTER TABLE public.ai_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own balance read" ON public.ai_balance
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.ai_balance_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_balance_ledger_user_idx ON public.ai_balance_ledger(user_id, created_at DESC);
GRANT SELECT ON public.ai_balance_ledger TO authenticated;
GRANT ALL ON public.ai_balance_ledger TO service_role;
ALTER TABLE public.ai_balance_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger read" ON public.ai_balance_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- Atomic spend: deducts credits and writes ledger row in one shot.
CREATE OR REPLACE FUNCTION public.manovik_spend_credit(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE remaining integer;
BEGIN
  INSERT INTO public.ai_balance(user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.ai_balance
    SET credits = credits - _amount, updated_at = now()
    WHERE user_id = _user_id AND credits >= _amount
    RETURNING credits INTO remaining;

  IF remaining IS NULL THEN
    RETURN -1;
  END IF;

  INSERT INTO public.ai_balance_ledger(user_id, delta, reason)
    VALUES (_user_id, -_amount, _reason);
  RETURN remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.manovik_topup_credit(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE remaining integer;
BEGIN
  INSERT INTO public.ai_balance(user_id, credits) VALUES (_user_id, _amount)
    ON CONFLICT (user_id) DO UPDATE
      SET credits = ai_balance.credits + EXCLUDED.credits, updated_at = now()
    RETURNING credits INTO remaining;
  INSERT INTO public.ai_balance_ledger(user_id, delta, reason)
    VALUES (_user_id, _amount, _reason);
  RETURN remaining;
END;
$$;
