// ─── Camada de persistência ──────────────────────────────────────────
// Suporta a base de dados SQL (via Server Functions do TanStack Start)
// ou a base de dados Firebase Realtime Database cliente.
// O comportamento é selecionado via VITE_USE_FIREBASE.

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

function useFirebase(): boolean {
  return import.meta.env.VITE_USE_FIREBASE === "true";
}

// Lazy import do Firebase — só carrega quando VITE_USE_FIREBASE=true
// Evita o crash "Firebase: Error (auth/invalid-api-key)" quando o Firebase não está configurado
async function getFb() {
  return import("./firebase");
}

// ─── OBRAS — CREATE ──────────────────────────────────────────────────

export async function createObraStore(o: Omit<Obra, "id">): Promise<string> {
  if (useFirebase()) {
    const fb = await getFb();
    return fb.createObra(o);
  }
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
  if (useFirebase()) {
    const fb = await getFb();
    return fb.listObras();
  }
  return listObrasFn();
}

// ─── OBRAS — GET (single) ────────────────────────────────────────────

export async function getObraStore(id: string): Promise<Obra | null> {
  if (useFirebase()) {
    const fb = await getFb();
    return fb.getObra(id);
  }
  return getObraFn({ data: { id } });
}

// ─── OBRAS — UPDATE (inclui Terminar Obra) ───────────────────────────

export async function updateObraStore(id: string, patch: Partial<Obra>): Promise<void> {
  if (useFirebase()) {
    const fb = await getFb();
    await fb.updateObra(id, patch);
    return;
  }
  await updateObraFn({ data: { id, patch } });
}

// ─── OBRAS — DELETE ──────────────────────────────────────────────────

export async function deleteObraStore(id: string): Promise<void> {
  if (useFirebase()) {
    const fb = await getFb();
    await fb.deleteObra(id);
    return;
  }
  await deleteObraFn({ data: { id } });
}

// ─── CREATE CHECKLIST ────────────────────────────────────────────────

export async function createChecklistStore(c: Omit<Checklist, "id">): Promise<string> {
  if (useFirebase()) {
    const fb = await getFb();
    return fb.createChecklist(c);
  }
  return createChecklistFn({ data: { checklist: c } });
}

// ─── READ (single) ───────────────────────────────────────────────────

export async function getChecklistStore(id: string): Promise<Checklist | null> {
  if (useFirebase()) {
    const fb = await getFb();
    return fb.getChecklist(id);
  }
  return getChecklistFn({ data: { id } });
}

// ─── LIST ────────────────────────────────────────────────────────────

export async function listChecklistsStore(obraId?: string): Promise<Checklist[]> {
  if (useFirebase()) {
    const fb = await getFb();
    const all = await fb.listChecklists();
    return obraId ? all.filter((c) => c.obra_id === obraId) : all;
  }
  return listChecklistsFn({ data: { obraId } });
}

// ─── LIST WITH ITEMS (para cálculo de stock) ─────────────────────────

export async function listChecklistsWithItemsStore(obraId: string): Promise<Checklist[]> {
  if (useFirebase()) {
    const fb = await getFb();
    const all = await fb.listChecklists();
    return all.filter((c) => c.obra_id === obraId);
  }
  return listChecklistsWithItemsFn({ data: { obraId } });
}

// ─── UPDATE ──────────────────────────────────────────────────────────

export async function updateChecklistStore(id: string, patch: Partial<Checklist>) {
  if (useFirebase()) {
    const fb = await getFb();
    await fb.updateChecklist(id, patch);
    return;
  }
  await updateChecklistFn({ data: { id, patch } });
}

// ─── DELETE (single) ─────────────────────────────────────────────────

export async function deleteChecklistStore(id: string): Promise<void> {
  if (useFirebase()) {
    const fb = await getFb();
    await fb.deleteChecklist(id);
    return;
  }
  await deleteChecklistFn({ data: { id } });
}

// ─── DELETE ALL ──────────────────────────────────────────────────────

export async function deleteAllChecklistsStore(): Promise<void> {
  if (useFirebase()) {
    const fb = await getFb();
    await fb.deleteAllChecklists();
    return;
  }
  await deleteAllChecklistsFn();
}

// ─── LOG USER ────────────────────────────────────────────────────────

export async function logUserStore(name: string, phone: string): Promise<void> {
  if (useFirebase()) {
    const fb = await getFb();
    await fb.logUser(name, phone);
    return;
  }
  await logUserFn({ data: { name, phone } });
}
