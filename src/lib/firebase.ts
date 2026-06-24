import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, push, set, get, child, update, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyClBw569jLYXKWL6lr5hYl-3ppCT7_PzJg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "n8n-prudencio.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://n8n-prudencio-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "n8n-prudencio",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "n8n-prudencio.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "397008230620",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:397008230620:web:a17568b43bca763719bc19",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-EJEFSVQHLD",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Lazy analytics (browser only)
export async function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    const { isSupported, getAnalytics } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(app);
  } catch {
    /* ignore */
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

// ─── Firebase CRUD ────────────────────────────────────────────────────

export async function createChecklist(c: Omit<Checklist, "id">): Promise<string> {
  const r = push(ref(db, "checklists"));
  const id = r.key!;
  await set(r, { ...c, id });
  return id;
}

export async function getChecklist(id: string): Promise<Checklist | null> {
  const snap = await get(child(ref(db), `checklists/${id}`));
  return snap.exists() ? (snap.val() as Checklist) : null;
}

export async function listChecklists(): Promise<Checklist[]> {
  try {
    const snap = await get(child(ref(db), `checklists`));
    if (!snap.exists()) return [];
    const v = snap.val() as Record<string, Checklist>;
    return Object.values(v).sort((a, b) => b.created_at - a.created_at);
  } catch (e) {
    console.warn("listChecklists falhou (verifique regras Firebase RTDB):", e);
    return [];
  }
}

export async function updateChecklist(id: string, patch: Partial<Checklist>) {
  await update(ref(db, `checklists/${id}`), patch);
}

export async function deleteChecklist(id: string): Promise<void> {
  await remove(ref(db, `checklists/${id}`));
}

export async function deleteAllChecklists(): Promise<void> {
  await remove(ref(db, "checklists"));
}

// ─── Obras no Firebase ───────────────────────────────────────────────

export async function createObra(o: Omit<Obra, "id">): Promise<string> {
  const r = push(ref(db, "obras"));
  const id = r.key!;
  await set(r, { ...o, id });
  return id;
}

export async function listObras(): Promise<Obra[]> {
  try {
    const snap = await get(child(ref(db), `obras`));
    if (!snap.exists()) return [];
    const v = snap.val() as Record<string, Obra>;
    return Object.values(v).sort((a, b) => b.created_at - a.created_at);
  } catch (e) {
    console.warn("listObras falhou:", e);
    return [];
  }
}

export async function getObra(id: string): Promise<Obra | null> {
  const snap = await get(child(ref(db), `obras/${id}`));
  return snap.exists() ? (snap.val() as Obra) : null;
}

export async function updateObra(id: string, patch: Partial<Obra>) {
  await update(ref(db, `obras/${id}`), patch);
}

export async function deleteObra(id: string): Promise<void> {
  await remove(ref(db, `obras/${id}`));
}

// ─── Utilitários ─────────────────────────────────────────────────────

export async function logUser(name: string, phone: string) {
  try {
    const r = push(ref(db, "users"));
    await set(r, { name, phone, created_at: Date.now() });
  } catch (e) {
    console.warn("logUser falhou (regras Firebase):", e);
  }
}
