import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte qualquer data (incluindo string no formato YYYY-MM-DD) para o formato DD/MM/AAAA.
 * Se já for uma data válida em formato DD/MM/AAAA, retorna-a normalizada com barras.
 */
export function formatarDataParaPT(data: string | number | Date | null | undefined): string {
  if (!data) return "—";

  if (typeof data === "string") {
    const trimmed = data.trim().replace(/\s+/g, "");

    // Formato ISO: AAAA-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})$/);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    // Formato PT/EU: DD/MM/AAAA ou DD-MM-AAAA
    const ptMatch = trimmed.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})$/);
    if (ptMatch) {
      return `${ptMatch[1]}/${ptMatch[2]}/${ptMatch[3]}`;
    }
  }

  try {
    const d = new Date(data);
    if (isNaN(d.getTime())) return String(data);
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  } catch {
    return String(data);
  }
}
