// Camada de persistência com fallback automático:
// Tenta Supabase (primário) → se falhar → usa Firebase (automático, sem erro visível).
import { supabase } from "@/integrations/supabase/client";
import {
  createChecklist as fbCreate,
  getChecklist as fbGet,
  listChecklists as fbList,
  updateChecklist as fbUpdate,
  createObra as fbCreateObra,
  listObras as fbListObras,
  updateObra as fbUpdateObra,
  logUser as fbLogUser,
  db as fbDb,
  type Checklist,
  type ChecklistItem,
  type PdfMetadata,
  type Obra,
} from "./firebase";

export type { Checklist, ChecklistItem, PdfMetadata, Obra };

// ─── Helpers ────────────────────────────────────────────────────────

/** Testa se o Supabase está acessível (timeout de 4 s) */
async function isSupabaseAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const { error } = await supabase
      .from("checklists")
      .select("id", { count: "exact", head: true })
      .abortSignal(controller.signal)
      .limit(1);
    clearTimeout(timer);
    return !error;
  } catch {
    return false;
  }
}

/** Cache do estado do Supabase para evitar testar em cada chamada (TTL 30 s) */
let _supabaseOk: boolean | null = null;
let _lastCheck = 0;
const CHECK_TTL = 30_000;

async function supabaseReady(): Promise<boolean> {
  const now = Date.now();
  if (_supabaseOk !== null && now - _lastCheck < CHECK_TTL) return _supabaseOk;
  _supabaseOk = await isSupabaseAvailable();
  _lastCheck = now;
  return _supabaseOk;
}

function invalidateSupabaseCache() {
  _supabaseOk = null;
  _lastCheck = 0;
}

// ─── OBRAS — CREATE ──────────────────────────────────────────────────

