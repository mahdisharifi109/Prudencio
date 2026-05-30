import type { Checklist } from "./firebase";

/**
 * Mensagem de WhatsApp — formato profissional, sem emojis.
 * Adequado para partilha em ambientes de trabalho.
 */
export function formatWhatsAppMessage(c: Checklist, pageUrl?: string): string {
  const pdf = c.pdf_metadata || {};
  const totalQty = c.items
    .reduce((s, i) => s + parseFloat(i.quantidade.replace(",", ".") || "0"), 0)
    .toFixed(2);
  const confirmed = c.items.filter((i) => i.checked).length;
  const isComplete = c.status === "concluida";
  const isTransporte = c.tipo_guia !== "devolucao";

  let msg = "";

  msg += "────────────────────\n";
  msg += isComplete ? "*DOCUMENTO VALIDADO*\n" : "*DOCUMENTO PROCESSADO*\n";
  msg += `*${isTransporte ? "Guia de Transporte" : "Guia de Devolução"}*\n`;
  msg += "────────────────────\n\n";

  if (c.data_documento) msg += `*Data:*\n${c.data_documento}\n\n`;
  if (c.numero_guia) msg += `*Numero de Guia:*\n${c.numero_guia}\n\n`;
  if (c.codigo_at) msg += `*Chave AT:*\n${c.codigo_at}\n\n`;
  if (pdf.atcud) msg += `*ATCUD:*\n${pdf.atcud}\n\n`;
  if (c.obra_nome) msg += `*Obra:*\n${c.obra_nome}\n\n`;

  // QR Code — texto limpo
  if (pdf.qr_raw) {
    const formattedQr = pdf.qr_raw.split("*").map((part) => `  - ${part}`).join("\n");
    msg += `*QR Code Detetado:*\n${formattedQr}\n\n`;
  } else if (c.codigo_at) {
    msg += `*QR Code:* Detetado com sucesso\n\n`;
  } else {
    msg += `*QR Code:* Nao detetado\n\n`;
  }

  if (c.responsavel) msg += `*Responsavel:*\n${c.responsavel}\n\n`;

  // Artigos
  msg += "────────────────────\n";
  msg += `*ARTIGOS (${c.items.length})*\n`;
  msg += "────────────────────\n\n";

  for (let i = 0; i < c.items.length; i++) {
    const it = c.items[i];
    const status = it.checked ? "[V]" : "[  ]";

    msg += `${status} *Artigo ${i + 1}*\n`;
    msg += `Codigo: ${it.artigo}\n`;
    msg += `${it.descricao}\n`;
    msg += `Quantidade: ${it.quantidade} ${it.unidade}\n`;
    if (c.codigo_at) msg += `Chave AT: ${c.codigo_at}\n`;
    if (pdf.atcud) msg += `ATCUD: ${pdf.atcud}\n`;
    if (c.numero_guia) msg += `Guia: ${c.numero_guia}\n`;
    if (i < c.items.length - 1) msg += "\n";
  }

  // Totais
  msg += "\n────────────────────\n";
  msg += "*RESUMO*\n";
  msg += "────────────────────\n\n";
  msg += `Total de Artigos: ${c.items.length}\n`;
  msg += `Quantidade Total: ${totalQty}\n`;
  msg += `Confirmados: ${confirmed}/${c.items.length}\n`;

  if (c.observacoes_renato) msg += `\n*Observacoes:*\n${c.observacoes_renato}\n`;

  msg += "\n────────────────────\n\n";
  msg += "Documento validado\n";
  if (c.codigo_at) msg += "QR Code lido corretamente\n";
  if (c.codigo_at) msg += "Chave AT verificada\n";
  if (pdf.atcud) msg += "ATCUD validado\n";
  msg += "Excel gerado\n";
  msg += "Dados confirmados\n";

  if (pageUrl) msg += `\nLink: ${pageUrl}\n`;

  msg += "\n────────────────────\n";
  msg += "_Prudencio Impermeabilizacoes_\n";

  return msg;
}

export function shareViaWhatsApp(c: Checklist, pageUrl?: string) {
  const msg = formatWhatsAppMessage(c, pageUrl);
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
}
