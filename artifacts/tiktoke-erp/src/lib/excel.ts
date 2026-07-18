/**
 * Styled Excel export utility — TIK TOKE ERP
 * All exports share the same visual template:
 *   Row 1: company banner (orange)
 *   Row 2: report title (dark)
 *   Row 3: meta / period (light)
 *   Row 4: spacer
 *   Row 5+: column headers (dark) → data rows → totals
 */
import ExcelJS from "exceljs";

// ── Brand palette ──────────────────────────────────────────
const C = {
  brand:    "F97316", // orange-500
  dark:     "1C1917", // stone-900
  header:   "292524", // stone-800
  altRow:   "FFF7ED", // orange-50
  total:    "FED7AA", // orange-200
  totalFg:  "7C2D12", // orange-900
  border:   "E2E8F0", // slate-200
  white:    "FFFFFF",
  muted:    "78716C", // stone-500
  pos:      "15803D", // green-700
  neg:      "B91C1C", // red-700
};

type ColDef = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  colorFn?: (val: any, row: any) => string | undefined;
};

// ── Download helper ─────────────────────────────────────────
async function download(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : filename + ".xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Core builder ────────────────────────────────────────────
function buildSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  meta: string,
  cols: ColDef[],
  rows: Record<string, any>[],
  totals?: Record<string, any>,
) {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: false }],
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
  });

  const colCount = cols.length;

  // ── Helper: merge + style a banner row ──────────────────
  const banner = (
    rowIdx: number,
    text: string,
    bgHex: string,
    fgHex: string,
    fontSize: number,
    bold = true,
    height = 28,
  ) => {
    const row = ws.getRow(rowIdx);
    row.height = height;
    const cell = ws.getCell(rowIdx, 1);
    cell.value = text;
    cell.font = { name: "Calibri", bold, size: fontSize, color: { argb: "FF" + fgHex } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bgHex } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.mergeCells(rowIdx, 1, rowIdx, colCount);
    // borders on merged row
    for (let c = 1; c <= colCount; c++) {
      const cc = ws.getCell(rowIdx, c);
      cc.border = {
        top:    { style: "thin", color: { argb: "FF" + bgHex } },
        bottom: { style: "thin", color: { argb: "FF" + bgHex } },
        left:   c === 1 ? { style: "thin", color: { argb: "FF" + bgHex } } : undefined,
        right:  c === colCount ? { style: "thin", color: { argb: "FF" + bgHex } } : undefined,
      } as any;
    }
  };

  // ── Banner rows ─────────────────────────────────────────
  banner(1, "  🏭  TIK TOKE ERP", C.brand, C.white, 14, true, 32);
  banner(2, "  " + title,         C.dark,  C.white, 12, true, 26);
  banner(3, "  " + meta,          C.header, "D6D3D1", 9, false, 20);

  // spacer
  ws.getRow(4).height = 6;

  // ── Column headers ───────────────────────────────────────
  const headerRow = ws.getRow(5);
  headerRow.height = 22;
  cols.forEach((col, i) => {
    const cell = ws.getCell(5, i + 1);
    cell.value = col.header;
    cell.font   = { name: "Calibri", bold: true, size: 10, color: { argb: "FF" + C.white } };
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.dark } };
    cell.alignment = { vertical: "middle", horizontal: col.align ?? "left", wrapText: false, indent: 1 };
    cell.border = {
      top:    { style: "thin", color: { argb: "FF" + C.border } },
      bottom: { style: "medium", color: { argb: "FF" + C.brand } },
      left:   { style: "thin", color: { argb: "FF444444" } },
      right:  { style: "thin", color: { argb: "FF444444" } },
    };
  });

  // ── Data rows ────────────────────────────────────────────
  rows.forEach((rowData, ri) => {
    const exRow = ws.getRow(6 + ri);
    exRow.height = 18;
    const isAlt = ri % 2 === 1;

    cols.forEach((col, ci) => {
      const cell = ws.getCell(6 + ri, ci + 1);
      const val = rowData[col.key];
      cell.value = val !== undefined && val !== null ? val : "";
      if (col.numFmt && (typeof val === "number" || (typeof val === "string" && !isNaN(parseFloat(val))))) {
        cell.numFmt = col.numFmt;
        if (typeof val === "string" && !isNaN(parseFloat(val))) cell.value = parseFloat(val);
      }
      const customColor = col.colorFn?.(val, rowData);
      cell.font = {
        name: "Calibri", size: 10, bold: col.bold ?? false,
        color: { argb: "FF" + (customColor ?? C.dark) },
      };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isAlt ? "FF" + C.altRow : "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: col.align ?? "left", indent: 1 };
      cell.border = {
        top:    { style: "hair",  color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair",  color: { argb: "FFE2E8F0" } },
        left:   { style: "thin",  color: { argb: "FFE2E8F0" } },
        right:  { style: "thin",  color: { argb: "FFE2E8F0" } },
      };
    });
  });

  // ── Totals row ───────────────────────────────────────────
  if (totals && Object.keys(totals).length) {
    const tIdx = 6 + rows.length;
    const tRow = ws.getRow(tIdx);
    tRow.height = 22;
    cols.forEach((col, ci) => {
      const cell = ws.getCell(tIdx, ci + 1);
      const val = totals[col.key];
      cell.value = val !== undefined ? val : "";
      if (col.numFmt && typeof val === "number") cell.numFmt = col.numFmt;
      cell.font  = { name: "Calibri", bold: true, size: 10, color: { argb: "FF" + C.totalFg } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.total } };
      cell.alignment = { vertical: "middle", horizontal: col.align ?? "left", indent: 1 };
      cell.border = {
        top:    { style: "medium", color: { argb: "FF" + C.brand } },
        bottom: { style: "medium", color: { argb: "FF" + C.brand } },
        left:   { style: "thin",   color: { argb: "FFE2E8F0" } },
        right:  { style: "thin",   color: { argb: "FFE2E8F0" } },
      };
    });
  }

  // ── Column widths ────────────────────────────────────────
  cols.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width ?? 16;
  });
}

