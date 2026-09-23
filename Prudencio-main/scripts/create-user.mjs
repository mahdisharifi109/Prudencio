#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Criar utilizador na base de dados Firestore
// Uso:
//   node scripts/create-user.mjs --email admin@empresa.pt --name "Admin" --role admin --password SuaPass123
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from "crypto";
import admin from "firebase-admin";

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

// Inicializar Firebase Admin
const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
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
    console.log("Firebase Admin SDK inicializado usando credenciais do ficheiro .env.");
  } catch (err) {
    console.error("Erro ao inicializar Firebase Admin SDK com credenciais:", err.message);
    process.exit(1);
  }
} else {
  // Try default credentials (e.g. on GCP/Vercel or if configured via GOOGLE_APPLICATION_CREDENTIALS)
  try {
    admin.initializeApp();
    console.log("Firebase Admin SDK inicializado usando credenciais padrao.");
  } catch (err) {
    console.error(
      "Erro ao inicializar Firebase Admin SDK. Por favor, configure FIREBASE_SERVICE_ACCOUNT ou as variaveis de credenciais individuais no .env.",
      err.message
    );
    process.exit(1);
  }
}

const db = admin.firestore();

async function main() {
  const bcrypt = (await import("bcryptjs")).default;

  try {
    const usersColl = db.collection("users");
    
    // Verificar se já existe
    const existingSnap = await usersColl.where("email", "==", email.toLowerCase().trim()).limit(1).get();
    if (!existingSnap.empty) {
      console.error(`\n❌ Ja existe um utilizador com o email: ${email}\n`);
      process.exit(1);
    }

    const id = randomUUID();
    const password_hash = await bcrypt.hash(password, 12);

    await usersColl.doc(id).set({
      id,
      email: email.toLowerCase().trim(),
      password_hash,
      name,
      role,
      created_at: Date.now(),
    });

    console.log(`
✅ Utilizador criado com sucesso no Firestore!

   ID:    ${id}
   Email: ${email}
   Nome:  ${name}
   Role:  ${role}
`);
  } catch (err) {
    console.error("\n❌ Erro ao criar utilizador:", err.message || err);
    process.exit(1);
  }
}

main();

