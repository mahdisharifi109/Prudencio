// ─── Camada de persistência ──────────────────────────────────────────
// Todas as operações de dados passam por Drizzle ORM + Neon PostgreSQL.
// A autenticação (login/logout/session) continua em server-fns.ts.

import { db } from "./db";
import { checklists, obras, appUsers, activityLog } from "./schema";
import { eq, desc } from "drizzle-orm";
import type { Checklist, ChecklistItem, PdfMetadata, Obra } from "./types";

export type ActivityLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  entity_name?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  details?: string | null;
  created_at: number;
};

export type { Checklist, ChecklistItem, PdfMetadata, Obra };

// ─── OBRAS — CREATE ──────────────────────────────────────────────────

export async function createObraStore(o: Omit<Obra, "id">): Promise<string> {
  const [row] = await db
    .insert(obras)
    .values({
      nome: o.nome,
      descricao: o.descricao,
      status: o.status,
      created_by: o.created_by,
      terminated_at: o.terminated_at,
      created_at: o.created_at || Date.now(),
    })
    .returning({ id: obras.id });
  return row.id;
}

// ─── OBRAS — LIST ────────────────────────────────────────────────────

export async function listObrasStore(): Promise<Obra[]> {
  try {
    const rows = await db.select().from(obras).orderBy(desc(obras.created_at));
    return rows as Obra[];
  } catch (e) {
    console.warn("listObrasStore falhou:", e);
    return [];
  }
}

// ─── OBRAS — GET (single) ────────────────────────────────────────────

export async function getObraStore(id: string): Promise<Obra | null> {
  const [row] = await db.select().from(obras).where(eq(obras.id, id)).limit(1);
  return (row as Obra) || null;
}

// ─── OBRAS — UPDATE (inclui Terminar Obra) ───────────────────────────

export async function updateObraStore(id: string, patch: Partial<Obra>): Promise<void> {
  // Remove 'id' do patch para não tentar atualizar a PK
  const { id: _id, ...updateData } = patch;
  await db.update(obras).set(updateData).where(eq(obras.id, id));
}

// ─── OBRAS — DELETE ──────────────────────────────────────────────────

export async function deleteObraStore(id: string): Promise<void> {
  await db.delete(obras).where(eq(obras.id, id));
}

// ─── CREATE CHECKLIST ────────────────────────────────────────────────

export async function createChecklistStore(c: Omit<Checklist, "id">): Promise<string> {
  const [row] = await db
    .insert(checklists)
    .values({
      codigo_at: c.codigo_at,
      observacoes_renato: c.observacoes_renato,
      items: c.items,
      status: c.status,
      created_at: c.created_at || Date.now(),
      created_by: c.created_by,
      responsavel: c.responsavel,
      observacoes_colaborador: c.observacoes_colaborador,
      submitted_at: c.submitted_at,
      data_documento: c.data_documento,
      data_carga: c.data_carga,
      hora_carga: c.hora_carga,
      numero_guia: c.numero_guia,
      pdf_name: c.pdf_name,
      pdf_metadata: c.pdf_metadata,
      obra_id: c.obra_id,
      obra_nome: c.obra_nome,
      tipo_guia: c.tipo_guia,
    })
    .returning({ id: checklists.id });
  return row.id;
}

// ─── READ (single) ───────────────────────────────────────────────────

export async function getChecklistStore(id: string): Promise<Checklist | null> {
  const [row] = await db.select().from(checklists).where(eq(checklists.id, id)).limit(1);
  return (row as Checklist) || null;
}

// ─── LIST ────────────────────────────────────────────────────────────

export async function listChecklistsStore(obraId?: string): Promise<Checklist[]> {
  try {
    let rows;
    if (obraId) {
      rows = await db
        .select()
        .from(checklists)
        .where(eq(checklists.obra_id, obraId))
        .orderBy(desc(checklists.created_at));
    } else {
      rows = await db.select().from(checklists).orderBy(desc(checklists.created_at));
    }
    return rows as Checklist[];
  } catch (e) {
    console.warn("listChecklistsStore falhou:", e);
    return [];
  }
}

// ─── LIST WITH ITEMS (para cálculo de stock) ─────────────────────────

export async function listChecklistsWithItemsStore(obraId: string): Promise<Checklist[]> {
  try {
    const rows = await db
      .select()
      .from(checklists)
      .where(eq(checklists.obra_id, obraId))
      .orderBy(desc(checklists.created_at));
    return rows as Checklist[];
  } catch (e) {
    console.warn("listChecklistsWithItemsStore falhou:", e);
    return [];
  }
}

// ─── UPDATE ──────────────────────────────────────────────────────────

export async function updateChecklistStore(id: string, patch: Partial<Checklist>) {
  // Remove 'id' do patch para não tentar atualizar a PK
  const { id: _id, ...updateData } = patch;
  await db.update(checklists).set(updateData).where(eq(checklists.id, id));
}

// ─── DELETE (single) ─────────────────────────────────────────────────

export async function deleteChecklistStore(id: string): Promise<void> {
  await db.delete(checklists).where(eq(checklists.id, id));
}

// ─── DELETE ALL ──────────────────────────────────────────────────────

export async function deleteAllChecklistsStore(): Promise<void> {
  await db.delete(checklists);
}

// ─── LOG USER ────────────────────────────────────────────────────────

export async function logUserStore(name: string, phone: string): Promise<void> {
  try {
    await db.insert(appUsers).values({
      name,
      phone,
      created_at: Date.now(),
    });
  } catch (e) {
    console.warn("logUserStore falhou:", e);
  }
}

// ─── ACTIVITY LOG (Histórico) ────────────────────────────────────────

export async function logActivity(
  action: string,
  entityType: string,
  entityId?: string,
  entityName?: string,
  userEmail?: string,
  userName?: string,
  details?: string,
): Promise<void> {
  try {
    await db.insert(activityLog).values({
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      user_email: userEmail,
      user_name: userName,
      details,
      created_at: Date.now(),
    });
  } catch (e) {
    console.warn("logActivity falhou:", e);
  }
}

export async function listActivityLogsStore(): Promise<ActivityLog[]> {
  try {
    const rows = await db.select().from(activityLog).orderBy(desc(activityLog.created_at));
    return rows as ActivityLog[];
  } catch (e) {
    console.warn("listActivityLogsStore falhou:", e);
    return [];
  }
}

export async function deleteActivityLogStore(id: string): Promise<void> {
  await db.delete(activityLog).where(eq(activityLog.id, id));
}

export async function deleteAllActivityLogsStore(): Promise<void> {
  await db.delete(activityLog);
}