// ── Number formats ───────────────────────────────────────────
const MONEY = '#,##0.00';
const QTY   = '#,##0.000';
const INT   = '#,##0';

// ── Shared meta builder ─────────────────────────────────────
const periodMeta = (start?: string, end?: string) =>
  start && end
    ? `Davr: ${start} — ${end}  |  Sana: ${new Date().toLocaleDateString("uz-UZ")}`
    : `Sana: ${new Date().toLocaleDateString("uz-UZ")}`;

// ════════════════════════════════════════════════════════════
//  EXPORT FUNCTIONS
// ════════════════════════════════════════════════════════════

export async function xlProducts(data: any[], filename = "mahsulotlar.xlsx") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",            key: "_no",        width: 5,  align: "center" },
    { header: "Kod",          key: "code",       width: 14 },
    { header: "Nomi",         key: "name",       width: 30, bold: true },
    { header: "Birlik",       key: "unitName",   width: 12, align: "center" },
    { header: "Og'irligi (kg)", key: "weight",   width: 14, align: "right", numFmt: QTY },
    { header: "Narxi (so'm)", key: "sellingPrice", width: 18, align: "right", numFmt: MONEY },
    { header: "Qoldiq",       key: "stock",      width: 14, align: "right", numFmt: QTY },
  ];
  const rows = data.map((r, i) => ({ ...r, _no: i + 1 }));
  buildSheet(wb, "Mahsulotlar", "Mahsulotlar ro'yxati", periodMeta(), cols, rows);
  await download(wb, filename);
}

export async function xlRawMaterials(data: any[], filename = "hom-ashyo.xlsx") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",        key: "_no",      width: 5,  align: "center" },
    { header: "Kod",      key: "code",     width: 14 },
    { header: "Nomi",     key: "name",     width: 30, bold: true },
    { header: "Birlik",   key: "unitName", width: 12, align: "center" },
    { header: "Qoldiq",   key: "stock",    width: 16, align: "right", numFmt: QTY },
    { header: "Narxi (so'm)", key: "lastPrice", width: 18, align: "right", numFmt: MONEY },
  ];
  const rows = data.map((r, i) => ({ ...r, _no: i + 1 }));
  buildSheet(wb, "Hom ashyo", "Hom ashyo ro'yxati", periodMeta(), cols, rows);
  await download(wb, filename);
}

