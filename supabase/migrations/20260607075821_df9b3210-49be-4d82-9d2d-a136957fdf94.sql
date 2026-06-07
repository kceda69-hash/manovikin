
REVOKE EXECUTE ON FUNCTION public.manovik_spend_credit(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manovik_topup_credit(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manovik_spend_credit(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.manovik_topup_credit(uuid, integer, text) TO service_role;
