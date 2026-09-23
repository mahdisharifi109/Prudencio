-- Migration: Sistema de Obras + campos adicionais nas guias
-- Executar no Supabase SQL Editor

-- ─── 1. Tabela obras ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.obras (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      text NOT NULL,
  descricao text,
  status    text NOT NULL DEFAULT 'ativa',   -- 'ativa' | 'terminada'
  created_by text,
  terminated_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read obras"   ON public.obras FOR SELECT USING (true);
CREATE POLICY "public write obras"  ON public.obras FOR INSERT WITH CHECK (true);
CREATE POLICY "public update obras" ON public.obras FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete obras" ON public.obras FOR DELETE USING (true);

-- ─── 2. Novos campos na tabela checklists ────────────────────────────
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS obra_id    uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_guia  text DEFAULT 'transporte',  -- 'transporte' | 'devolucao'
  ADD COLUMN IF NOT EXISTS pdf_name   text,
  ADD COLUMN IF NOT EXISTS pdf_metadata jsonb;

-- Índice para pesquisa por obra
CREATE INDEX IF NOT EXISTS checklists_obra_id_idx ON public.checklists (obra_id);

-- ─── 3. Política de delete em checklists (em falta) ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'checklists' AND policyname = 'public delete checklists'
  ) THEN
    EXECUTE 'CREATE POLICY "public delete checklists" ON public.checklists FOR DELETE USING (true)';
  END IF;
END $$;