export async function xlRmReceipts(data: any[], start: string, end: string, filename = "hom-ashyo-kirim.xlsx") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",            key: "_no",          width: 5,  align: "center" },
    { header: "Raqam",        key: "receiptNumber", width: 14, bold: true },
    { header: "Sana",         key: "date",          width: 14, align: "center" },
    { header: "Yetkazuvchi",  key: "supplierName",  width: 24 },
    { header: "Summa (so'm)", key: "totalAmount",   width: 20, align: "right", numFmt: MONEY },
    { header: "Izoh",         key: "note",          width: 28 },
  ];
  const rows = data.map((r, i) => ({ ...r, _no: i + 1 }));
  const total = rows.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);
  buildSheet(wb, "Kirim", "Hom ashyo kirim hujjatlari", periodMeta(start, end), cols, rows,
    { _no: "JAMI:", totalAmount: total });
  await download(wb, filename);
}

export async function xlRmReceiptDetail(detail: any, filename?: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",           key: "_no",             width: 5,  align: "center" },
    { header: "Hom ashyo",   key: "rawMaterialName", width: 30, bold: true },
    { header: "Kod",         key: "rawMaterialCode", width: 14 },
    { header: "Miqdor",      key: "quantity",        width: 14, align: "right", numFmt: QTY },
    { header: "Birlik",      key: "unitShort",       width: 10, align: "center" },
    { header: "Narxi (so'm)", key: "unitPrice",      width: 18, align: "right", numFmt: MONEY },
    { header: "Jami (so'm)", key: "totalPrice",      width: 20, align: "right", numFmt: MONEY },
  ];
  const rows = (detail.items || []).map((r: any, i: number) => ({ ...r, _no: i + 1 }));
  const total = rows.reduce((s: number, r: any) => s + parseFloat(r.totalPrice || 0), 0);
  const meta = `Raqam: ${detail.receiptNumber}  |  Sana: ${detail.date}  |  Yetkazuvchi: ${detail.supplierName || "—"}`;
  buildSheet(wb, "Kirim", `Kirim: ${detail.receiptNumber}`, meta, cols, rows,
    { _no: "JAMI:", totalPrice: total });
  await download(wb, filename || `${detail.receiptNumber}.xlsx`);
}

export async function xlProductions(data: any[], start: string, end: string, filename = "ishlab-chiqarish.xlsx") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",         key: "_no",              width: 5,  align: "center" },
    { header: "Raqam",     key: "productionNumber", width: 16, bold: true },
    { header: "Sana",      key: "date",             width: 14, align: "center" },
    { header: "Mahsulot",  key: "productName",      width: 28 },
    { header: "Miqdor",    key: "quantity",         width: 14, align: "right", numFmt: QTY },
    { header: "Birlik",    key: "unitShort",        width: 10, align: "center" },
    { header: "Izoh",      key: "note",             width: 28 },
  ];
  const rows = data.map((r, i) => ({ ...r, _no: i + 1 }));
  buildSheet(wb, "Ishlab chiqarish", "Ishlab chiqarish hisoboti", periodMeta(start, end), cols, rows);
  await download(wb, filename);
}

export async function xlProductionDetail(detail: any, filename?: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",      key: "_no",    width: 5,  align: "center" },
    { header: "Tur",    key: "kind",   width: 14, align: "center" },
    { header: "Nomi",   key: "name",   width: 30, bold: true },
    { header: "Miqdor", key: "qty",    width: 14, align: "right", numFmt: QTY },
    { header: "Birlik", key: "unit",   width: 10, align: "center" },
  ];
  const outputs = (detail.outputs || []).map((o: any, i: number) => ({
    _no: i + 1, kind: "📦 Mahsulot", name: o.productName, qty: o.quantity, unit: o.unitShort,
  }));
  const inputs = (detail.inputs || []).map((inp: any, i: number) => ({
    _no: outputs.length + i + 1, kind: "🌿 Hom ashyo", name: inp.rawMaterialName, qty: inp.quantity, unit: inp.unitShort,
  }));
  const meta = `Raqam: ${detail.productionNumber}  |  Sana: ${detail.date}`;
  buildSheet(wb, "Prixod", `Prixod: ${detail.productionNumber}`, meta, cols, [...outputs, ...inputs]);
  await download(wb, filename || `${detail.productionNumber}.xlsx`);
}

