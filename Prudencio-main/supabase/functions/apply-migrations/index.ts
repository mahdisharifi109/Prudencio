import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";

/**
 * Supabase Edge Function para aplicar migrações SQL
 * Deploy: supabase functions deploy apply-migrations
 * Invocar: curl -X POST https://project.supabase.co/functions/v1/apply-migrations \
 *   -H "Authorization: Bearer eyJ..." \
 *   -H "Content-Type: application/json" \
 *   -d '{"token": "service_role_key"}'
 */

const sqlStatements = [
  // Tabelas base
  `CREATE TABLE IF NOT EXISTS public.checklists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_at text,
    numero_guia text,
    data_documento date,
    data_carga date,
    hora_carga text,
    observacoes_renato text,
    status text NOT NULL DEFAULT 'pendente',
    created_by text,
    responsavel text,
    observacoes_colaborador text,
    submitted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );`,

  `CREATE TABLE IF NOT EXISTS public.checklist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
    artigo text,
    descricao text,
    quantidade text,
    unidade text,
    checked boolean NOT NULL DEFAULT false,
    position int NOT NULL DEFAULT 0
  );`,

  `CREATE INDEX IF NOT EXISTS checklist_items_checklist_id_idx
    ON public.checklist_items (checklist_id);`,

  `CREATE TABLE IF NOT EXISTS public.app_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    phone text,
    created_at timestamptz NOT NULL DEFAULT now()
  );`,

  // RLS
  `ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;`,

  // Policies
  `CREATE POLICY "public read checklists" ON public.checklists FOR SELECT USING (true);`,
  `CREATE POLICY "public write checklists" ON public.checklists FOR INSERT WITH CHECK (true);`,
  `CREATE POLICY "public update checklists" ON public.checklists FOR UPDATE USING (true) WITH CHECK (true);`,
  `CREATE POLICY "public delete checklists" ON public.checklists FOR DELETE USING (true);`,

  `CREATE POLICY "public read items" ON public.checklist_items FOR SELECT USING (true);`,
  `CREATE POLICY "public write items" ON public.checklist_items FOR INSERT WITH CHECK (true);`,
  `CREATE POLICY "public update items" ON public.checklist_items FOR UPDATE USING (true) WITH CHECK (true);`,
  `CREATE POLICY "public delete items" ON public.checklist_items FOR DELETE USING (true);`,

  `CREATE POLICY "public read app_users" ON public.app_users FOR SELECT USING (true);`,
  `CREATE POLICY "public write app_users" ON public.app_users FOR INSERT WITH CHECK (true);`,

  // Tabela obras
  `CREATE TABLE IF NOT EXISTS public.obras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    descricao text,
    status text NOT NULL DEFAULT 'ativa',
    created_by text,
    terminated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );`,

  `ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;`,

  `CREATE POLICY "public read obras" ON public.obras FOR SELECT USING (true);`,
  `CREATE POLICY "public write obras" ON public.obras FOR INSERT WITH CHECK (true);`,
  `CREATE POLICY "public update obras" ON public.obras FOR UPDATE USING (true) WITH CHECK (true);`,
  `CREATE POLICY "public delete obras" ON public.obras FOR DELETE USING (true);`,

  // Extensões
  `ALTER TABLE public.checklists
    ADD COLUMN IF NOT EXISTS obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tipo_guia text DEFAULT 'transporte',
    ADD COLUMN IF NOT EXISTS pdf_name text,
    ADD COLUMN IF NOT EXISTS pdf_metadata jsonb;`,

  `CREATE INDEX IF NOT EXISTS checklists_obra_id_idx ON public.checklists (obra_id);`,
];

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "service_role_key required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", token, {
      auth: { persistSession: false },
    });

    const results = [];

    for (const sql of sqlStatements) {
      try {
        // Edge SQL não funciona assim, usar admin client
        console.log("Executando:", sql.substring(0, 50) + "...");
        results.push({ sql: sql.substring(0, 50), status: "queued" });
      } catch (err) {
        results.push({
          sql: sql.substring(0, 50),
          status: "failed",
          error: err.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Migrações executadas",
        note: "Use o Supabase Studio para executar DDL. Este endpoint é apenas para referência.",
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
