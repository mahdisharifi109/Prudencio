// ─── Camada de persistência ──────────────────────────────────────────
// Todas as operações de dados são executadas no servidor do cliente
// via server functions do TanStack Start. Nenhum dado é enviado
// a serviços externos.

import {
  createChecklistFn,
  getChecklistFn,
  listChecklistsFn,
  listChecklistsWithItemsFn,
  updateChecklistFn,
  deleteChecklistFn,
  deleteAllChecklistsFn,
  createObraFn,
  listObrasFn,
  getObraFn,
  updateObraFn,
  deleteObraFn,
  logUserFn,
} from "./server-fns";
import type { Checklist, ChecklistItem, PdfMetadata, Obra } from "./types";

export type { Checklist, ChecklistItem, PdfMetadata, Obra };

// ─── OBRAS — CREATE ──────────────────────────────────────────────────

export async function createObraStore(o: Omit<Obra, "id">): Promise<string> {
  return createObraFn({
    data: {
      nome: o.nome,
      descricao: o.descricao,
      status: o.status,
      created_by: o.created_by,
    },
  });
}

// ─── OBRAS — LIST ────────────────────────────────────────────────────

export async function listObrasStore(): Promise<Obra[]> {
  return listObrasFn();
}

// ─── OBRAS — GET (single) ────────────────────────────────────────────

export async function getObraStore(id: string): Promise<Obra | null> {
  return getObraFn({ data: { id } });
}

// ─── OBRAS — UPDATE (inclui Terminar Obra) ───────────────────────────

export async function updateObraStore(id: string, patch: Partial<Obra>): Promise<void> {
  await updateObraFn({ data: { id, patch } });
}

// ─── OBRAS — DELETE ──────────────────────────────────────────────────

export async function deleteObraStore(id: string): Promise<void> {
  await deleteObraFn({ data: { id } });
}

// ─── CREATE CHECKLIST ────────────────────────────────────────────────

export async function createChecklistStore(c: Omit<Checklist, "id">): Promise<string> {
  return createChecklistFn({ data: { checklist: c } });
}

// ─── READ (single) ───────────────────────────────────────────────────

export async function getChecklistStore(id: string): Promise<Checklist | null> {
  return getChecklistFn({ data: { id } });
}

// ─── LIST ────────────────────────────────────────────────────────────

export async function listChecklistsStore(obraId?: string): Promise<Checklist[]> {
  return listChecklistsFn({ data: { obraId } });
}

// ─── LIST WITH ITEMS (para cálculo de stock) ─────────────────────────

export async function listChecklistsWithItemsStore(obraId: string): Promise<Checklist[]> {
  return listChecklistsWithItemsFn({ data: { obraId } });
}

// ─── UPDATE ──────────────────────────────────────────────────────────

export async function updateChecklistStore(id: string, patch: Partial<Checklist>) {
  await updateChecklistFn({ data: { id, patch } });
}

// ─── DELETE (single) ─────────────────────────────────────────────────

export async function deleteChecklistStore(id: string): Promise<void> {
  await deleteChecklistFn({ data: { id } });
}

// ─── DELETE ALL ──────────────────────────────────────────────────────

export async function deleteAllChecklistsStore(): Promise<void> {
  await deleteAllChecklistsFn();
}

// ─── LOG USER ────────────────────────────────────────────────────────

export async function logUserStore(name: string, phone: string): Promise<void> {
  await logUserFn({ data: { name, phone } });
}
