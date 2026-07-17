/* eslint-disable @typescript-eslint/no-explicit-any */
// ─── Conexão ao banco de dados do servidor do cliente ────────────────
// Suporta PostgreSQL, MySQL, SQL Server e SQLite3 via Knex.
// Ficheiro .server.ts — nunca incluído no bundle do cliente.

import knex, { type Knex } from "knex";
import { randomUUID } from "crypto";

/** Normaliza o nome do driver para knex */
function resolveClient(): string {
  const raw = (process.env.DB_CLIENT || "pg").toLowerCase().trim();
  const map: Record<string, string> = {
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

/** Constrói a configuração de conexão a partir de variáveis de ambiente */
function buildConfig(): Knex.Config {
  const client = resolveClient();

  // SQLite (fallback local sem configurações de rede)
  if (client.includes("sqlite") || client.includes("better-sqlite3")) {
    return {
      client,
      connection: {
        filename: process.env.DB_FILE || "./guideeasy.sqlite",
      },
      useNullAsDefault: true,
    };
  }

  // Modo simples: DATABASE_URL ou POSTGRES_URL (string de conexão única)
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (connectionString) {
    const isPostgres = client === "pg";
    return {
      client,
      connection: {
        connectionString,
        ssl: isPostgres && process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      },
      pool: { min: 2, max: 10 },
    };
  }

  // Modo detalhado: variáveis individuais
  const defaultPort =
    client === "pg" ? 5432 : client === "mysql2" ? 3306 : 1433;

  const baseConnection = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || defaultPort,
    database: process.env.DB_NAME || "guideeasy",
    user: process.env.DB_USER || "guideeasy",
    password: process.env.DB_PASSWORD || "changeme",
  };

  // Opções específicas para SQL Server
  if (client === "mssql") {
    return {
      client: "mssql",
      connection: {
        server: baseConnection.host,
        port: baseConnection.port,
        database: baseConnection.database,
        user: baseConnection.user,
        password: baseConnection.password,
        options: {
          encrypt: process.env.DB_ENCRYPT === "true",
          trustServerCertificate: process.env.DB_TRUST_CERT !== "false",
        },
      },
      pool: { min: 2, max: 10 },
    };
  }

  return {
    client,
    connection: baseConnection,
    pool: { min: 2, max: 10 },
  };
}

// ─── Criação automática de tabelas (Schema Builder Dialect-Agnostic) ──

async function ensureSchema(db: Knex): Promise<void> {
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

  const hasChecklists = await db.schema.hasTable("checklists");
  if (!hasChecklists) {
    await db.schema.createTable("checklists", (table) => {
      table.uuid("id").primary();
      table.text("codigo_at");
      table.text("numero_guia");
      table.date("data_documento");
      table.date("data_carga");
      table.text("hora_carga");
      table.text("observacoes_renato");
      table.text("status").notNullable().defaultTo("pendente");
      table.text("created_by");
      table.text("responsavel");
      table.text("observacoes_colaborador");
      table.timestamp("submitted_at");
      table.timestamps(true, true);
      table.uuid("obra_id").references("id").inTable("obras").onDelete("SET NULL");
      table.text("tipo_guia").defaultTo("transporte");
      table.text("pdf_name");
      table.json("pdf_metadata");
    });
  }

  const hasItems = await db.schema.hasTable("checklist_items");
  if (!hasItems) {
    await db.schema.createTable("checklist_items", (table) => {
      table.uuid("id").primary();
      table.uuid("checklist_id").notNullable().references("id").inTable("checklists").onDelete("CASCADE");
      table.text("artigo");
      table.text("descricao");
      table.text("quantidade");
      table.text("unidade");
      table.boolean("checked").notNullable().defaultTo(false);
      table.integer("position").notNullable().defaultTo(0);
    });
  }

  const hasAppUsers = await db.schema.hasTable("app_users");
  if (!hasAppUsers) {
    await db.schema.createTable("app_users", (table) => {
      table.uuid("id").primary();
      table.text("name").notNullable();
      table.text("phone");
      table.timestamps(true, true);
    });
  }

  // Criar utilizador admin inicial se a tabela estiver vazia
  try {
    const usersCount = await db("users").count("id as count").first();
    const count = usersCount ? Number(usersCount.count || (usersCount as any)['count(*)'] || 0) : 0;
    if (count === 0) {
      const bcrypt = (await import("bcryptjs")).default;
      const adminEmail = (process.env.ADMIN_EMAIL || "admin@prudencio.pt").toLowerCase().trim();
      const adminPassword = process.env.ADMIN_PASSWORD || "Rpavg5n";
      const adminName = process.env.ADMIN_NAME || "Administrador";
      const password_hash = await bcrypt.hash(adminPassword, 12);

      await db("users").insert({
        id: randomUUID(),
        email: adminEmail,
        password_hash,
        name: adminName,
        role: "admin",
      });
      console.log(`[db] Seeded initial admin user: ${adminEmail}`);
    }
  } catch (err) {
    console.error("[db] Falha ao verificar/criar utilizador admin inicial:", err);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────

let _db: Knex | null = null;
let _schemaPromise: Promise<void> | null = null;

/** Obtém a instância knex (singleton, criada na primeira chamada) */
export function getDb(): Knex {
  if (!_db) {
    _db = knex(buildConfig());
    // Executa a inicialização do esquema em background
    _schemaPromise = ensureSchema(_db).catch((err) => {
      console.error("[db] Falha ao criar esquema de tabelas automaticamente:", err);
    });
  }
  return _db;
}

/** Aguarda a inicialização do esquema se necessário */
export async function waitSchema(): Promise<void> {
  getDb();
  if (_schemaPromise) {
    await _schemaPromise;
  }
}

/** Testa se a conexão à base de dados está funcional */
export async function testConnection(): Promise<boolean> {
  try {
    const db = getDb();
    await waitSchema();
    await db.raw("SELECT 1");
    return true;
  } catch (err) {
    console.error("[db] Falha na conexão à base de dados:", err);
    return false;
  }
}

/** Fecha a conexão (para shutdown gracioso) */
export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.destroy();
    _db = null;
    _schemaPromise = null;
  }
}
