import * as XLSX from "xlsx";
import type { Checklist } from "./types";
import { formatarDataParaPT } from "./utils";

/** Exportação Excel profissional — 3 sheets, styled, dados completos */
export function exportChecklistToExcel(c: Checklist) {
  const wb = XLSX.utils.book_new();
  const pdf = c.pdf_metadata || {};
  const now = new Date();
  const ts = now.toLocaleString("pt-PT");
  const tipoDoc = c.tipo_guia === "devolucao" ? "Guia de Devolução" : "Guia de Transporte";

  // ═══ SHEET 1: ARTIGOS ═══
  const hdr = [
    "Data",
    "N. Guia",
    "Artigo",
    "Chave AT",
    "ATCUD",
    "Descricao",
    "Quantidade",
    "Unidade",
    "Confirmado",
    "Tipo Documento",
    "Obra",
    "Estado",
  ];
  const rows = c.items.map((i) => [
    formatarDataParaPT(c.data_documento),
    c.numero_guia || "",
    i.artigo,
    c.codigo_at || "",
    pdf.atcud || "",
    i.descricao,
    i.quantidade,
    i.unidade,
    i.checked ? "Confirmado" : "Pendente",
    tipoDoc,
    c.obra_nome || "",
    "Validado",
  ]);

  const wsArt = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
  wsArt["!cols"] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 55 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 20 },
    { wch: 30 },
    { wch: 16 },
  ];
  wsArt["!autofilter"] = { ref: `A1:L${rows.length + 1}` };

  for (let col = 0; col < hdr.length; col++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: col });
    if (wsArt[addr]) {
      wsArt[addr].s = {
        font: { bold: true, color: { rgb: "FFFFFF" }, name: "Aptos", sz: 11 },
        fill: { fgColor: { rgb: "0A2540" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: { bottom: { style: "medium", color: { rgb: "3B82F6" } } },
      };
    }
  }
  for (let r = 0; r < rows.length; r++) {
    for (let col = 0; col < hdr.length; col++) {
      const addr = XLSX.utils.encode_cell({ r: r + 1, c: col });
      if (wsArt[addr]) {
        wsArt[addr].s = {
          font: { name: "Aptos", sz: 10 },
          fill: { fgColor: { rgb: r % 2 === 0 ? "F0F4F8" : "FFFFFF" } },
          alignment: { vertical: "center", wrapText: col === 5 },
          border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } },
        };
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, wsArt, "Artigos");

  // ═══ SHEET 2: RESUMO COMPLETO ═══
  const totalQty = c.items.reduce((s, i) => {
    const n = parseFloat(i.quantidade.replace(",", "."));
    return s + (isNaN(n) ? 0 : n);
  }, 0);
  const confirmed = c.items.filter((i) => i.checked).length;
  const units = [...new Set(c.items.map((i) => i.unidade))];

  const resumo: string[][] = [
    [`${tipoDoc.toUpperCase()} — RESUMO COMPLETO`, ""],
    ["", ""],
    ["=== DOCUMENTO ===", ""],
    ["Tipo de Documento", tipoDoc],
    ["N. Guia de Transporte", c.numero_guia || "—"],
    ["Chave AT", c.codigo_at || "—"],
    ["ATCUD", pdf.atcud || "—"],
    ["Data do Documento", formatarDataParaPT(c.data_documento)],
    ["V/N. Contribuinte", pdf.vn_contrib || "—"],
    ["Obra", c.obra_nome || "—"],
    ["", ""],
    ["=== EMISSOR / FORNECEDOR ===", ""],
    ["Empresa", pdf.emissor_empresa || "J. PRUDENCIO, LDA"],
    ["Contribuinte N.", pdf.emissor_contribuinte || "—"],
    ["Morada", pdf.emissor_morada || "—"],
    ["Contactos", pdf.emissor_contactos || "—"],
    ["Capital Social", pdf.emissor_capital_social || "—"],
    ["", ""],
    ["=== DESTINATARIO ===", ""],
    ["Nome / Entidade", pdf.destinatario_nome || "—"],
    ["Morada", pdf.destinatario_morada || "—"],
    ["", ""],
    ["=== TRANSPORTE ===", ""],
    ["Data de Carga", formatarDataParaPT(c.data_carga)],
    ["Hora de Carga", c.hora_carga || "—"],
    ["Local de Carga", pdf.carga_local || "—"],
    ["Local de Descarga", pdf.descarga_local || "—"],
    ["Morada de Descarga", pdf.descarga_morada || "—"],
    ["Data Disponibilizacao", formatarDataParaPT(pdf.disponibilizacao)],
    ["Certificacao Software", pdf.certificacao || "—"],
    ["", ""],
    ["=== ESTATISTICAS ===", ""],
    ["Total de Artigos", String(c.items.length)],
    ["Artigos Confirmados", `${confirmed} / ${c.items.length}`],
    ["Quantidade Total", totalQty.toFixed(2)],
    ["Unidades Utilizadas", units.join(", ") || "—"],
    ["Estado", c.status === "concluida" ? "Validada" : "Pendente"],
    ["", ""],
    ["=== OBSERVACOES ===", ""],
    ["Observacoes", c.observacoes_renato || "—"],
    ["Observacoes do Colaborador", c.observacoes_colaborador || "—"],
    ["Responsavel", c.responsavel || "—"],
    ["", ""],
    ["=== QR CODE ===", ""],
    ["QR Code Extraido", c.codigo_at || "—"],
    ["Estado Validacao", "Validado"],
    ["", ""],
    ["=== PROCESSAMENTO ===", ""],
    ["Data/Hora de Exportacao", ts],
    ["Criada em", new Date(c.created_at).toLocaleString("pt-PT")],
    ["Submetida em", c.submitted_at ? new Date(c.submitted_at).toLocaleString("pt-PT") : "—"],
    ["Gerado por", "Prudencio GuiaEasy v2.0"],
  ];

  const wsRes = XLSX.utils.aoa_to_sheet(resumo);
  wsRes["!cols"] = [{ wch: 32 }, { wch: 65 }];

  for (let r = 0; r < resumo.length; r++) {
    const lbl = XLSX.utils.encode_cell({ r, c: 0 });
    const val = XLSX.utils.encode_cell({ r, c: 1 });
    if (r === 0 && wsRes[lbl]) {
      wsRes[lbl].s = { font: { bold: true, sz: 16, color: { rgb: "0A2540" }, name: "Aptos" } };
    } else if (resumo[r][0].startsWith("===") && wsRes[lbl]) {
      wsRes[lbl].s = {
        font: { bold: true, sz: 12, color: { rgb: "0A2540" }, name: "Aptos" },
        fill: { fgColor: { rgb: "EFF6FF" } },
        border: { bottom: { style: "thin", color: { rgb: "3B82F6" } } },
      };
    } else if (resumo[r][0] && wsRes[lbl]) {
      wsRes[lbl].s = { font: { bold: true, name: "Aptos", sz: 10, color: { rgb: "475569" } } };
    }
    if (wsRes[val]) {
      wsRes[val].s = {
        font: { name: "Aptos", sz: 10 },
        alignment: { wrapText: true, vertical: "top" },
      };
    }
  }
  XLSX.utils.book_append_sheet(wb, wsRes, "Resumo");

  // ═══ SHEET 3: LOG ═══
  const logRows: string[][] = [
    ["LOG DE PROCESSAMENTO", "", ""],
    ["", "", ""],
    ["Data/Hora", "Evento", "Detalhes"],
    [ts, "Exportacao Excel", `${c.items.length} artigos, Qtd Total: ${totalQty.toFixed(2)}`],
    [ts, "Documento", `${c.numero_guia || "—"} / ${formatarDataParaPT(c.data_documento)}`],
    [ts, "Tipo", tipoDoc],
    [ts, "Chave AT", c.codigo_at || "Nao disponivel"],
    [ts, "QR Code", c.codigo_at ? "Lido" : "Nao lido"],
    [ts, "Fornecedor", pdf.emissor_empresa || "—"],
    [ts, "Destinatario", pdf.destinatario_nome || "—"],
    [ts, "Obra", c.obra_nome || "—"],
    [ts, "Estado", c.status === "concluida" ? "Validada" : "Pendente"],
    [ts, "Validacao", "Todos os campos validados"],
  ];

  const wsLog = XLSX.utils.aoa_to_sheet(logRows);
  wsLog["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 55 }];

  if (wsLog["A1"])
    wsLog["A1"].s = { font: { bold: true, sz: 14, color: { rgb: "0A2540" }, name: "Aptos" } };
  for (let col = 0; col < 3; col++) {
    const addr = XLSX.utils.encode_cell({ r: 2, c: col });
    if (wsLog[addr]) {
      wsLog[addr].s = {
        font: { bold: true, color: { rgb: "FFFFFF" }, name: "Aptos", sz: 10 },
        fill: { fgColor: { rgb: "475569" } },
        alignment: { horizontal: "center" },
      };
    }
  }
  XLSX.utils.book_append_sheet(wb, wsLog, "Log");

  const d = (c.data_documento || "").replace(/-/g, "");
  const g = (c.numero_guia || "").replace(/[/\\]/g, "-");
  XLSX.writeFile(wb, `Guia_${g || c.codigo_at || c.id}_${d}.xlsx`);
}
