/**
 * ═══════════════════════════════════════════════════════════════
 * Conexão Centralizada — Neon PostgreSQL + Drizzle ORM
 * Projeto: GuidEasy Logistics (Prudêncio)
 *
 * Este ficheiro:
 *  1. Cria um cliente HTTP stateless via @neondatabase/serverless
 *  2. Wraps com Drizzle ORM para queries type-safe
 *  3. Lazy singleton — só conecta quando a primeira query é feita
 *
 * O driver HTTP do Neon não mantém conexões abertas,
 * eliminando problemas de "too many connections" em serverless.
 * ═══════════════════════════════════════════════════════════════
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;

/**
 * Retorna a instância Drizzle (singleton lazy).
 * Só inicializa a conexão quando a primeira query é feita,
 * permitindo que a app arranque mesmo sem DATABASE_URL configurada
 * (ex.: fallback admin login via variáveis de ambiente).
 */
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não está definida. Configure-a no .env.local (dev) ou nas variáveis da Vercel (prod).",
    );
  }

  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

// Export `db` como proxy lazy para compatibilidade com imports diretos.
// Cada acesso a uma propriedade (ex.: db.select()) delega para getDb().
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const realDb = getDb();
    const value = Reflect.get(realDb, prop, receiver);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});
