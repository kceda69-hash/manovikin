CREATE TABLE public.seo_monitor_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  site_url text NOT NULL,
  sitemap_errors integer NOT NULL DEFAULT 0,
  sitemap_warnings integer NOT NULL DEFAULT 0,
  indexed_urls integer,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  avg_position numeric,
  ok boolean NOT NULL DEFAULT true,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.seo_monitor_snapshots TO authenticated;
GRANT ALL ON public.seo_monitor_snapshots TO service_role;
ALTER TABLE public.seo_monitor_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view seo snapshots"
  ON public.seo_monitor_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX seo_monitor_snapshots_captured_at_idx
  ON public.seo_monitor_snapshots (captured_at DESC);

CREATE TABLE public.seo_monitor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_id uuid REFERENCES public.seo_monitor_snapshots(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  notified_at timestamptz
);

GRANT SELECT, UPDATE ON public.seo_monitor_alerts TO authenticated;
GRANT ALL ON public.seo_monitor_alerts TO service_role;
ALTER TABLE public.seo_monitor_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view seo alerts"
  ON public.seo_monitor_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can acknowledge seo alerts"
  ON public.seo_monitor_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX seo_monitor_alerts_open_idx
  ON public.seo_monitor_alerts (created_at DESC) WHERE acknowledged_at IS NULL;