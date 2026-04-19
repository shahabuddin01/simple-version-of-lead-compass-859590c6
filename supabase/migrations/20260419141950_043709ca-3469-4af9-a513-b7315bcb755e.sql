
-- Time sessions table
CREATE TABLE public.time_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  session_id TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  idle_periods JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_actions INTEGER NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_sessions_user_date ON public.time_sessions(user_id, date DESC);
CREATE INDEX idx_time_sessions_date ON public.time_sessions(date DESC);

ALTER TABLE public.time_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sessions or admins view all"
  ON public.time_sessions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own sessions"
  ON public.time_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sessions"
  ON public.time_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins delete sessions"
  ON public.time_sessions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_time_sessions_updated_at
  BEFORE UPDATE ON public.time_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Activity logs table
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  action TEXT NOT NULL,
  session_id TEXT,
  date DATE NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_user_date ON public.activity_logs(user_id, date DESC);
CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own logs or admins view all"
  ON public.activity_logs FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins delete logs"
  ON public.activity_logs FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Hourly stats table
CREATE TABLE public.hourly_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour < 24),
  clicks INTEGER NOT NULL DEFAULT 0,
  actions INTEGER NOT NULL DEFAULT 0,
  action_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, hour)
);

CREATE INDEX idx_hourly_stats_user_date ON public.hourly_stats(user_id, date DESC);

ALTER TABLE public.hourly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own stats or admins view all"
  ON public.hourly_stats FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users upsert own stats"
  ON public.hourly_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own stats"
  ON public.hourly_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins delete stats"
  ON public.hourly_stats FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for live activity tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
