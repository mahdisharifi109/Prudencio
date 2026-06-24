import admin from "firebase-admin";

let db: admin.firestore.Firestore;

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    const app = admin.apps[0];
    if (app) {
      return app.firestore();
    }
  }

  // Obter credenciais de variáveis de ambiente
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  let credentialOptions: admin.ServiceAccount | null = null;

  if (serviceAccountEnv) {
    try {
      credentialOptions = JSON.parse(serviceAccountEnv);
    } catch (err: any) {
      console.error("[db] Falha ao fazer parse da variavel FIREBASE_SERVICE_ACCOUNT:", err.message);
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
      const app = admin.initializeApp({
        credential: admin.credential.cert(credentialOptions),
      });
      console.log("[db] Firebase Admin SDK inicializado com sucesso.");
      return app.firestore();
    } catch (err: any) {
      console.error("[db] Erro ao inicializar Firebase Admin SDK com credenciais:", err.message);
    }
  }

  // Fallback para credenciais padrão do ambiente Google Cloud (Vercel ou GCP)
  try {
    const app = admin.initializeApp();
    console.log("[db] Firebase Admin SDK inicializado usando credenciais padrao do ambiente (GCP).");
    return app.firestore();
  } catch (err: any) {
    console.warn(
      "[db] Alerta: Falha ao inicializar o Firebase Admin SDK usando credenciais padrao. Certifique-se de configurar as variaveis de ambiente de credenciais no painel da Vercel.",
      err.message
    );
    // Em caso de falha de credenciais, retornamos a chamada padrão do Firestore
    // para tentar obter do ambiente local se aplicável
    return admin.firestore();
  }
}

export function getDb(): admin.firestore.Firestore {
  if (!db) {
    db = initializeFirebaseAdmin();
    // Executa o auto-seeding em background
    ensureSeededAdmin(db).catch((err) => {
      console.error("[db] Falha ao garantir utilizador admin inicial:", err);
    });
  }
  return db;
}

async function ensureSeededAdmin(firestoreDb: admin.firestore.Firestore): Promise<void> {
  try {
    const usersColl = firestoreDb.collection("users");
    const snapshot = await usersColl.limit(1).get();

    if (snapshot.empty) {
      const bcrypt = (await import("bcryptjs")).default;
      const crypto = await import("crypto");

      const adminEmail = (process.env.ADMIN_EMAIL || "admin@prudencio.pt").toLowerCase().trim();
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

      console.log(`[db] Seeded initial Firestore admin user: ${adminEmail}`);
    }
  } catch (err: any) {
    console.error("[db] Erro no seeding do Firestore admin:", err.message || err);
  }
}
