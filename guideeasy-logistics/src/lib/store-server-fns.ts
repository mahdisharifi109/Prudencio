// ─── Store Server Functions ───────────────────────────────────────────
// Todas as operações de base de dados (Drizzle ORM + Neon PostgreSQL)
// envolvidas em createServerFn para garantir execução no servidor.
//
// IMPORTANTE: Nunca importe este ficheiro de forma lazy — o TanStack Start
// trata automaticamente do RPC entre cliente e servidor.

import { createServerFn } from "@tanstack/react-start";
import type { Checklist, ChecklistItem, PdfMetadata, Obra } from "./types";

export type { Checklist, ChecklistItem, PdfMetadata, Obra };

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

// ═══════════════════════════════════════════════════════════════
// OBRAS
// ═══════════════════════════════════════════════════════════════

export const listObrasStore = createServerFn({ method: "GET" }).handler(
  async () => {
    const { listObrasStore: fn } = await import("./store");
    return fn();
  },
);

export const getObraStore = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getObraStore: fn } = await import("./store");
    return fn(id);
  });

export const createObraStore = createServerFn({ method: "POST" })
  .inputValidator((o: Omit<Obra, "id">) => o)
  .handler(async ({ data }) => {
    const { createObraStore: fn } = await import("./store");
    return fn(data);
  });

export const updateObraStore = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; patch: Partial<Obra> }) => d)
  .handler(async ({ data }) => {
    const { updateObraStore: fn } = await import("./store");
    return fn(data.id, data.patch);
  });

export const deleteObraStore = createServerFn({ method: "POST" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { deleteObraStore: fn } = await import("./store");
    return fn(id);
  });

// ═══════════════════════════════════════════════════════════════
// CHECKLISTS
// ═══════════════════════════════════════════════════════════════

export const listChecklistsStore = createServerFn({ method: "GET" })
  .inputValidator((obraId?: string) => obraId)
  .handler(async ({ data: obraId }) => {
    const { listChecklistsStore: fn } = await import("./store");
    return fn(obraId ?? undefined);
  });

export const listChecklistsWithItemsStore = createServerFn({ method: "GET" })
  .inputValidator((obraId: string) => obraId)
  .handler(async ({ data: obraId }) => {
    const { listChecklistsWithItemsStore: fn } = await import("./store");
    return fn(obraId);
  });

export const getChecklistStore = createServerFn({ method: "GET" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getChecklistStore: fn } = await import("./store");
    return fn(id);
  });

export const createChecklistStore = createServerFn({ method: "POST" })
  .inputValidator((c: Omit<Checklist, "id">) => c)
  .handler(async ({ data }) => {
    const { createChecklistStore: fn } = await import("./store");
    return fn(data);
  });

export const updateChecklistStore = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; patch: Partial<Checklist> }) => d)
  .handler(async ({ data }) => {
    const { updateChecklistStore: fn } = await import("./store");
    return fn(data.id, data.patch);
  });

export const deleteChecklistStore = createServerFn({ method: "POST" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { deleteChecklistStore: fn } = await import("./store");
    return fn(id);
  });

export const deleteAllChecklistsStore = createServerFn({ method: "POST" }).handler(async () => {
  const { deleteAllChecklistsStore: fn } = await import("./store");
  return fn();
});

// ═══════════════════════════════════════════════════════════════
// APP USERS
// ═══════════════════════════════════════════════════════════════

export const logUserStore = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; phone: string }) => d)
  .handler(async ({ data }) => {
    const { logUserStore: fn } = await import("./store");
    return fn(data.name, data.phone);
  });

// ═══════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════

export const logActivity = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      action: string;
      entityType: string;
      entityId?: string;
      entityName?: string;
      userEmail?: string;
      userName?: string;
      details?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { logActivity: fn } = await import("./store");
    return fn(
      data.action,
      data.entityType,
      data.entityId,
      data.entityName,
      data.userEmail,
      data.userName,
      data.details,
    );
  });

export const listActivityLogsStore = createServerFn({ method: "GET" }).handler(async () => {
  const { listActivityLogsStore: fn } = await import("./store");
  return fn();
});

export const deleteActivityLogStore = createServerFn({ method: "POST" })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { deleteActivityLogStore: fn } = await import("./store");
    return fn(id);
  });

export const deleteAllActivityLogsStore = createServerFn({ method: "POST" }).handler(async () => {
  const { deleteAllActivityLogsStore: fn } = await import("./store");
  return fn();
});
