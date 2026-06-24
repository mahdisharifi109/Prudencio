#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Criar utilizador na base de dados local
// Uso:
//   node scripts/create-user.mjs --email admin@empresa.pt --name "Admin" --role admin --password SuaPass123
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from "crypto";

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

const email = getArg("email");
const name = getArg("name") || "Utilizador";
const role = getArg("role") || "operator";
const password = getArg("password");

if (!email || !password) {
  console.error(`
Uso: node scripts/create-user.mjs --email <email> --password <password> [--name <nome>] [--role admin|operator]

Exemplo:
  node scripts/create-user.mjs --email admin@empresa.pt --name "Renato" --role admin --password MinhaPass123
`);
  process.exit(1);
}

// Carregar .env se existir
try {
  const { readFileSync } = await import("fs");
  const envContent = readFileSync(".env", "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      // Remover aspas
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}

function resolveClient() {
  const raw = (process.env.DB_CLIENT || "pg").toLowerCase().trim();
  const map = {
    pg: "pg",
    postgres: "pg",
    postgresql: "pg",
    mysql: "mysql2",
    mysql2: "mysql2",
    mariadb: "mysql2",
    mssql: "mssql",
    tedious: "mssql",
    sqlserver: "mssql",
    sqlite: "better-sqlite3",
    sqlite3: "better-sqlite3",
    "better-sqlite3": "better-sqlite3",
  };
  return map[raw] || raw;
}

async function ensureSchema(db) {
  const hasUsers = await db.schema.hasTable("users");
  if (!hasUsers) {
    await db.schema.createTable("users", (table) => {
      table.uuid("id").primary();
      table.text("email").unique().notNullable();
      table.text("password_hash").notNullable();
      table.text("name").notNullable();
      table.text("role").notNullable().defaultTo("operator");
      table.timestamps(true, true);
    });
  }
  const hasObras = await db.schema.hasTable("obras");
  if (!hasObras) {
    await db.schema.createTable("obras", (table) => {
      table.uuid("id").primary();
      table.text("nome").notNullable();
      table.text("descricao");
      table.text("status").notNullable().defaultTo("ativa");
      table.text("created_by");
      table.timestamp("terminated_at");
      table.timestamps(true, true);
    });
  }
}

async function main() {
  const bcrypt = (await import("bcryptjs")).default;
  const knex = (await import("knex")).default;

  const client = resolveClient();
  let dbConfig;

  if (client.includes("sqlite") || client.includes("better-sqlite3")) {
    dbConfig = {
      client,
      connection: {
        filename: process.env.DB_FILE || "./guideeasy.sqlite",
      },
      useNullAsDefault: true,
    };
  } else if (process.env.DATABASE_URL) {
    dbConfig = { client, connection: process.env.DATABASE_URL };
  } else {
    dbConfig = {
      client,
      connection: {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || "guideeasy",
        user: process.env.DB_USER || "guideeasy",
        password: process.env.DB_PASSWORD || "changeme",
      },
    };
  }

  const db = knex(dbConfig);

  try {
    // Garantir que as tabelas necessárias existem
    await ensureSchema(db);

    // Verificar se já existe
    const existing = await db("users").where("email", email.toLowerCase().trim()).first();
    if (existing) {
      console.error(`\n❌ Já existe um utilizador com o email: ${email}\n`);
      process.exit(1);
    }

    const id = randomUUID();
    const password_hash = await bcrypt.hash(password, 12);

    await db("users").insert({
      id,
      email: email.toLowerCase().trim(),
      password_hash,
      name,
      role,
    });

    console.log(`
✅ Utilizador criado com sucesso!

   ID:    ${id}
   Email: ${email}
   Nome:  ${name}
   Role:  ${role}
`);
  } catch (err) {
    console.error("\n❌ Erro ao criar utilizador:", err.message || err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
