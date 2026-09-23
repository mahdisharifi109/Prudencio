#!/usr/bin/env node
/**
 * Script para criar o utilizador admin diretamente no PostgreSQL
 * via @neondatabase/serverless (sem necessitar de ORM completo).
 *
 * Uso:
 *   node scripts/seed-admin.mjs
 *
 * As credenciais são lidas das variáveis de ambiente.
 * Copie .env.local e configure os valores antes de correr.
 */

import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Carregar .env.local manualmente (sem dependências externas) ──────
for (const envFile of [".env.local", ".env"]) {
  const envPath = resolve(__dirname, `../${envFile}`);
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
    console.log(`✅ Variáveis carregadas de ${envFile}`);
    break;
  }
}

// ─── Configuração via variáveis de ambiente ───────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("\n❌ DATABASE_URL não está definida nas variáveis de ambiente.");
  console.error("   Defina DATABASE_URL no ficheiro .env.local antes de correr este script.");
  process.exit(1);
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@prudencio.pt").toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || "Administrador";

if (!ADMIN_PASSWORD) {
  console.error("\n❌ ADMIN_PASSWORD não está definida nas variáveis de ambiente.");
  console.error("   Defina ADMIN_PASSWORD no ficheiro .env.local antes de correr este script.");
  process.exit(1);
}

// ─── Hash da password ─────────────────────────────────────────────────
const bcrypt = (await import("bcryptjs")).default;

console.log("🔐 A criar hash da password...");
const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
console.log("✅ Hash criado.");

const adminId = randomUUID();

// ─── Criar utilizador no PostgreSQL via Neon ──────────────────────────
const sql = neon(DATABASE_URL);

console.log(`\n📝 A criar utilizador admin no PostgreSQL...`);
console.log(`   Email: ${ADMIN_EMAIL}`);
console.log(`   Nome:  ${ADMIN_NAME}`);

try {
  // Verificar se já existe um admin com este email
  const existing = await sql`SELECT id FROM users WHERE email = ${ADMIN_EMAIL} LIMIT 1`;

  if (existing.length > 0) {
    console.log(`\n⚠️  Utilizador com email ${ADMIN_EMAIL} já existe (ID: ${existing[0].id}).`);
    console.log("   A atualizar password e dados...");

    await sql`
      UPDATE users
      SET password_hash = ${passwordHash},
          name = ${ADMIN_NAME},
          role = 'admin'
      WHERE email = ${ADMIN_EMAIL}
    `;

    console.log("\n✅ Utilizador admin atualizado com sucesso!");
  } else {
    await sql`
      INSERT INTO users (id, email, password_hash, name, role, created_at)
      VALUES (${adminId}, ${ADMIN_EMAIL}, ${passwordHash}, ${ADMIN_NAME}, 'admin', ${Date.now()})
    `;

    console.log("\n✅ Utilizador admin criado com sucesso!");
    console.log(`   📧 Email: ${ADMIN_EMAIL}`);
    console.log(`   👤 Nome: ${ADMIN_NAME}`);
    console.log(`   🆔 ID: ${adminId}`);
  }
} catch (err) {
  console.error("\n❌ Erro ao criar utilizador:", err.message);

  if (err.message.includes("relation") && err.message.includes("does not exist")) {
    console.log("\n💡 A tabela 'users' não existe. Execute primeiro:");
    console.log("   npx drizzle-kit push");
    console.log("   Depois volte a executar este script.");
  }
}
