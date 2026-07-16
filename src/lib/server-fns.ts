/* eslint-disable @typescript-eslint/no-explicit-any */
// ─── Server Functions (Firestore Edition) ───────────────────────────
// Todas as operações de autenticação e CRUD executadas no servidor.
// Estas funções são chamadas via RPC pelo TanStack Start — o código
// dentro dos handlers nunca chega ao browser.
//
// A conexão à BD usa o Firebase Admin SDK (firestore) no servidor.

import { createServerFn } from "@tanstack/react-start";
import type { Checklist, ChecklistItem, Obra, UserProfile, UserRole } from "./types";
import { randomUUID } from "crypto";
import type admin from "firebase-admin";

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
      const usersColl = db.collection("users");
      const userSnap = await usersColl.where("email", "==", data.email.toLowerCase().trim()).limit(1).get();

      if (userSnap.empty) throw new Error("Email ou password incorretos");

      const userDoc = userSnap.docs[0];
      const user = userDoc.data();

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
    const id = randomUUID();
    
    await db.collection("obras").doc(id).set({
      id,
      nome: data.nome,
      descricao: data.descricao || null,
      status: data.status || "ativa",
      created_by: data.created_by || null,
      created_at: Date.now(),
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
  const snapshot = await db.collection("obras").orderBy("created_at", "desc").get();
  
  return snapshot.docs
    .filter((doc) => doc.id !== "placeholder")
    .map((doc) => {
      const r = doc.data();
      return {
        id: r.id,
        nome: r.nome || "",
        descricao: r.descricao || undefined,
        status: (r.status as "ativa" | "terminada") || "ativa",
        created_by: r.created_by || undefined,
        terminated_at: r.terminated_at || undefined,
        created_at: r.created_at || Date.now(),
      };
    });
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
    const doc = await db.collection("obras").doc(data.id).get();
    
    if (!doc.exists) return null;
    const r = doc.data()!;
    return {
      id: r.id,
      nome: r.nome || "",
      descricao: r.descricao || undefined,
      status: (r.status as "ativa" | "terminada") || "ativa",
      created_by: r.created_by || undefined,
      terminated_at: r.terminated_at || undefined,
      created_at: r.created_at || Date.now(),
    };
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
    if (data.patch.terminated_at !== undefined) upd.terminated_at = data.patch.terminated_at || null;

    if (Object.keys(upd).length) {
      await db.collection("obras").doc(data.id).update(upd);
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
    await db.collection("obras").doc(data.id).delete();
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
    const id = randomUUID();

    const items = c.items?.map((it, idx) => ({
      artigo: it.artigo || "",
      descricao: it.descricao || "",
      quantidade: it.quantidade || "",
      unidade: it.unidade || "",
      checked: !!it.checked,
      position: idx,
    })) || [];

    await db.collection("checklists").doc(id).set({
      id,
      codigo_at: c.codigo_at || null,
      numero_guia: c.numero_guia || null,
      data_documento: c.data_documento || null,
      data_carga: c.data_carga || null,
      hora_carga: c.hora_carga || null,
      observacoes_renato: c.observacoes_renato || null,
      status: c.status || "pendente",
      created_by: c.created_by || null,
      obra_id: c.obra_id || null,
      tipo_guia: c.tipo_guia || "transporte",
      pdf_name: c.pdf_name || null,
      pdf_metadata: c.pdf_metadata || null,
      created_at: Date.now(),
      items,
    });

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

    const doc = await db.collection("checklists").doc(data.id).get();
    if (!doc.exists) return null;
    const r = doc.data()!;

    let obra_nome: string | undefined;
    if (r.obra_id) {
      const obraDoc = await db.collection("obras").doc(r.obra_id).get();
      if (obraDoc.exists) {
        obra_nome = obraDoc.data()?.nome;
      }
    }

    const items = r.items || [];
    return {
      id: r.id,
      codigo_at: r.codigo_at || "",
      numero_guia: r.numero_guia || "",
      data_documento: r.data_documento || "",
      data_carga: r.data_carga || "",
      hora_carga: r.hora_carga || "",
      observacoes_renato: r.observacoes_renato || "",
      status: (r.status as "pendente" | "concluida") || "pendente",
      created_at: r.created_at || Date.now(),
      created_by: r.created_by || undefined,
      responsavel: r.responsavel || undefined,
      observacoes_colaborador: r.observacoes_colaborador || undefined,
      submitted_at: r.submitted_at || undefined,
      obra_id: r.obra_id || undefined,
      obra_nome,
      tipo_guia: (r.tipo_guia as "transporte" | "devolucao") || "transporte",
      pdf_name: r.pdf_name || undefined,
      pdf_metadata: r.pdf_metadata || undefined,
      items: items.map((it: any) => ({
        artigo: it.artigo || "",
        descricao: it.descricao || "",
        quantidade: it.quantidade || "",
        unidade: it.unidade || "",
        checked: !!it.checked,
      })),
    } satisfies Checklist;
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

    let query: admin.firestore.Query = db.collection("checklists");
    if (data?.obraId) {
      query = query.where("obra_id", "==", data.obraId);
    }
    query = query.orderBy("created_at", "desc");

    const snapshot = await query.get();
    return snapshot.docs
      .filter((doc: admin.firestore.QueryDocumentSnapshot) => doc.id !== "placeholder")
      .map((doc: admin.firestore.QueryDocumentSnapshot) => {
        const r = doc.data();
        const items = r.items || [];
        return {
          id: r.id,
          codigo_at: r.codigo_at || "",
          numero_guia: r.numero_guia || "",
          data_documento: r.data_documento || "",
          data_carga: r.data_carga || "",
          hora_carga: r.hora_carga || "",
          observacoes_renato: r.observacoes_renato || "",
          status: (r.status as "pendente" | "concluida") || "pendente",
          created_at: r.created_at || Date.now(),
          created_by: r.created_by || undefined,
          responsavel: r.responsavel || undefined,
          observacoes_colaborador: r.observacoes_colaborador || undefined,
          submitted_at: r.submitted_at || undefined,
          obra_id: r.obra_id || undefined,
          tipo_guia: (r.tipo_guia as "transporte" | "devolucao") || "transporte",
          pdf_name: r.pdf_name || undefined,
          pdf_metadata: r.pdf_metadata || undefined,
          items: items.map((it: any) => ({
            artigo: it.artigo || "",
            descricao: it.descricao || "",
            quantidade: it.quantidade || "",
            unidade: it.unidade || "",
            checked: !!it.checked,
          })),
        } satisfies Checklist;
      });
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

    const snapshot = await db
      .collection("checklists")
      .where("obra_id", "==", data.obraId)
      .orderBy("created_at", "desc")
      .get();

    return snapshot.docs
      .filter((doc) => doc.id !== "placeholder")
      .map((doc) => {
        const r = doc.data();
        const items = r.items || [];
        return {
          id: r.id,
          codigo_at: r.codigo_at || "",
          numero_guia: r.numero_guia || "",
          data_documento: r.data_documento || "",
          data_carga: r.data_carga || "",
          hora_carga: r.hora_carga || "",
          observacoes_renato: r.observacoes_renato || "",
          status: (r.status as "pendente" | "concluida") || "pendente",
          created_at: r.created_at || Date.now(),
          created_by: r.created_by || undefined,
          responsavel: r.responsavel || undefined,
          observacoes_colaborador: r.observacoes_colaborador || undefined,
          submitted_at: r.submitted_at || undefined,
          obra_id: r.obra_id || undefined,
          tipo_guia: (r.tipo_guia as "transporte" | "devolucao") || "transporte",
          pdf_name: r.pdf_name || undefined,
          pdf_metadata: r.pdf_metadata || undefined,
          items: items.map((it: any) => ({
            artigo: it.artigo || "",
            descricao: it.descricao || "",
            quantidade: it.quantidade || "",
            unidade: it.unidade || "",
            checked: !!it.checked,
          })),
        } satisfies Checklist;
      });
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

    const docRef = db.collection("checklists").doc(data.id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Checklist não encontrada");

    const r = doc.data()!;
    const upd: Record<string, any> = {};

    if (data.patch.status !== undefined) upd.status = data.patch.status;
    if (data.patch.responsavel !== undefined) upd.responsavel = data.patch.responsavel ?? null;
    if (data.patch.observacoes_colaborador !== undefined)
      upd.observacoes_colaborador = data.patch.observacoes_colaborador ?? null;
    if (data.patch.observacoes_renato !== undefined)
      upd.observacoes_renato = data.patch.observacoes_renato ?? null;
    if (data.patch.submitted_at !== undefined)
      upd.submitted_at = data.patch.submitted_at || null;

    if (data.patch.items) {
      const currentItems = r.items || [];
      const updatedItems = currentItems.map((item: any, idx: number) => {
        const patchItem = data.patch.items?.[idx];
        if (patchItem && patchItem.checked !== undefined) {
          return { ...item, checked: !!patchItem.checked };
        }
        return item;
      });
      upd.items = updatedItems;
    }

    if (Object.keys(upd).length) {
      await docRef.update(upd);
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
    await db.collection("checklists").doc(data.id).delete();
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

  const collRef = db.collection("checklists");
  const snapshot = await collRef.limit(500).get();
  
  if (snapshot.empty) return;
  
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
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
    const id = randomUUID();
    
    await db.collection("app_users").doc(id).set({
      id,
      name: data.name,
      phone: data.phone || null,
      created_at: Date.now(),
    });
  });