export async function xlDeliveries(data: any[], start: string, end: string, filename = "yuk-chiqarish.xlsx") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",           key: "_no",            width: 5,  align: "center" },
    { header: "Raqam",       key: "deliveryNumber", width: 14, bold: true },
    { header: "Sana",        key: "date",           width: 14, align: "center" },
    { header: "Klient",      key: "customerName",   width: 24 },
    { header: "To'lov turi", key: "paymentMethod",  width: 14, align: "center" },
    { header: "Summa (so'm)", key: "totalAmount",   width: 20, align: "right", numFmt: MONEY },
    { header: "Izoh",        key: "note",           width: 28 },
  ];
  const rows = data.map((r, i) => ({
    ...r, _no: i + 1,
    paymentMethod: ({ cash: "Naqd", card: "Karta", transfer: "O'tkazma", credit: "Nasiya" }[r.paymentMethod as string] ?? r.paymentMethod),
  }));
  const total = rows.reduce((s, r) => s + parseFloat(r.totalAmount || 0), 0);
  buildSheet(wb, "Yuk chiqarish", "Yuk chiqarish hujjatlari", periodMeta(start, end), cols, rows,
    { _no: "JAMI:", totalAmount: total });
  await download(wb, filename);
}

export async function xlAdjustments(data: any[], filename = "korrektirovka.xlsx") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",      key: "_no",     width: 5,  align: "center" },
    { header: "Sana",   key: "date",    width: 14, align: "center" },
    { header: "Turi",   key: "type",    width: 14, align: "center" },
    { header: "Nomi",   key: "name",    width: 30, bold: true },
    { header: "Miqdor", key: "quantity", width: 14, align: "right", numFmt: QTY,
      colorFn: (v: number) => v < 0 ? C.neg : C.pos },
    { header: "Birlik", key: "unit",    width: 10, align: "center" },
    { header: "Sabab",  key: "reason",  width: 32 },
  ];
  const rows = data.map((r, i) => ({ ...r, _no: i + 1 }));
  buildSheet(wb, "Korrektirovka", "Korrektirovka (inventarizatsiya)", periodMeta(), cols, rows);
  await download(wb, filename);
}

export async function xlKassaTxs(data: any[], start: string, end: string, filename = "kassa-tranzaksiyalar.xlsx") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",           key: "_no",      width: 5,  align: "center" },
    { header: "Sana",        key: "date",     width: 14, align: "center" },
    { header: "Tur",         key: "partyType", width: 14, align: "center" },
    { header: "Nomi",        key: "partyName", width: 26, bold: true },
    { header: "Yo'nalish",   key: "dir",      width: 12, align: "center" },
    { header: "Kirim (so'm)", key: "income",  width: 18, align: "right", numFmt: MONEY, colorFn: (v) => v ? C.pos : undefined },
    { header: "Chiqim (so'm)", key: "expense", width: 18, align: "right", numFmt: MONEY, colorFn: (v) => v ? C.neg : undefined },
    { header: "To'lov turi", key: "payMethod", width: 14, align: "center" },
    { header: "Izoh",        key: "note",     width: 28 },
  ];
  const PAY: Record<string, string> = { cash: "Naqd", card: "Karta", transfer: "O'tkazma", credit: "Nasiya" };
  const rows = data.map((r, i) => ({
    _no: i + 1, date: r.date,
    partyType: r.partyType === "customer" ? "Mijoz" : "Yetkazuvchi",
    partyName: r.partyName,
    dir: r.direction === "in" ? "↓ Kirim" : "↑ Chiqim",
    income:  r.direction === "in"  ? parseFloat(r.amount) : null,
    expense: r.direction === "out" ? parseFloat(r.amount) : null,
    payMethod: PAY[r.paymentMethod] ?? r.paymentMethod,
    note: r.note ?? "",
  }));
  const totalIn  = rows.reduce((s, r) => s + (r.income  || 0), 0);
  const totalOut = rows.reduce((s, r) => s + (r.expense || 0), 0);
  buildSheet(wb, "Tranzaksiyalar", "Kassa tranzaksiyalari", periodMeta(start, end), cols, rows,
    { _no: "JAMI:", income: totalIn, expense: totalOut });
  await download(wb, filename);
}

