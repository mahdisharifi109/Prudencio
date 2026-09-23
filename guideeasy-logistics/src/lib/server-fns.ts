/* eslint-disable @typescript-eslint/no-explicit-any */
// ─── Server Functions ────────────────────────────────────────────────
// Apenas autenticação (login/logout/session) executada no servidor.
// O CRUD de dados passou inteiramente para Drizzle ORM (store.ts).
//
// A autenticação valida credenciais contra:
//  1. Utilizadores registados no PostgreSQL (via Drizzle ORM)
//  2. Credenciais de admin definidas no .env (ADMIN_EMAIL/ADMIN_PASSWORD)
//     como fallback quando a tabela users está vazia
//
// Sessões geridas via JWT em cookies HTTP-only.

import { createServerFn } from "@tanstack/react-start";
import type { UserProfile, UserRole } from "./types";

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

// ─── Database helpers (Drizzle + Neon) ───────────────────────────────

/** Procurar utilizador por email via Drizzle ORM */
async function findUserByEmail(email: string): Promise<{ id: string; data: any } | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    // Importação dinâmica para garantir que só executa no servidor
    const { db } = await import("./db");
    const { users } = await import("./schema");
    const { eq } = await import("drizzle-orm");

    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      data: {
        email: row.email,
        password_hash: row.password_hash,
        name: row.name,
        role: row.role,
      },
    };
  } catch (e) {
    console.warn("[auth] Falha ao procurar utilizador na base de dados:", e);
    return null;
  }
}

// ─── Autenticação com fallback para admin do .env ────────────────────

async function authenticateUser(email: string, password: string): Promise<UserProfile> {
  const bcrypt = (await import("bcryptjs")).default;

  // 1. Tentar encontrar no PostgreSQL
  const dbUser = await findUserByEmail(email);
  if (dbUser) {
    const valid = await bcrypt.compare(password, dbUser.data.password_hash);
    if (!valid) throw new Error("Email ou password incorretos");
    return {
      id: dbUser.id,
      email: dbUser.data.email,
      name: dbUser.data.name,
      role: dbUser.data.role as UserRole,
    };
  }

  // 2. Fallback: verificar contra credenciais admin do .env
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@prudencio.pt").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || "Rpavg5n";
  const adminName = process.env.ADMIN_NAME || "Administrador";

  if (email.toLowerCase().trim() === adminEmail && password === adminPassword) {
    console.log("[auth] Login via credenciais admin do .env (tabela users vazia ou inacessível)");
    return {
      id: "admin-env",
      email: adminEmail,
      name: adminName,
      role: "admin",
    };
  }

  throw new Error("Email ou password incorretos");
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
      const jwt = (await import("jsonwebtoken")).default;

      const user = await authenticateUser(data.email, data.password);

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

      return user;
    } catch (err: any) {
      console.error("[loginFn Error Server-Side]:", err.message);
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
