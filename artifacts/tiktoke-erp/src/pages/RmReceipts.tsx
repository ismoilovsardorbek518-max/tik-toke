import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, fmt, fmtDate, exportXlsx, today, monthAgo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Eye, Pencil, Download, ArrowDownToLine, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RM { id: number; name: string; code: string | null; unitShort: string | null; }
interface Supplier { id: number; name: string; }
interface Receipt {
  id: number; receiptNumber: string; date: string; supplierId: number | null;
  supplierName: string | null; totalAmount: string; note: string | null;
}
interface ReceiptDetail extends Receipt {
  items: Array<{
    id: number; rawMaterialName: string; rawMaterialCode: string | null;
    unitShort: string | null; quantity: string; unitPrice: string; totalPrice: string;
  }>;
}

interface LineItem { rawMaterialId: string; quantity: string; unitPrice: string; }
const newLine = (): LineItem => ({ rawMaterialId: "", quantity: "", unitPrice: "" });

export default function RmReceipts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(monthAgo());
  const [endDate, setEndDate] = useState(today());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  // Form state
  const [date, setDate] = useState(today());
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineItem[]>([newLine()]);

  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ["rm-receipts", startDate, endDate],
    queryFn: () => apiFetch(`/rm-receipts?startDate=${startDate}&endDate=${endDate}`),
  });

  const { data: detail } = useQuery<ReceiptDetail>({
    queryKey: ["rm-receipt", viewId],
    queryFn: () => apiFetch(`/rm-receipts/${viewId}`),
    enabled: viewId !== null,
  });

  const { data: rawMaterials = [] } = useQuery<RM[]>({
    queryKey: ["raw-materials"],
    queryFn: () => apiFetch("/raw-materials"),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => apiFetch("/suppliers"),
  });

  const saveMutation = useMutation({
    mutationFn: (body: object) => editId
      ? apiFetch(`/rm-receipts/${editId}`, { method: "PUT", body: JSON.stringify(body) })
      : apiFetch("/rm-receipts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rm-receipts"] });
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      setSheetOpen(false);
      resetForm();
      toast({ title: editId ? "Kirim hujjati yangilandi" : "Kirim hujjati saqlandi" });
    },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/rm-receipts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rm-receipts"] });
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      toast({ title: "O'chirildi" });
    },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => { setEditId(null); setDate(today()); setSupplierId(""); setNote(""); setLines([newLine()]); };

  const handleEditClick = async (id: number) => {
    const r = await apiFetch<ReceiptDetail>(`/rm-receipts/${id}`);
    setEditId(id);
    setDate(r.date);
    setSupplierId(r.supplierId ? r.supplierId.toString() : "");
    setNote(r.note || "");
    setLines(r.items.map((it: any) => ({ rawMaterialId: it.rawMaterialId.toString(), quantity: it.quantity, unitPrice: it.unitPrice })));
    setSheetOpen(true);
  };

  const updateLine = (i: number, field: keyof LineItem, val: string) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  };

  const lineTotal = (l: LineItem) =>
    l.quantity && l.unitPrice ? parseFloat(l.quantity) * parseFloat(l.unitPrice) : 0;

  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  const validLines = lines.filter((l) => l.rawMaterialId && l.quantity && l.unitPrice);

  const handleSave = () => {
    if (!date || validLines.length === 0) {
      toast({ title: "Sana va kamida 1 ta mahsulot kerak", variant: "destructive" }); return;
    }
    saveMutation.mutate({
      date, supplierId: supplierId || null, note: note || null,
      items: validLines.map((l) => ({
        rawMaterialId: parseInt(l.rawMaterialId),
        quantity: l.quantity, unitPrice: l.unitPrice,
      })),
    });
  };

  const handleExport = () => {
    exportXlsx(
      receipts.map((r) => ({
        "Raqam": r.receiptNumber, "Sana": r.date,
        "Yetkazib beruvchi": r.supplierName || "", "Summa": r.totalAmount, "Izoh": r.note || "",
      })),
      `hom-ashyo-kirim-${startDate}-${endDate}.xlsx`
    );
  };

  return (
    <div className="flex-1 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hom ashyo kirim</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{receipts.length} ta hujjat</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button className="gap-2" onClick={() => setSheetOpen(true)}>
            <Plus className="w-4 h-4" /> Yangi kirim
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Dan:</Label>
          <Input type="date" className="w-36 h-8 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Gacha:</Label>
          <Input type="date" className="w-36 h-8 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Raqam</TableHead>
              <TableHead>Sana</TableHead>
              <TableHead>Yetkazib beruvchi</TableHead>
              <TableHead>Izoh</TableHead>
              <TableHead className="text-right">Summa (so'm)</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
            ) : receipts.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ArrowDownToLine className="w-8 h-8 opacity-30" />
                  <span className="text-sm">Kirim hujjatlari topilmadi</span>
                </div>
              </TableCell></TableRow>
            ) : receipts.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm font-medium">{r.receiptNumber}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(r.date)}</TableCell>
                <TableCell className="text-sm">{r.supplierName || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{r.note || "—"}</TableCell>
                <TableCell className="text-right font-semibold text-sm">{fmt(r.totalAmount)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setViewId(r.id)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => handleEditClick(r.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) resetForm(); }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editId ? "Kirim hujjatini tahrirlash" : "Yangi hom ashyo kirim"}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 mt-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sana <span className="text-destructive">*</span></Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Yetkazib beruvchi</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Tanlang (ixtiyoriy)" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Input placeholder="Hujjatga izoh..." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {/* Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Mahsulotlar jadvali</Label>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setLines((p) => [...p, newLine()])}>
                  <Plus className="w-3 h-3" /> Qator qo'shish
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Hom ashyo</TableHead>
                      <TableHead className="w-28">Miqdor</TableHead>
                      <TableHead className="w-32">Narxi (so'm)</TableHead>
                      <TableHead className="w-32 text-right">Jami</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-1.5">
                          <Select value={line.rawMaterialId} onValueChange={(v) => updateLine(i, "rawMaterialId", v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                            <SelectContent>
                              {rawMaterials.map((rm) => (
                                <SelectItem key={rm.id} value={rm.id.toString()}>
                                  {rm.name}{rm.code ? ` (${rm.code})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Input className="h-8 text-sm" type="number" min="0" step="0.001" placeholder="0"
                            value={line.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Input className="h-8 text-sm" type="number" min="0" placeholder="0"
                            value={line.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)} />
                        </TableCell>
                        <TableCell className="p-1.5 text-right font-mono text-sm font-medium">
                          {fmt(lineTotal(line))}
                        </TableCell>
                        <TableCell className="p-1.5">
                          {lines.length > 1 && (
                            <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}>
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="bg-muted/50 rounded-lg px-4 py-2 text-sm">
                  Jami: <span className="font-bold text-base ml-2">{fmt(grandTotal)} so'm</span>
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Bekor</Button>
            <Button disabled={saveMutation.isPending || validLines.length === 0} onClick={handleSave}>
              {saveMutation.isPending ? "Saqlanmoqda..." : editId ? "Yangilash" : "Saqlash"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* View Detail Dialog */}
      <Dialog open={viewId !== null} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.receiptNumber} — {fmtDate(detail?.date)}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="flex gap-6 text-sm">
                <div><span className="text-muted-foreground">Yetkazuvchi:</span> <b>{detail.supplierName || "—"}</b></div>
                {detail.note && <div><span className="text-muted-foreground">Izoh:</span> <b>{detail.note}</b></div>}
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Hom ashyo</TableHead>
                      <TableHead className="text-right">Miqdor</TableHead>
                      <TableHead className="text-right">Narxi</TableHead>
                      <TableHead className="text-right">Jami</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium text-sm">{it.rawMaterialName}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(it.quantity)} {it.unitShort}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(it.unitPrice)} so'm</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{fmt(it.totalPrice)} so'm</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={3} className="font-semibold text-right">Jami:</TableCell>
                      <TableCell className="font-bold text-right text-primary">{fmt(detail.totalAmount)} so'm</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                  exportXlsx(detail.items.map((it) => ({
                    "Hom ashyo": it.rawMaterialName, "Kod": it.rawMaterialCode || "",
                    "Miqdor": it.quantity, "Birlik": it.unitShort || "",
                    "Narxi": it.unitPrice, "Jami": it.totalPrice,
                  })), `${detail.receiptNumber}.xlsx`);
                }}>
                  <Download className="w-4 h-4" /> Excel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlang</AlertDialogTitle>
            <AlertDialogDescription>Bu kirim hujjati va barcha satrlari o'chiriladi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => { deleteMutation.mutate(deleteId!); setDeleteId(null); }}>
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
