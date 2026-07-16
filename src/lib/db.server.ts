/**
 * ═══════════════════════════════════════════════════════════════
 * db.server.ts — Firebase Admin SDK (Firestore)
 * Projeto: prudencio-main
 *
 * Usa FIREBASE_SERVICE_ACCOUNT do .env para autenticar.
 * Faz auto-seeding do utilizador admin na primeira execução.
 * ═══════════════════════════════════════════════════════════════
 */

import admin from "firebase-admin";

let db: admin.firestore.Firestore;

function initializeFirebaseAdmin(): admin.firestore.Firestore {
  // Se já está inicializado (HMR), reutilizar
  if (admin.apps.length > 0) {
    const app = admin.apps[0];
    if (app) return app.firestore();
  }

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    "prudencio-main";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  let credentialOptions: admin.ServiceAccount | null = null;

  // Opção 1: JSON completo da Service Account
  if (serviceAccountEnv && serviceAccountEnv.trim().length > 10) {
    try {
      // Remover aspas simples ou duplas que envolvem o JSON se existirem
      let jsonStr = serviceAccountEnv.trim();
      if (jsonStr.startsWith("'") && jsonStr.endsWith("'")) {
        jsonStr = jsonStr.slice(1, -1);
      }
      if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
        jsonStr = jsonStr.slice(1, -1);
      }
      credentialOptions = JSON.parse(jsonStr);
    } catch (err: any) {
      console.error(
        "[db] Falha ao fazer parse de FIREBASE_SERVICE_ACCOUNT:",
        err.message
      );
      throw new Error(
        `[db] ❌ Falha ao fazer parse de FIREBASE_SERVICE_ACCOUNT: ${err.message}. Certifique-se de que copiou o JSON completo e sem plicas/aspas externas.`
      );
    }
  }
  // Opção 2: Chaves individuais
  else if (projectId && clientEmail && privateKey) {
    credentialOptions = {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  }

  if (credentialOptions) {
    try {
      const app = admin.initializeApp({
        credential: admin.credential.cert(credentialOptions),
      });
      console.log("[db] ✅ Firebase Admin SDK inicializado com sucesso.");
      return app.firestore();
    } catch (err: any) {
      console.error(
        "[db] ❌ Erro ao inicializar Firebase Admin SDK:",
        err.message
      );
      throw new Error(
        `[db] ❌ Erro ao inicializar Firebase Admin SDK com credenciais: ${err.message}`
      );
    }
  }

  // Se não há credenciais, lançar erro claro
  throw new Error(
    `[db] ❌ FIREBASE_SERVICE_ACCOUNT não está configurado. ` +
      `Variáveis detetadas: FIREBASE_SERVICE_ACCOUNT=${serviceAccountEnv ? 'definida (tamanho: ' + serviceAccountEnv.length + ')' : 'ausente'}, ` +
      `FIREBASE_CLIENT_EMAIL=${clientEmail ? 'definida' : 'ausente'}, ` +
      `FIREBASE_PRIVATE_KEY=${privateKey ? 'definida' : 'ausente'}.`
  );
}

export function getDb(): admin.firestore.Firestore {
  if (!db) {
    db = initializeFirebaseAdmin();
    // Auto-seeding do admin em background
    ensureSeededAdmin(db).catch((err) => {
      console.error("[db] Falha no seeding do admin:", err);
    });
  }
  return db;
}

async function ensureSeededAdmin(
  firestoreDb: admin.firestore.Firestore
): Promise<void> {
  try {
    const usersColl = firestoreDb.collection("users");
    const snapshot = await usersColl.limit(1).get();

    if (snapshot.empty) {
      const bcrypt = (await import("bcryptjs")).default;
      const crypto = await import("crypto");

      const adminEmail = (process.env.ADMIN_EMAIL || "admin@prudencio.pt")
        .toLowerCase()
        .trim();
      const adminPassword = process.env.ADMIN_PASSWORD || "Rpavg5n";
      const adminName = process.env.ADMIN_NAME || "Administrador";
      const password_hash = await bcrypt.hash(adminPassword, 12);

      const newAdminId = crypto.randomUUID();
      await usersColl.doc(newAdminId).set({
        id: newAdminId,
        email: adminEmail,
        password_hash,
        name: adminName,
        role: "admin",
        created_at: Date.now(),
      });

      console.log(
        `[db] ✅ Admin user criado: ${adminEmail}`
      );
    } else {
      console.log("[db] ✅ Admin user já existe na Firestore.");
    }
  } catch (err: any) {
    console.error("[db] Erro no seeding do admin:", err.message || err);
  }
}
