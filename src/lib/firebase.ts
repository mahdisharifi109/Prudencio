/**
 * ═══════════════════════════════════════════════════════════════
 * Firebase Client SDK — Configuração Central
 * Projeto: prudencio-main (ID: prudencio-main)
 *
 * Este ficheiro:
 *  1. Inicializa o Firebase App (singleton, seguro para SSR)
 *  2. Exporta instâncias prontas de Auth, Firestore e Storage
 *  3. RTDB é lazy — só inicializa quando chamado (evita crash se databaseURL vazio)
 *  4. Mantém todo o CRUD de Checklists e Obras (migrado para Firestore)
 * ═══════════════════════════════════════════════════════════════
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  push,
  set,
  get,
  child,
  update,
  remove,
} from "firebase/database";
import type { Database } from "firebase/database";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

// ─── Configuração Firebase ───────────────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "prudencio-main.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "prudencio-main",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "prudencio-main.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "37827545233",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

// ─── Singleton App ───────────────────────────────────────────────────
export const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// ─── Serviços Prontos a Usar ─────────────────────────────────────────

/** Firebase Authentication */
export const auth: Auth = getAuth(app);

/** Cloud Firestore (com cache local persistente para offline) */
export const firestore: Firestore = (() => {
  try {
    if (typeof window !== "undefined") {
      return initializeFirestore(app, {
        localCache: persistentLocalCache(),
      });
    }
    return getFirestore(app);
  } catch {
    return getFirestore(app);
  }
})();

/**
 * Realtime Database — inicialização LAZY.
 * Só inicializa quando chamado pela primeira vez.
 * Se databaseURL não estiver configurado, lança um erro claro.
 */
let _db: Database | null = null;
export function getRtdb(): Database {
  if (_db) return _db;
  if (!firebaseConfig.databaseURL) {
    throw new Error(
      "[Firebase] VITE_FIREBASE_DATABASE_URL não está configurado no .env. " +
        "Se quiseres usar o Realtime Database, ativa-o na consola Firebase e " +
        "adiciona a URL ao .env."
    );
  }
  _db = getDatabase(app);
  return _db;
}

// Exportar `db` como getter lazy para compatibilidade com código existente
// Nota: o acesso a `db` vai lançar erro se RTDB não estiver configurado
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const realDb = getRtdb();
    const value = Reflect.get(realDb, prop, receiver);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});

/** Cloud Storage (para ficheiros/PDFs) */
export const storage: FirebaseStorage = getStorage(app);

// ─── Analytics (lazy, apenas browser) ────────────────────────────────
export async function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    const { isSupported, getAnalytics } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(app);
  } catch {
    /* analytics não suportado neste browser */
  }
}

// ─── Tipos ───────────────────────────────────────────────────────────

export type ChecklistItem = {
  artigo: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  checked?: boolean;
};

/** Metadata extraída do PDF */
export type PdfMetadata = {
  emissor_empresa?: string;
  emissor_contribuinte?: string;
  emissor_morada?: string;
  emissor_contactos?: string;
  emissor_capital_social?: string;
  destinatario_nome?: string;
  destinatario_morada?: string;
  tipo_documento?: string;
  vn_contrib?: string;
  atcud?: string;
  carga_local?: string;
  descarga_local?: string;
  descarga_morada?: string;
  disponibilizacao?: string;
  certificacao?: string;
  qr_raw?: string;
};

export type Obra = {
  id: string;
  nome: string;
  descricao?: string;
  status: "ativa" | "terminada";
  created_by?: string;
  terminated_at?: number;
  created_at: number;
};

export type Checklist = {
  id: string;
  codigo_at: string;
  observacoes_renato: string;
  items: ChecklistItem[];
  status: "pendente" | "concluida";
  created_at: number;
  created_by?: string;
  responsavel?: string;
  observacoes_colaborador?: string;
  submitted_at?: number;
  // Datas extraídas do PDF
  data_documento?: string;
  data_carga?: string;
  hora_carga?: string;
  numero_guia?: string;
  pdf_name?: string;
  pdf_metadata?: PdfMetadata;
  // Associação a Obra
  obra_id?: string;
  obra_nome?: string;
  // Tipo de documento
  tipo_guia?: "transporte" | "devolucao";
};

// ─── Firestore CRUD (Checklists) ─────────────────────────────────────
// Migrado de Realtime Database para Firestore para funcionar sem RTDB.

const checklistsCol = () => collection(firestore, "checklists");

export async function createChecklist(
  c: Omit<Checklist, "id">
): Promise<string> {
  const docRef = await addDoc(checklistsCol(), { ...c, created_at: c.created_at || Date.now() });
  // Atualizar o doc com o seu próprio ID para manter compatibilidade
  await updateDoc(docRef, { id: docRef.id });
  return docRef.id;
}

export async function getChecklist(id: string): Promise<Checklist | null> {
  const snap = await getDoc(doc(firestore, "checklists", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Checklist) : null;
}

export async function listChecklists(): Promise<Checklist[]> {
  try {
    const q = query(checklistsCol(), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs
      .filter((d) => d.id !== "placeholder")
      .map((d) => ({ id: d.id, ...d.data() } as Checklist));
  } catch (e) {
    console.warn("listChecklists falhou (verifique regras Firestore):", e);
    return [];
  }
}

export async function updateChecklist(id: string, patch: Partial<Checklist>) {
  await updateDoc(doc(firestore, "checklists", id), patch);
}

export async function deleteChecklist(id: string): Promise<void> {
  await deleteDoc(doc(firestore, "checklists", id));
}

export async function deleteAllChecklists(): Promise<void> {
  const snap = await getDocs(checklistsCol());
  const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);
}

// ─── Firestore CRUD (Obras) ──────────────────────────────────────────

const obrasCol = () => collection(firestore, "obras");

export async function createObra(o: Omit<Obra, "id">): Promise<string> {
  const docRef = await addDoc(obrasCol(), { ...o, created_at: o.created_at || Date.now() });
  await updateDoc(docRef, { id: docRef.id });
  return docRef.id;
}

export async function listObras(): Promise<Obra[]> {
  try {
    const q = query(obrasCol(), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs
      .filter((d) => d.id !== "placeholder")
      .map((d) => ({ id: d.id, ...d.data() } as Obra));
  } catch (e) {
    console.warn("listObras falhou:", e);
    return [];
  }
}

export async function getObra(id: string): Promise<Obra | null> {
  const snap = await getDoc(doc(firestore, "obras", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Obra) : null;
}

export async function updateObra(id: string, patch: Partial<Obra>) {
  await updateDoc(doc(firestore, "obras", id), patch);
}

export async function deleteObra(id: string): Promise<void> {
  await deleteDoc(doc(firestore, "obras", id));
}

// ─── Utilitários ─────────────────────────────────────────────────────

export async function logUser(name: string, phone: string) {
  try {
    await addDoc(collection(firestore, "users"), {
      name,
      phone,
      created_at: Date.now(),
    });
  } catch (e) {
    console.warn("logUser falhou (regras Firebase):", e);
  }
}
