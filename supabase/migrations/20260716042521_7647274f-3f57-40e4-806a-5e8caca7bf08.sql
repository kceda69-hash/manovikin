GRANT INSERT ON public.manovik_brain_updates TO authenticated;
CREATE POLICY "admins insert brain updates" ON public.manovik_brain_updates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));