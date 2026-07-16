#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 * Script de Setup Completo do Firestore
 *
 * Executa: node scripts/setup-firestore.mjs
 *
 * O que faz:
 *  1. Conecta ao Firestore com a Service Account
 *  2. Cria o utilizador admin (se não existir)
 *  3. Cria coleções iniciais vazias (obras, checklists, app_users)
 *  4. Verifica que tudo funciona
 * ═══════════════════════════════════════════════════════════════
 */

import { readFileSync } from "fs";
import admin from "firebase-admin";
import { createHash, randomUUID } from "crypto";

// ─── 1. Carregar .env ────────────────────────────────────────────────
console.log("🔧 A carregar variáveis de ambiente...");
try {
  const envContent = readFileSync(".env", "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if (
        (val.startsWith("'") && val.endsWith("'")) ||
        (val.startsWith('"') && val.endsWith('"'))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
  console.log("✅ .env carregado.\n");
} catch {
  console.error("❌ Ficheiro .env não encontrado!");
  process.exit(1);
}

// ─── 2. Inicializar Firebase Admin ───────────────────────────────────
console.log("🔥 A inicializar Firebase Admin SDK...");

const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountEnv || serviceAccountEnv.trim().length < 10) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT está vazio no .env!");
  process.exit(1);
}

let serviceAccount;
try {
  let jsonStr = serviceAccountEnv.trim();
  if (jsonStr.startsWith("'") && jsonStr.endsWith("'")) {
    jsonStr = jsonStr.slice(1, -1);
  }
  serviceAccount = JSON.parse(jsonStr);
} catch (err) {
  console.error("❌ Falha ao fazer parse de FIREBASE_SERVICE_ACCOUNT:", err.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
console.log(`✅ Conectado ao projeto: ${serviceAccount.project_id}\n`);

// ─── 3. Seed do Admin User ──────────────────────────────────────────
async function seedAdmin() {
  console.log("👤 A verificar/criar utilizador admin...");

  const usersColl = db.collection("users");
  const snapshot = await usersColl.limit(1).get();

  if (!snapshot.empty) {
    const existing = snapshot.docs[0].data();
    console.log(`   ℹ️  Já existe um utilizador: ${existing.email} (${existing.role})`);
    return;
  }

  // Importar bcryptjs para hash da password
  const bcrypt = (await import("bcryptjs")).default;

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@prudencio.pt").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || "Rpavg5n";
  const adminName = process.env.ADMIN_NAME || "Administrador";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminId = randomUUID();
  await usersColl.doc(adminId).set({
    id: adminId,
    email: adminEmail,
    password_hash: passwordHash,
    name: adminName,
    role: "admin",
    created_at: Date.now(),
  });

  console.log(`   ✅ Admin criado!`);
  console.log(`   📧 Email: ${adminEmail}`);
  console.log(`   🔑 Password: ${adminPassword}`);
  console.log(`   👤 Nome: ${adminName}`);
  console.log(`   🆔 ID: ${adminId}`);
}

// ─── 4. Criar coleções iniciais ─────────────────────────────────────
async function ensureCollections() {
  console.log("\n📦 A garantir que as coleções existem...");

  const collections = [
    {
      name: "users",
      skip: true, // Já criado no seed
    },
    {
      name: "obras",
      doc: {
        id: "placeholder",
        nome: "_placeholder_colecao_",
        descricao: "Documento placeholder — pode apagar",
        status: "terminada",
        created_at: Date.now(),
      },
    },
    {
      name: "checklists",
      doc: {
        id: "placeholder",
        codigo_at: "",
        observacoes_renato: "",
        items: [],
        status: "pendente",
        created_at: Date.now(),
        tipo_guia: "transporte",
      },
    },
    {
      name: "app_users",
      doc: {
        id: "placeholder",
        name: "_placeholder_",
        phone: null,
        created_at: Date.now(),
      },
    },
  ];

  for (const col of collections) {
    if (col.skip) {
      console.log(`   ⏭️  ${col.name} — já tratado no seeding`);
      continue;
    }

    const snap = await db.collection(col.name).limit(1).get();
    if (!snap.empty) {
      console.log(`   ✅ ${col.name} — já tem dados (${snap.size} doc(s))`);
    } else {
      await db.collection(col.name).doc("placeholder").set(col.doc);
      console.log(`   ✅ ${col.name} — coleção criada com documento placeholder`);
    }
  }
}

// ─── 5. Verificação final ───────────────────────────────────────────
async function verify() {
  console.log("\n🧪 Verificação final...");

  // Ler o admin user de volta
  const usersSnap = await db.collection("users").where("role", "==", "admin").limit(1).get();
  if (!usersSnap.empty) {
    const admin = usersSnap.docs[0].data();
    console.log(`   ✅ Admin encontrado: ${admin.email} (role: ${admin.role})`);
  } else {
    console.log("   ❌ Admin NÃO encontrado! Algo falhou no seeding.");
  }

  // Listar coleções
  const collections = await db.listCollections();
  console.log(`   ✅ Coleções no Firestore: ${collections.map((c) => c.id).join(", ")}`);

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  🎉 SETUP COMPLETO! O Firestore está pronto a usar.");
  console.log("════════════════════════════════════════════════════════════");
  console.log("\n📋 Credenciais de login:");
  console.log(`   Email:    ${process.env.ADMIN_EMAIL || "admin@prudencio.pt"}`);
  console.log(`   Password: ${process.env.ADMIN_PASSWORD || "Rpavg5n"}`);
  console.log("");
}

// ─── Executar tudo ──────────────────────────────────────────────────
async function main() {
  try {
    await seedAdmin();
    await ensureCollections();
    await verify();
  } catch (err) {
    console.error("\n❌ Erro crítico:", err);
    process.exit(1);
  }
  process.exit(0);
}

main();
