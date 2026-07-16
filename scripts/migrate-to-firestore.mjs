#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Script de Migração SQLite -> Firebase Firestore
// Uso:
//   node scripts/migrate-to-firestore.mjs
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import path from "path";
import Database from "better-sqlite3";
import admin from "firebase-admin";

console.log("🚀 A iniciar a migração do SQLite local para o Firebase Firestore...");

// 1. Carregar variáveis de ambiente do .env
try {
  const envContent = readFileSync(".env", "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {
  console.log("ℹ️ .env não encontrado ou ilegível, a usar variáveis de ambiente do sistema.");
}

// 2. Verificar se o ficheiro SQLite existe
const sqliteFilePath = process.env.DB_FILE || "./guideeasy.sqlite";
if (!existsSync(sqliteFilePath)) {
  console.error(`❌ Erro: O ficheiro SQLite não foi encontrado em: ${sqliteFilePath}`);
  console.error("Certifique-se de que a variável DB_FILE está correta ou coloque o ficheiro guideeasy.sqlite na raiz do projeto.");
  process.exit(1);
}

// 3. Inicializar Firebase Admin SDK
const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "prudencio-main";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

let credentialOptions = null;
if (serviceAccountEnv) {
  try {
    credentialOptions = JSON.parse(serviceAccountEnv);
  } catch (err) {
    console.error("Falha ao fazer parse de FIREBASE_SERVICE_ACCOUNT:", err.message);
  }
} else if (projectId && clientEmail && privateKey) {
  credentialOptions = {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

if (credentialOptions) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(credentialOptions),
    });
    console.log("✅ Firebase Admin inicializado com credenciais explícitas.");
  } catch (err) {
    console.error("❌ Erro ao inicializar Firebase Admin SDK:", err.message);
    process.exit(1);
  }
} else {
  try {
    admin.initializeApp();
    console.log("✅ Firebase Admin inicializado com credenciais padrão do ambiente.");
  } catch (err) {
    console.error(
      "❌ Erro ao inicializar Firebase Admin. Configure FIREBASE_SERVICE_ACCOUNT ou variáveis de ambiente de credenciais.",
      err.message
    );
    process.exit(1);
  }
}

const db = admin.firestore();

// Helper para parsear datas SQLite para epoch timestamp
function parseTimestamp(val) {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  const t = Date.parse(val);
  return isNaN(t) ? Date.now() : t;
}

// Helper para fazer parse de JSON de forma segura
function safeJsonParse(val) {
  if (!val) return null;
  try {
    return typeof val === "string" ? JSON.parse(val) : val;
  } catch {
    return val;
  }
}

