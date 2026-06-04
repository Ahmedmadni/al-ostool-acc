
CREATE TABLE public.personal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL DEFAULT '',
  is_done boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  color text NOT NULL DEFAULT 'yellow',
  due_date date,
  done_at timestamptz,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_notes TO authenticated;
GRANT ALL ON public.personal_notes TO service_role;

ALTER TABLE public.personal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own personal notes select" ON public.personal_notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own personal notes insert" ON public.personal_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own personal notes update" ON public.personal_notes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own personal notes delete" ON public.personal_notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_personal_notes_updated
  BEFORE UPDATE ON public.personal_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE INDEX idx_personal_notes_user ON public.personal_notes(user_id, pinned DESC, order_index, created_at DESC);
