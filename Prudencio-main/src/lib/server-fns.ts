/* eslint-disable @typescript-eslint/no-explicit-any */
// ─── Server Functions ────────────────────────────────────────────────
// Todas as operações de autenticação e CRUD executadas no servidor.
// Estas funções são chamadas via RPC pelo TanStack Start — o código
// dentro dos handlers nunca chega ao browser.
//
// A conexão à BD é carregada dinamicamente (import()) para garantir
// que o código server-only (knex, bcrypt, jwt) não é incluído no
// bundle do cliente.

import { createServerFn } from "@tanstack/react-start";
import type { Checklist, ChecklistItem, Obra, UserProfile, UserRole, PdfMetadata } from "./types";

// ═══════════════════════════════════════════════════════════════
// CONSTANTES E HELPERS INTERNOS
// ═══════════════════════════════════════════════════════════════

const COOKIE_NAME = "guideeasy_session";
const TOKEN_EXPIRY = "7d";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not defined!");
    }
    return "CHANGE_ME_IN_DEVELOPMENT_ONLY";
  }
  return secret;
}

// ─── Cookie / JWT helpers ────────────────────────────────────────────

async function getSessionFromRequest(): Promise<UserProfile | null> {
  try {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(COOKIE_NAME);
    if (!token) return null;

    const tokenStr = decodeURIComponent(token);
    const jwt = (await import("jsonwebtoken")).default;

    const payload = jwt.verify(tokenStr, jwtSecret()) as {
      userId: string;
      email: string;
      name: string;
      role: UserRole;
    };

    return {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

async function requireSession(): Promise<UserProfile> {
  const session = await getSessionFromRequest();
  if (!session) throw new Error("Não autenticado");
  return session;
}

async function setAuthCookie(token: string, maxAge: number): Promise<void> {
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  } catch (err) {
    console.warn("[auth] Não foi possível definir cookie:", err);
  }
}

async function clearAuthCookie(): Promise<void> {
  try {
    const { deleteCookie } = await import("@tanstack/react-start/server");
    deleteCookie(COOKIE_NAME, {
      path: "/",
    });
  } catch (err) {
    console.warn("[auth] Não foi possível limpar cookie:", err);
  }
}

// ─── Row mappers ─────────────────────────────────────────────────────

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

function rowToChecklist(r: Record<string, any>, items: any[], obra_nome?: string): Checklist {
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
    pdf_metadata:
      typeof r.pdf_metadata === "string"
        ? JSON.parse(r.pdf_metadata)
        : (r.pdf_metadata ?? undefined),
    items: items.map((it) => ({
      artigo: it.artigo ?? "",
      descricao: it.descricao ?? "",
      quantidade: it.quantidade ?? "",
      unidade: it.unidade ?? "",
      checked: !!it.checked,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════
// AUTENTICAÇÃO
// ═══════════════════════════════════════════════════════════════

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    try {
      const { getDb } = await import("./db.server");
      const bcrypt = (await import("bcryptjs")).default;
      const jwt = (await import("jsonwebtoken")).default;

      const db = getDb();
      const user = await db("users").where("email", data.email.toLowerCase().trim()).first();

      if (!user) throw new Error("Email ou password incorretos");

      const valid = await bcrypt.compare(data.password, user.password_hash);
      if (!valid) throw new Error("Email ou password incorretos");

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        jwtSecret(),
        { expiresIn: TOKEN_EXPIRY },
      );

      await setAuthCookie(token, COOKIE_MAX_AGE);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
      } satisfies UserProfile;
    } catch (err: any) {
      console.error("[loginFn Error Server-Side]:", err);
      throw new Error(err.message || "Erro de servidor ao fazer login");
    }
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await clearAuthCookie();
  return { ok: true };
});

export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  return getSessionFromRequest();
});

// ═══════════════════════════════════════════════════════════════
// OBRAS — CREATE
// ═══════════════════════════════════════════════════════════════