export async function xlKassaReport(
  data: any[], start: string, end: string,
  totalIn: number, totalOut: number,
  filename = "kassa-hisobot.xlsx",
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const ws = wb.addWorksheet("Hisobot", { views: [{ showGridLines: false }] });

  // Helpers
  const setCell = (r: number, c: number, val: any, opts: Partial<ExcelJS.Cell> & { bgHex?: string; fgHex?: string; sz?: number; bold?: boolean; align?: string; numFmt?: string; border?: boolean } = {}) => {
    const cell = ws.getCell(r, c);
    cell.value = val;
    if (opts.fgHex) cell.font = { name: "Calibri", bold: opts.bold ?? false, size: opts.sz ?? 10, color: { argb: "FF" + opts.fgHex } };
    else cell.font = { name: "Calibri", bold: opts.bold ?? false, size: opts.sz ?? 10 };
    if (opts.bgHex) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + opts.bgHex } };
    cell.alignment = { vertical: "middle", horizontal: (opts.align ?? "left") as any, indent: 1 };
    if (opts.numFmt) cell.numFmt = opts.numFmt;
    if (opts.border !== false) {
      cell.border = { top: { style: "hair", color: { argb: "FFE2E8F0" } }, bottom: { style: "hair", color: { argb: "FFE2E8F0" } }, left: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } } };
    }
    return cell;
  };
  const merge = (r: number, c1: number, c2: number) => ws.mergeCells(r, c1, r, c2);

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 20;
  ws.getColumn(5).width = 16;
  ws.getColumn(6).width = 18;
  ws.getColumn(7).width = 18;
  ws.getColumn(8).width = 14;
  ws.getColumn(9).width = 28;

  // Banner
  ws.getRow(1).height = 32;
  setCell(1, 1, "  🏭  TIK TOKE ERP — KASSA HISOBOTI", { bgHex: C.brand, fgHex: C.white, sz: 14, bold: true, border: false });
  merge(1, 1, 9);

  ws.getRow(2).height = 22;
  setCell(2, 1, `  Davr: ${start} — ${end}`, { bgHex: C.dark, fgHex: C.white, sz: 10, border: false });
  merge(2, 1, 9);

  // Summary cards (row 4-7)
  ws.getRow(3).height = 10;
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 28;
  ws.getRow(6).height = 18;
  ws.getRow(7).height = 10;

  const cards = [
    { label: "JAMI KIRIM", val: totalIn,         bg: "DCFCE7", fg: C.pos, hl: "15803D" },
    { label: "JAMI CHIQIM", val: totalOut,        bg: "FEF3C7", fg: "B45309", hl: "D97706" },
    { label: "SOF BALANS",  val: totalIn - totalOut, bg: totalIn - totalOut >= 0 ? "EFF6FF" : "FEF2F2", fg: totalIn - totalOut >= 0 ? "1D4ED8" : C.neg, hl: totalIn - totalOut >= 0 ? "1D4ED8" : C.neg },
  ];
  const cardCols = [[2, 3], [4, 5], [6, 7]];
  cards.forEach((card, idx) => {
    const [c1, c2] = cardCols[idx];
    merge(4, c1, c2); setCell(4, c1, card.label, { bgHex: card.bg, fgHex: card.hl, bold: true, sz: 9, align: "center", border: false });
    merge(5, c1, c2); setCell(5, c1, card.val, { bgHex: card.bg, fgHex: card.hl, bold: true, sz: 16, align: "center", numFmt: MONEY, border: false });
    merge(6, c1, c2); setCell(6, c1, `${data.filter((t) => card.label.includes("KIRIM") ? t.direction === "in" : card.label.includes("CHIQIM") ? t.direction === "out" : true).length} ta operatsiya`, { bgHex: card.bg, fgHex: card.fg, sz: 9, align: "center", border: false });
  });

  // Table headers (row 9)
  ws.getRow(8).height = 6;
  ws.getRow(9).height = 22;
  const hdrs = ["#", "Sana", "Tur", "Nomi", "Yo'nalish", "Kirim (so'm)", "Chiqim (so'm)", "To'lov", "Izoh"];
  hdrs.forEach((h, i) => {
    const cell = ws.getCell(9, i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FF" + C.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.dark } };
    cell.alignment = { vertical: "middle", horizontal: i >= 5 && i <= 6 ? "right" : "left", indent: 1 };
    cell.border = { bottom: { style: "medium", color: { argb: "FF" + C.brand } }, top: { style: "thin", color: { argb: "FF333333" } }, left: { style: "thin", color: { argb: "FF333333" } }, right: { style: "thin", color: { argb: "FF333333" } } };
  });

  const PAY: Record<string, string> = { cash: "Naqd", card: "Karta", transfer: "O'tkazma", credit: "Nasiya" };
  data.forEach((t, ri) => {
    const exRow = 10 + ri;
    ws.getRow(exRow).height = 18;
    const alt = ri % 2 === 1;
    const bg = alt ? C.altRow : C.white;
    const income  = t.direction === "in"  ? parseFloat(t.amount) : null;
    const expense = t.direction === "out" ? parseFloat(t.amount) : null;
    const vals: (string | number | null)[] = [
      ri + 1, t.date, t.partyType === "customer" ? "Mijoz" : "Yetkazuvchi",
      t.partyName, t.direction === "in" ? "↓ Kirim" : "↑ Chiqim",
      income, expense, PAY[t.paymentMethod] ?? t.paymentMethod, t.note ?? "",
    ];
    vals.forEach((v, ci) => {
      const cell = ws.getCell(exRow, ci + 1);
      cell.value = v !== null ? v : "";
      if ((ci === 5 || ci === 6) && v !== null) { cell.numFmt = MONEY; }
      cell.font = { name: "Calibri", size: 10, bold: ci === 3, color: { argb: "FF" + (ci === 5 && v ? C.pos : ci === 6 && v ? C.neg : C.dark) } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bg } };
      cell.alignment = { vertical: "middle", horizontal: (ci >= 5 && ci <= 6) ? "right" : "left", indent: 1 };
      cell.border = { top: { style: "hair", color: { argb: "FFE2E8F0" } }, bottom: { style: "hair", color: { argb: "FFE2E8F0" } }, left: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } } };
    });
  });

  // Totals
  const tr = 10 + data.length;
  ws.getRow(tr).height = 22;
  ["JAMI:", "", "", "", "", totalIn, totalOut, "", ""].forEach((v, ci) => {
    const cell = ws.getCell(tr, ci + 1);
    cell.value = v !== "" ? v : "";
    if ((ci === 5 || ci === 6) && typeof v === "number") cell.numFmt = MONEY;
    cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FF" + C.totalFg } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.total } };
    cell.alignment = { vertical: "middle", horizontal: ci >= 5 && ci <= 6 ? "right" : "left", indent: 1 };
    cell.border = { top: { style: "medium", color: { argb: "FF" + C.brand } }, bottom: { style: "medium", color: { argb: "FF" + C.brand } }, left: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } } };
  });

  await download(wb, filename);
}