export async function createObraStore(o: Omit<Obra, "id">): Promise<string> {
  if (await supabaseReady()) {
    try {
      const { data: row, error } = await supabase
        .from("obras")
        .insert({
          nome: o.nome,
          descricao: o.descricao || null,
          status: o.status || "ativa",
          created_by: o.created_by || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const id = row.id as string;
      fbCreateObra({ ...o }).catch((e) => console.warn("Firebase obra mirror falhou:", e));
      return id;
    } catch (err) {
      console.warn("Supabase createObra falhou, a usar Firebase:", err);
      invalidateSupabaseCache();
    }
  }
  return fbCreateObra({ ...o });
}

// ─── OBRAS — LIST ────────────────────────────────────────────────────

export async function listObrasStore(): Promise<Obra[]> {
  if (await supabaseReady()) {
    try {
      const { data, error } = await supabase
        .from("obras")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(rowToObra);
    } catch (err) {
      console.warn("Supabase listObras falhou, a usar Firebase:", err);
      invalidateSupabaseCache();
    }
  }
  return fbListObras();
}

// ─── OBRAS — UPDATE (inclui Terminar Obra) ───────────────────────────

export async function updateObraStore(id: string, patch: Partial<Obra>): Promise<void> {
  if (await supabaseReady()) {
    try {
      const upd: {
        status?: string;
        nome?: string;
        descricao?: string | null;
        terminated_at?: string | null;
      } = {};
      if (patch.status !== undefined) upd.status = patch.status;
      if (patch.descricao !== undefined) upd.descricao = patch.descricao ?? null;
      if (patch.nome !== undefined) upd.nome = patch.nome;
      if (patch.terminated_at !== undefined)
        upd.terminated_at = patch.terminated_at
          ? new Date(patch.terminated_at).toISOString()
          : null;

      if (Object.keys(upd).length) {
        const { error } = await supabase.from("obras").update(upd).eq("id", id);
        if (error) throw error;
      }
      fbUpdateObra(id, patch).catch(() => {});
      return;
    } catch (err) {
      console.warn("Supabase updateObra falhou, a usar Firebase:", err);
      invalidateSupabaseCache();
    }
  }
  await fbUpdateObra(id, patch);
}

// ─── OBRAS — DELETE ──────────────────────────────────────────────────

export async function deleteObraStore(id: string): Promise<void> {
  if (await supabaseReady()) {
    try {
      const { error } = await supabase.from("obras").delete().eq("id", id);
      if (error) throw error;
      firebaseRemoveObra(id).catch(() => {});
      return;
    } catch (err) {
      console.warn("Supabase deleteObra falhou:", err);
      invalidateSupabaseCache();
    }
  }
  await firebaseRemoveObra(id);
}

// ─── CREATE CHECKLIST ────────────────────────────────────────────────

export async function createChecklistStore(c: Omit<Checklist, "id">): Promise<string> {
  if (await supabaseReady()) {
    try {
      const { data: row, error } = await supabase
        .from("checklists")
        .insert({
          codigo_at: c.codigo_at || null,
          numero_guia: c.numero_guia || null,
          data_documento: c.data_documento || null,
          data_carga: c.data_carga || null,
          hora_carga: c.hora_carga || null,
          observacoes_renato: c.observacoes_renato || null,
          status: c.status,
          created_by: c.created_by || null,
          obra_id: c.obra_id || null,
          tipo_guia: c.tipo_guia || "transporte",
          pdf_name: c.pdf_name || null,
          pdf_metadata: c.pdf_metadata ? (c.pdf_metadata as any) : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const id = row.id as string;

      if (c.items?.length) {
        const payload = c.items.map((it, idx) => ({
          checklist_id: id,
          artigo: it.artigo,
          descricao: it.descricao,
          quantidade: it.quantidade,
          unidade: it.unidade,
          checked: !!it.checked,
          position: idx,
        }));
        const { error: e2 } = await supabase.from("checklist_items").insert(payload);
        if (e2) throw e2;
      }

      fbCreate({ ...c }).catch((e) => console.warn("Firebase mirror falhou:", e));
      return id;
    } catch (err) {
      console.warn("Supabase create falhou, a usar Firebase:", err);
      invalidateSupabaseCache();
    }
  }
  return fbCreate({ ...c });
}

// ─── READ (single) ───────────────────────────────────────────────────

export async function getChecklistStore(id: string): Promise<Checklist | null> {
  if (await supabaseReady()) {
    try {
      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: items } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("checklist_id", id)
        .order("position", { ascending: true });

      // Carregar nome da obra se existir obra_id
      let obra_nome: string | undefined;
      if (data.obra_id) {
        const { data: obra } = await supabase
          .from("obras")
          .select("nome")
          .eq("id", data.obra_id)
          .maybeSingle();
        obra_nome = obra?.nome;
      }

      return rowToChecklist(data, items ?? [], obra_nome);
    } catch (err) {
      console.warn("Supabase get falhou, a usar Firebase:", err);
      invalidateSupabaseCache();
    }
  }
  return fbGet(id);
}

// ─── LIST ────────────────────────────────────────────────────────────

export async function listChecklistsStore(obraId?: string): Promise<Checklist[]> {
  if (await supabaseReady()) {
    try {
      let query = supabase.from("checklists").select("*").order("created_at", { ascending: false });
      if (obraId) query = query.eq("obra_id", obraId) as typeof query;
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((r) => rowToChecklist(r, []));
    } catch (err) {
      console.warn("Supabase list falhou, a usar Firebase:", err);
      invalidateSupabaseCache();
    }
  }
  const all = await fbList();
  return obraId ? all.filter((c) => c.obra_id === obraId) : all;
}

// ─── UPDATE ──────────────────────────────────────────────────────────

export async function updateChecklistStore(id: string, patch: Partial<Checklist>) {
  if (await supabaseReady()) {
    try {
      const upd: {
        status?: string;
        responsavel?: string | null;
        observacoes_colaborador?: string | null;
        observacoes_renato?: string | null;
        submitted_at?: string | null;
      } = {};
      if (patch.status !== undefined) upd.status = patch.status;
      if (patch.responsavel !== undefined) upd.responsavel = patch.responsavel ?? null;
      if (patch.observacoes_colaborador !== undefined)
        upd.observacoes_colaborador = patch.observacoes_colaborador ?? null;
      if (patch.observacoes_renato !== undefined)
        upd.observacoes_renato = patch.observacoes_renato ?? null;
      if (patch.submitted_at !== undefined)
        upd.submitted_at = patch.submitted_at ? new Date(patch.submitted_at).toISOString() : null;

      if (Object.keys(upd).length) {
        const { error } = await supabase.from("checklists").update(upd).eq("id", id);
        if (error) throw error;
      }

      if (patch.items) {
        for (let i = 0; i < patch.items.length; i++) {
          const it = patch.items[i];
          await supabase
            .from("checklist_items")
            .update({ checked: !!it.checked })
            .eq("checklist_id", id)
            .eq("position", i);
        }
      }

      fbUpdate(id, patch).catch(() => {});
      return;
    } catch (err) {
      console.warn("Supabase update falhou, a usar Firebase:", err);
      invalidateSupabaseCache();
    }
  }
  await fbUpdate(id, patch);
}

// ─── DELETE (single) ─────────────────────────────────────────────────

export async function deleteChecklistStore(id: string): Promise<void> {
  if (await supabaseReady()) {
    try {
      await supabase.from("checklist_items").delete().eq("checklist_id", id);
      const { error } = await supabase.from("checklists").delete().eq("id", id);
      if (error) throw error;
      firebaseRemoveChecklist(id).catch(() => {});
      return;
    } catch (err) {
      console.warn("Supabase delete falhou, a usar Firebase:", err);
      invalidateSupabaseCache();
    }
  }
  await firebaseRemoveChecklist(id);
}

// ─── DELETE ALL ──────────────────────────────────────────────────────

export async function deleteAllChecklistsStore(): Promise<void> {
  if (await supabaseReady()) {
    try {
      const { data } = await supabase.from("checklists").select("id");
      if (data) {
        for (const row of data) {
          await deleteChecklistStore(row.id);
        }
      }
      return;
    } catch (err) {
      console.warn("Supabase deleteAll falhou, a usar Firebase:", err);
      invalidateSupabaseCache();
    }
  }
  try {
    const { ref, remove } = await import("firebase/database");
    await remove(ref(fbDb, "checklists"));
  } catch {}
}

// ─── LOG USER ────────────────────────────────────────────────────────

export async function logUserStore(name: string, phone: string) {
  if (await supabaseReady()) {
    try {
      const { error } = await supabase.from("app_users").insert({ name, phone });
      if (error) throw error;
      fbLogUser(name, phone).catch(() => {});
      return;
    } catch (err) {
      console.warn("Supabase logUser falhou, a usar Firebase:", err);
      invalidateSupabaseCache();
    }
  }
  await fbLogUser(name, phone);
}

// ─── Helpers internos ────────────────────────────────────────────────

async function firebaseRemoveChecklist(id: string) {
  const { ref, remove } = await import("firebase/database");
  await remove(ref(fbDb, `checklists/${id}`));
}

async function firebaseRemoveObra(id: string) {
  const { ref, remove } = await import("firebase/database");
  await remove(ref(fbDb, `obras/${id}`));
}

function rowToObra(r: Record<string, any>): Obra {
  return {
    id: r.id,
    nome: r.nome ?? "",
    descricao: r.descricao ?? undefined,
    status: (r.status as "ativa" | "terminada") ?? "ativa",
    created_by: r.created_by ?? undefined,
    terminated_at: r.terminated_at ? new Date(r.terminated_at).getTime() : undefined,
    created_at: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  };
}

function rowToChecklist(
  r: Record<string, any>,
  items: any[],
  obra_nome?: string,
): Checklist {
  return {
    id: r.id,
    codigo_at: r.codigo_at ?? "",
    numero_guia: r.numero_guia ?? "",
    data_documento: r.data_documento ?? "",
    data_carga: r.data_carga ?? "",
    hora_carga: r.hora_carga ?? "",
    observacoes_renato: r.observacoes_renato ?? "",
    status: (r.status as "pendente" | "concluida") ?? "pendente",
    created_at: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    created_by: r.created_by ?? undefined,
    responsavel: r.responsavel ?? undefined,
    observacoes_colaborador: r.observacoes_colaborador ?? undefined,
    submitted_at: r.submitted_at ? new Date(r.submitted_at).getTime() : undefined,
    obra_id: r.obra_id ?? undefined,
    obra_nome: obra_nome ?? undefined,
    tipo_guia: (r.tipo_guia as "transporte" | "devolucao") ?? "transporte",
    pdf_name: r.pdf_name ?? undefined,
    pdf_metadata: r.pdf_metadata ?? undefined,
    items: items.map((it) => ({
      artigo: it.artigo ?? "",
      descricao: it.descricao ?? "",
      quantidade: it.quantidade ?? "",
      unidade: it.unidade ?? "",
      checked: !!it.checked,
    })),
  };
}