export const createObraFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { nome: string; descricao?: string; status?: string; created_by?: string }) => d,
  )
  .handler(async ({ data }) => {
    await requireSession();
    const { getDb } = await import("./db.server");
    const db = getDb();
    const id = crypto.randomUUID();
    await db("obras").insert({
      id,
      nome: data.nome,
      descricao: data.descricao || null,
      status: data.status || "ativa",
      created_by: data.created_by || null,
    });
    return id;
  });

// ═══════════════════════════════════════════════════════════════
// OBRAS — LIST
// ═══════════════════════════════════════════════════════════════

export const listObrasFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { getDb } = await import("./db.server");
  const db = getDb();
  const rows = await db("obras").select("*").orderBy("created_at", "desc");
  return rows.map(rowToObra);
});

// ═══════════════════════════════════════════════════════════════
// OBRAS — GET (single)
// ═══════════════════════════════════════════════════════════════

export const getObraFn = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireSession();
    const { getDb } = await import("./db.server");
    const db = getDb();
    const row = await db("obras").where("id", data.id).first();
    return row ? rowToObra(row) : null;
  });

// ═══════════════════════════════════════════════════════════════
// OBRAS — UPDATE
// ═══════════════════════════════════════════════════════════════

export const updateObraFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      patch: Partial<{
        status: string;
        nome: string;
        descricao: string | null;
        terminated_at: number | null;
      }>;
    }) => d,
  )
  .handler(async ({ data }) => {
    await requireSession();
    const { getDb } = await import("./db.server");
    const db = getDb();
    const upd: Record<string, any> = {};

    if (data.patch.status !== undefined) upd.status = data.patch.status;
    if (data.patch.nome !== undefined) upd.nome = data.patch.nome;
    if (data.patch.descricao !== undefined) upd.descricao = data.patch.descricao;
    if (data.patch.terminated_at !== undefined)
      upd.terminated_at = data.patch.terminated_at
        ? new Date(data.patch.terminated_at).toISOString()
        : null;

    if (Object.keys(upd).length) {
      await db("obras").where("id", data.id).update(upd);
    }
  });

// ═══════════════════════════════════════════════════════════════
// OBRAS — DELETE
// ═══════════════════════════════════════════════════════════════

export const deleteObraFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireSession();
    const { getDb } = await import("./db.server");
    const db = getDb();
    await db("obras").where("id", data.id).delete();
  });

// ═══════════════════════════════════════════════════════════════
// CHECKLISTS — CREATE
// ═══════════════════════════════════════════════════════════════

export const createChecklistFn = createServerFn({ method: "POST" })
  .inputValidator((d: { checklist: Omit<Checklist, "id"> }) => d)
  .handler(async ({ data }) => {
    await requireSession();
    const { getDb } = await import("./db.server");
    const db = getDb();
    const c = data.checklist;
    const id = crypto.randomUUID();

    await db("checklists").insert({
      id,
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
      pdf_metadata: c.pdf_metadata ? JSON.stringify(c.pdf_metadata) : null,
    });

    if (c.items?.length) {
      const itemRows = c.items.map((it, idx) => ({
        id: crypto.randomUUID(),
        checklist_id: id,
        artigo: it.artigo,
        descricao: it.descricao,
        quantidade: it.quantidade,
        unidade: it.unidade,
        checked: !!it.checked,
        position: idx,
      }));
      await db("checklist_items").insert(itemRows);
    }

    return id;
  });

// ═══════════════════════════════════════════════════════════════
// CHECKLISTS — GET (single, com items)
// ═══════════════════════════════════════════════════════════════

export const getChecklistFn = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireSession();
    const { getDb } = await import("./db.server");
    const db = getDb();

    const row = await db("checklists").where("id", data.id).first();
    if (!row) return null;

    const items = await db("checklist_items")
      .where("checklist_id", data.id)
      .orderBy("position", "asc");

    let obra_nome: string | undefined;
    if (row.obra_id) {
      const obra = await db("obras").where("id", row.obra_id).select("nome").first();
      obra_nome = obra?.nome;
    }

    return rowToChecklist(row, items, obra_nome);
  });

// ═══════════════════════════════════════════════════════════════
// CHECKLISTS — LIST
// ═══════════════════════════════════════════════════════════════