export async function xlSverka(sverka: any, filename?: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const isCustomer = sverka.partyType === "customer";
  const cols: ColDef[] = [
    { header: "#",              key: "_no",           width: 5,  align: "center" },
    { header: "Sana",           key: "date",          width: 14, align: "center" },
    { header: "Hujjat turi",    key: "kindLabel",     width: 18 },
    { header: "Tavsif",         key: "description",   width: 36, bold: true },
    { header: "Qarz (debit)",   key: "debit",         width: 20, align: "right", numFmt: MONEY, colorFn: (v) => v > 0 ? C.neg : undefined },
    { header: "To'lov (kredit)", key: "credit",       width: 20, align: "right", numFmt: MONEY, colorFn: (v) => v > 0 ? C.pos : undefined },
    { header: "Joriy qoldiq",   key: "runningBalance", width: 20, align: "right", numFmt: MONEY,
      colorFn: (v) => parseFloat(v) > 0 ? C.neg : parseFloat(v) < 0 ? C.pos : undefined },
  ];
  const KIND: Record<string, string> = { delivery: "🚚 Yuk chiqarish", receipt: "📦 Xom ashyo kirim", payment: "💳 To'lov" };
  const rows = (sverka.transactions || []).map((r: any, i: number) => ({
    _no: i + 1, date: r.date,
    kindLabel: KIND[r.kind] ?? r.kind,
    description: r.description,
    debit:  r.debit  > 0 ? r.debit  : null,
    credit: r.credit > 0 ? r.credit : null,
    runningBalance: parseFloat(r.runningBalance),
  }));
  const bal = sverka.currentBalance;
  const balLabel = bal === 0 ? "Toza" : isCustomer
    ? (bal > 0 ? `${bal.toLocaleString("uz-UZ")} so'm — Mijoz qarzdor` : `${Math.abs(bal).toLocaleString("uz-UZ")} so'm — Ortiqcha to'lagan`)
    : (bal > 0 ? `${bal.toLocaleString("uz-UZ")} so'm — Biz qarzdormiz` : `${Math.abs(bal).toLocaleString("uz-UZ")} so'm — Ortiqcha to'langan`);
  const meta = `${sverka.partyName}  |  Joriy qoldiq: ${balLabel}  |  Sana: ${new Date().toLocaleDateString("uz-UZ")}`;
  buildSheet(wb, "Akt sverka", `Akt Sverka — ${sverka.partyName}`, meta, cols, rows,
    { _no: "JAMI:", debit: rows.reduce((s: number, r: any) => s + (r.debit || 0), 0), credit: rows.reduce((s: number, r: any) => s + (r.credit || 0), 0) });
  await download(wb, filename || `sverka-${sverka.partyName}-${new Date().toISOString().split("T")[0]}.xlsx`);
}