async function runMigration() {
  let sqliteDb;
  try {
    sqliteDb = new Database(sqliteFilePath, { readonly: true });
    console.log("📖 Base de dados SQLite aberta com sucesso.");
  } catch (err) {
    console.error("❌ Erro ao abrir a base de dados SQLite:", err.message);
    process.exit(1);
  }

  // A. MIGRAR USERS
  try {
    console.log("\n👤 A migrar utilizadores (users)...");
    const users = sqliteDb.prepare("SELECT * FROM users").all();
    console.log(`Encontrados ${users.length} utilizadores.`);

    for (const u of users) {
      await db.collection("users").doc(u.id).set({
        id: u.id,
        email: u.email.toLowerCase().trim(),
        password_hash: u.password_hash,
        name: u.name,
        role: u.role || "operator",
        created_at: parseTimestamp(u.created_at || u.created_at_timestamp),
      });
      console.log(`  Migrado: ${u.email} (${u.role})`);
    }
  } catch (err) {
    console.warn("⚠️ Aviso ou erro ao migrar utilizadores (tabela 'users' pode não existir):", err.message);
  }

  // B. MIGRAR OBRAS
  try {
    console.log("\n🏗️ A migrar obras...");
    const obras = sqliteDb.prepare("SELECT * FROM obras").all();
    console.log(`Encontradas ${obras.length} obras.`);

    for (const o of obras) {
      await db.collection("obras").doc(o.id).set({
        id: o.id,
        nome: o.nome,
        descricao: o.descricao || null,
        status: o.status || "ativa",
        created_by: o.created_by || null,
        terminated_at: o.terminated_at ? parseTimestamp(o.terminated_at) : null,
        created_at: parseTimestamp(o.created_at),
      });
      console.log(`  Migrado: ${o.nome} (${o.status})`);
    }
  } catch (err) {
    console.warn("⚠️ Aviso ou erro ao migrar obras (tabela 'obras' pode não existir):", err.message);
  }

  // C. MIGRAR CHECKLISTS & ITEMS
  try {
    console.log("\n📋 A migrar checklists e items de checklist...");
    const checklists = sqliteDb.prepare("SELECT * FROM checklists").all();
    console.log(`Encontradas ${checklists.length} checklists.`);

    let itemsMap = {};
    try {
      const items = sqliteDb.prepare("SELECT * FROM checklist_items ORDER BY position ASC").all();
      console.log(`Encontrados ${items.length} items de checklist.`);
      for (const item of items) {
        if (!itemsMap[item.checklist_id]) {
          itemsMap[item.checklist_id] = [];
        }
        itemsMap[item.checklist_id].push({
          artigo: item.artigo || "",
          descricao: item.descricao || "",
          quantidade: item.quantidade || "",
          unidade: item.unidade || "",
          checked: item.checked === 1 || item.checked === true || item.checked === "true" || item.checked === "1",
        });
      }
    } catch (itemErr) {
      console.warn("⚠️ Tabela 'checklist_items' em falta ou erro ao ler items:", itemErr.message);
    }

    for (const c of checklists) {
      const embeddedItems = itemsMap[c.id] || [];
      await db.collection("checklists").doc(c.id).set({
        id: c.id,
        codigo_at: c.codigo_at || null,
        numero_guia: c.numero_guia || null,
        data_documento: c.data_documento || null,
        data_carga: c.data_carga || null,
        hora_carga: c.hora_carga || null,
        observacoes_renato: c.observacoes_renato || null,
        status: c.status || "pendente",
        created_by: c.created_by || null,
        responsavel: c.responsavel || null,
        observacoes_colaborador: c.observacoes_colaborador || null,
        submitted_at: c.submitted_at ? parseTimestamp(c.submitted_at) : null,
        created_at: parseTimestamp(c.created_at),
        obra_id: c.obra_id || null,
        tipo_guia: c.tipo_guia || "transporte",
        pdf_name: c.pdf_name || null,
        pdf_metadata: safeJsonParse(c.pdf_metadata),
        items: embeddedItems,
      });
      console.log(`  Migrado checklist: ${c.numero_guia || c.id} com ${embeddedItems.length} items.`);
    }
  } catch (err) {
    console.warn("⚠️ Aviso ou erro ao migrar checklists (tabela 'checklists' pode não existir):", err.message);
  }

  // D. MIGRAR APP_USERS (REGISTO DE COLABORADORES)
  try {
    console.log("\n📱 A migrar app_users (colaboradores)...");
    const appUsers = sqliteDb.prepare("SELECT * FROM app_users").all();
    console.log(`Encontrados ${appUsers.length} colaboradores.`);

    for (const au of appUsers) {
      await db.collection("app_users").doc(au.id).set({
        id: au.id,
        name: au.name,
        phone: au.phone || null,
        created_at: parseTimestamp(au.created_at),
      });
      console.log(`  Migrado: ${au.name}`);
    }
  } catch (err) {
    console.warn("⚠️ Aviso ou erro ao migrar app_users (tabela 'app_users' pode não existir):", err.message);
  }

  console.log("\n🎉 Migração concluída com sucesso!");
  sqliteDb.close();
}

runMigration().catch((err) => {
  console.error("❌ Ocorreu um erro crítico durante a migração:", err);
  process.exit(1);
});