export const listChecklistsFn = createServerFn({ method: "GET" })
  .inputValidator((d?: { obraId?: string }) => d ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const { getDb } = await import("./db.server");
    const db = getDb();

    let query = db("checklists").select("*").orderBy("created_at", "desc");
    if (data?.obraId) query = query.where("obra_id", data.obraId);

    const rows = await query;
    return rows.map((r: any) => rowToChecklist(r, []));
  });

// ═══════════════════════════════════════════════════════════════
// CHECKLISTS — LIST WITH ITEMS (para cálculo de stock)
// ═══════════════════════════════════════════════════════════════

export const listChecklistsWithItemsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { obraId: string }) => d)
  .handler(async ({ data }) => {
    await requireSession();
    const { getDb } = await import("./db.server");
    const db = getDb();

    const rows = await db("checklists")
      .where("obra_id", data.obraId)
      .select("*")
      .orderBy("created_at", "desc");

    if (!rows.length) return [] as Checklist[];

    const ids = rows.map((r: any) => r.id);
    const allItems = await db("checklist_items")
      .whereIn("checklist_id", ids)
      .orderBy("position", "asc");

    const itemsByChecklist = new Map<string, any[]>();
    for (const it of allItems) {
      const arr = itemsByChecklist.get(it.checklist_id) ?? [];
      arr.push(it);
      itemsByChecklist.set(it.checklist_id, arr);
    }

    return rows.map((r: any) => rowToChecklist(r, itemsByChecklist.get(r.id) ?? []));
  });

// ═══════════════════════════════════════════════════════════════
// CHECKLISTS — UPDATE
// ═══════════════════════════════════════════════════════════════

export const updateChecklistFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; patch: Partial<Checklist> }) => d)
  .handler(async ({ data }) => {
    await requireSession();
    const { getDb } = await import("./db.server");
    const db = getDb();

    const upd: Record<string, any> = {};
    if (data.patch.status !== undefined) upd.status = data.patch.status;
    if (data.patch.responsavel !== undefined) upd.responsavel = data.patch.responsavel ?? null;
    if (data.patch.observacoes_colaborador !== undefined)
      upd.observacoes_colaborador = data.patch.observacoes_colaborador ?? null;
    if (data.patch.observacoes_renato !== undefined)
      upd.observacoes_renato = data.patch.observacoes_renato ?? null;
    if (data.patch.submitted_at !== undefined)
      upd.submitted_at = data.patch.submitted_at
        ? new Date(data.patch.submitted_at).toISOString()
        : null;

    if (Object.keys(upd).length) {
      await db("checklists").where("id", data.id).update(upd);
    }

    if (data.patch.items) {
      for (let i = 0; i < data.patch.items.length; i++) {
        const it = data.patch.items[i];
        await db("checklist_items")
          .where("checklist_id", data.id)
          .where("position", i)
          .update({ checked: !!it.checked });
      }
    }
  });

// ═══════════════════════════════════════════════════════════════
// CHECKLISTS — DELETE (single)
// ═══════════════════════════════════════════════════════════════

export const deleteChecklistFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireSession();
    const { getDb } = await import("./db.server");
    const db = getDb();
    await db("checklist_items").where("checklist_id", data.id).delete();
    await db("checklists").where("id", data.id).delete();
  });

// ═══════════════════════════════════════════════════════════════
// CHECKLISTS — DELETE ALL
// ═══════════════════════════════════════════════════════════════

export const deleteAllChecklistsFn = createServerFn({
  method: "POST",
}).handler(async () => {
  await requireSession();
  const { getDb } = await import("./db.server");
  const db = getDb();
  await db("checklist_items").delete();
  await db("checklists").delete();
});

// ═══════════════════════════════════════════════════════════════
// MISC — LOG USER
// ═══════════════════════════════════════════════════════════════

export const logUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; phone: string }) => d)
  .handler(async ({ data }) => {
    await requireSession();
    const { getDb } = await import("./db.server");
    const db = getDb();
    await db("app_users").insert({
      id: crypto.randomUUID(),
      name: data.name,
      phone: data.phone || null,
    });
  });
