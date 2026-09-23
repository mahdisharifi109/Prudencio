// ─── Tipos partilhados ──────────────────────────────────────────────
// Todos os tipos da aplicação, centralizados num único ficheiro.

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

export type UserRole = "admin" | "operator";

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};