export async function xlForecast(data: any[], filename = "prognoz.xlsx") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",                  key: "_no",           width: 5,  align: "center" },
    { header: "Mahsulot nomi",      key: "productName",   width: 30, bold: true },
    { header: "Birlik",             key: "unit",          width: 12, align: "center" },
    { header: "Ishlab chiqarish imkoni", key: "canMake",  width: 22, align: "right", numFmt: INT },
    { header: "Xom ashyo formulasi", key: "recipe",       width: 40 },
  ];
  const rows = data.map((r, i) => ({ ...r, _no: i + 1 }));
  buildSheet(wb, "Prognoz", "Prognoz (ishlab chiqarish imkoni)", periodMeta(), cols, rows);
  await download(wb, filename);
}

export async function xlWeeklyPlan(data: any[], weekStart: string, filename?: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",            key: "_no",          width: 5,  align: "center" },
    { header: "Hafta boshi",  key: "weekStart",    width: 16, align: "center" },
    { header: "Mahsulot kodi", key: "productCode", width: 16 },
    { header: "Mahsulot nomi", key: "productName", width: 30, bold: true },
    { header: "Birlik",       key: "unitShort",    width: 10, align: "center" },
    { header: "Reja (miqdor)", key: "plannedQuantity", width: 18, align: "right", numFmt: QTY },
    { header: "Izoh",         key: "note",         width: 32 },
  ];
  const rows = data.map((r, i) => ({ ...r, _no: i + 1 }));
  const total = rows.reduce((s, r) => s + parseFloat(r.plannedQuantity || 0), 0);
  buildSheet(wb, "Haftalik reja", "Haftalik ishlab chiqarish rejasi", `Hafta: ${weekStart}  |  Sana: ${new Date().toLocaleDateString("uz-UZ")}`, cols, rows,
    { _no: "JAMI:", plannedQuantity: total });
  await download(wb, filename || `haftalik-reja-${weekStart}.xlsx`);
}

export async function xlReportRmReceipts(data: any[], start: string, end: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",            key: "_no",             width: 5,  align: "center" },
    { header: "Raqam",        key: "receiptNumber",   width: 14, bold: true },
    { header: "Sana",         key: "date",            width: 14, align: "center" },
    { header: "Yetkazuvchi",  key: "supplierName",    width: 22 },
    { header: "Hom ashyo",    key: "rawMaterialName", width: 28 },
    { header: "Miqdor",       key: "quantity",        width: 14, align: "right", numFmt: QTY },
    { header: "Birlik",       key: "unit",            width: 10, align: "center" },
    { header: "Narxi (so'm)", key: "unitPrice",       width: 18, align: "right", numFmt: MONEY },
    { header: "Jami (so'm)",  key: "total",           width: 20, align: "right", numFmt: MONEY },
  ];
  const rows = data.map((r, i) => ({ ...r, _no: i + 1 }));
  const sumTotal = rows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
  buildSheet(wb, "Hisobot", "Hom ashyo kirim hisoboti", periodMeta(start, end), cols, rows,
    { _no: "JAMI:", total: sumTotal });
  await download(wb, `hom-ashyo-kirim-hisobot-${start}-${end}.xlsx`);
}

