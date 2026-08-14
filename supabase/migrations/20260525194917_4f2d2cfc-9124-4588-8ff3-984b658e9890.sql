-- Roles infrastructure
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins see all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Grant admin to creator if their account already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'tobyfemi55@gmail.com'
ON CONFLICT DO NOTHING;

-- Training submissions
CREATE TYPE public.submission_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.training_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid,
  raw_messages jsonb NOT NULL,
  ai_summary text,
  status public.submission_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  reviewer_note text
);

ALTER TABLE public.training_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own submission insert" ON public.training_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own submission select" ON public.training_submissions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admin select all submissions" ON public.training_submissions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update submissions" ON public.training_submissions
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete submissions" ON public.training_submissions
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_training_submissions_status ON public.training_submissions(status, created_at DESC);

-- Global knowledge
CREATE TABLE public.global_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact text NOT NULL,
  source_submission_id uuid REFERENCES public.training_submissions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.global_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read knowledge" ON public.global_knowledge
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert knowledge" ON public.global_knowledge
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update knowledge" ON public.global_knowledge
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete knowledge" ON public.global_knowledge
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));