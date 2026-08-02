CREATE TABLE public.agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Background task',
  instruction text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  result text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_tasks_status_check CHECK (status IN ('queued','running','done','failed'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_tasks TO authenticated;
GRANT ALL ON public.agent_tasks TO service_role;

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own task select" ON public.agent_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own task insert" ON public.agent_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own task update" ON public.agent_tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own task delete" ON public.agent_tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX agent_tasks_user_created_idx ON public.agent_tasks (user_id, created_at DESC);

CREATE TRIGGER agent_tasks_touch_updated_at
  BEFORE UPDATE ON public.agent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();