export async function xlReportProductions(data: any[], start: string, end: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",          key: "_no",           width: 5,  align: "center" },
    { header: "Raqam",      key: "productionNumber", width: 14, bold: true },
    { header: "Sana",       key: "date",          width: 14, align: "center" },
    { header: "Mahsulot",   key: "productName",   width: 28 },
    { header: "Miqdor",     key: "quantity",      width: 14, align: "right", numFmt: QTY },
    { header: "Birlik",     key: "unit",          width: 10, align: "center" },
    { header: "Tannarx (so'm)", key: "costTotal", width: 20, align: "right", numFmt: MONEY },
  ];
  const rows = data.map((r, i) => ({ ...r, _no: i + 1 }));
  buildSheet(wb, "Hisobot", "Ishlab chiqarish hisoboti", periodMeta(start, end), cols, rows);
  await download(wb, `ishlab-chiqarish-hisobot-${start}-${end}.xlsx`);
}

export async function xlReportDeliveries(data: any[], start: string, end: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",           key: "_no",            width: 5,  align: "center" },
    { header: "Raqam",       key: "deliveryNumber", width: 14, bold: true },
    { header: "Sana",        key: "date",           width: 14, align: "center" },
    { header: "Klient",      key: "customerName",   width: 22 },
    { header: "To'lov",      key: "paymentMethod",  width: 12, align: "center" },
    { header: "Mahsulot",    key: "productName",    width: 26 },
    { header: "Miqdor",      key: "quantity",       width: 12, align: "right", numFmt: QTY },
    { header: "Birlik",      key: "unit",           width: 10, align: "center" },
    { header: "Narxi",       key: "unitPrice",      width: 16, align: "right", numFmt: MONEY },
    { header: "Chegirma %",  key: "discountPercent", width: 12, align: "center" },
    { header: "Jami (so'm)", key: "total",          width: 20, align: "right", numFmt: MONEY },
  ];
  const rows = data.map((r, i) => ({ ...r, _no: i + 1 }));
  const sumTotal = rows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
  buildSheet(wb, "Hisobot", "Yuk chiqarish hisoboti", periodMeta(start, end), cols, rows,
    { _no: "JAMI:", total: sumTotal });
  await download(wb, `yuk-chiqarish-hisobot-${start}-${end}.xlsx`);
}

export async function xlReportProfit(data: any[], start: string, end: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TIK TOKE ERP";
  const cols: ColDef[] = [
    { header: "#",            key: "_no",       width: 5,  align: "center" },
    { header: "Mahsulot",     key: "product",   width: 30, bold: true },
    { header: "Sotilgan miqdor", key: "qty",    width: 18, align: "right", numFmt: QTY },
    { header: "Tushum (so'm)", key: "revenue",  width: 20, align: "right", numFmt: MONEY },
    { header: "Tannarx (so'm)", key: "cost",    width: 20, align: "right", numFmt: MONEY },
    { header: "Foyda (so'm)", key: "profit",    width: 20, align: "right", numFmt: MONEY,
      colorFn: (v) => v > 0 ? C.pos : v < 0 ? C.neg : undefined },
  ];
  const rows = data.map((r, i) => ({ ...r, _no: i + 1 }));
  const sumRevenue = rows.reduce((s, r) => s + parseFloat(r.revenue || 0), 0);
  const sumCost    = rows.reduce((s, r) => s + parseFloat(r.cost    || 0), 0);
  const sumProfit  = rows.reduce((s, r) => s + parseFloat(r.profit  || 0), 0);
  buildSheet(wb, "Foyda", "Foyda hisoboti", periodMeta(start, end), cols, rows,
    { _no: "JAMI:", revenue: sumRevenue, cost: sumCost, profit: sumProfit });
  await download(wb, `foyda-hisobot-${start}-${end}.xlsx`);
}
