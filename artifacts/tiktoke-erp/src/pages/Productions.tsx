import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, fmt, fmtDate, exportXlsx, today, monthAgo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Trash2, Eye, Pencil, Download, Factory, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product { id: number; name: string; code: string | null; unitShort: string | null; }
interface RM { id: number; name: string; code: string | null; unitShort: string | null; }

interface Production {
  id: number; productionNumber: string; date: string; note: string | null;
  outputs: Array<{ productName: string; quantity: string; unitShort: string | null; unitCost?: string; totalCost?: string; }>;
}
interface ProductionDetail extends Production {
  inputs: Array<{
    id: number; rawMaterialName: string; rawMaterialCode: string | null;
    unitShort: string | null; quantity: string;
  }>;
  outputs: Array<{
    id: number; productId: number; productName: string; productCode: string | null;
    unitShort: string | null; quantity: string; unitCost: string; totalCost: string;
  }>;
}

interface OutLine { productId: string; quantity: string; unitCost: string; }
interface InLine { rawMaterialId: string; quantity: string; }
const newOut = (): OutLine => ({ productId: "", quantity: "", unitCost: "" });
const newIn = (): InLine => ({ rawMaterialId: "", quantity: "" });

export default function Productions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(monthAgo());
  const [endDate, setEndDate] = useState(today());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [outLines, setOutLines] = useState<OutLine[]>([newOut()]);
  const [inLines, setInLines] = useState<InLine[]>([newIn()]);

  const { data: productions = [], isLoading } = useQuery<Production[]>({
    queryKey: ["productions", startDate, endDate],
    queryFn: () => apiFetch(`/productions?startDate=${startDate}&endDate=${endDate}`),
  });

  const { data: detail } = useQuery<ProductionDetail>({
    queryKey: ["production", viewId],
    queryFn: () => apiFetch(`/productions/${viewId}`),
    enabled: viewId !== null,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/products"),
  });

  const { data: rawMaterials = [] } = useQuery<RM[]>({
    queryKey: ["raw-materials"],
    queryFn: () => apiFetch("/raw-materials"),
  });

  const saveMutation = useMutation({
    mutationFn: (body: object) => editId
      ? apiFetch(`/productions/${editId}`, { method: "PUT", body: JSON.stringify(body) })
      : apiFetch("/productions", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productions"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      setSheetOpen(false);
      resetForm();
      toast({ title: editId ? "Ishlab chiqarish yangilandi" : "Ishlab chiqarish saqlandi" });
    },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/productions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productions"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      toast({ title: "O'chirildi" });
    },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setEditId(null); setDate(today()); setNote(""); setOutLines([newOut()]); setInLines([newIn()]);
  };

  const validOuts = outLines.filter((l) => l.productId && l.quantity);
  const validIns = inLines.filter((l) => l.rawMaterialId && l.quantity);

  const handleSave = () => {
    if (!date || validOuts.length === 0) {
      toast({ title: "Sana va kamida 1 ta mahsulot kerak", variant: "destructive" }); return;
    }
    saveMutation.mutate({
      date, note: note || null,
      outputs: validOuts.map((l) => ({ productId: parseInt(l.productId), quantity: l.quantity, unitCost: l.unitCost || "0" })),
      inputs: validIns.map((l) => ({ rawMaterialId: parseInt(l.rawMaterialId), quantity: l.quantity })),
    });
  };

  const handleEditClick = async (id: number) => {
    const p = await apiFetch<ProductionDetail>(`/productions/${id}`);
    setEditId(id);
    setDate(p.date);
    setNote(p.note || "");
    setOutLines(p.outputs.map((o) => ({ productId: o.productId.toString(), quantity: o.quantity, unitCost: o.unitCost || "0" })));
    setInLines(
      p.inputs.length
        ? p.inputs.map((i: any) => ({ rawMaterialId: i.rawMaterialId.toString(), quantity: i.quantity }))
        : [newIn()]
    );
    setSheetOpen(true);
  };

  return (
    <div className="flex-1 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ishlab chiqarish</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{productions.length} ta partiya</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportXlsx(
            productions.flatMap((p) => p.outputs.map((o) => ({
              "Raqam": p.productionNumber, "Sana": p.date,
              "Mahsulot": o.productName, "Miqdor": o.quantity, "Birlik": o.unitShort || "",
            }))), `ishlab-chiqarish-${startDate}-${endDate}.xlsx`
          )}>
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button className="gap-2" onClick={() => setSheetOpen(true)}>
            <Plus className="w-4 h-4" /> Yangi partiya
          </Button>
        </div>
      </div>

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

      <div className="border rounded-lg bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Raqam</TableHead>
              <TableHead>Sana</TableHead>
              <TableHead>Ishlab chiqarildi</TableHead>
              <TableHead>Izoh</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
            ) : productions.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Factory className="w-8 h-8 opacity-30" />
                  <span className="text-sm">Partiyalar topilmadi</span>
                </div>
              </TableCell></TableRow>
            ) : productions.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-sm font-medium">{p.productionNumber}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(p.date)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {p.outputs.map((o, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {o.productName}: {fmt(o.quantity)} {o.unitShort}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.note || "—"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setViewId(p.id)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => handleEditClick(p.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(p.id)}>
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
          <SheetHeader><SheetTitle>{editId ? "Partiyani tahrirlash" : "Yangi ishlab chiqarish partiyasi"}</SheetTitle></SheetHeader>
          <div className="space-y-5 mt-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sana <span className="text-destructive">*</span></Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Izoh</Label>
                <Input placeholder="Qo'shimcha izoh..." value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            {/* Outputs — produced products */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-emerald-700">Ishlab chiqarilgan mahsulotlar</Label>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
                  onClick={() => setOutLines((p) => [...p, newOut()])}>
                  <Plus className="w-3 h-3" /> Qo'shish
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden border-emerald-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-emerald-50">
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="w-28">Miqdor</TableHead>
                      <TableHead className="w-32">Kirim narxi</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outLines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-1.5">
                          <Select value={l.productId} onValueChange={(v) =>
                            setOutLines((p) => p.map((x, idx) => idx === i ? { ...x, productId: v } : x))}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                            <SelectContent>
                              {products.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Input className="h-8 text-sm" type="number" min="0" step="0.001" placeholder="0"
                            value={l.quantity} onChange={(e) =>
                              setOutLines((p) => p.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))} />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Input className="h-8 text-sm" type="number" min="0" step="0.01" placeholder="0"
                            value={l.unitCost} onChange={(e) =>
                              setOutLines((p) => p.map((x, idx) => idx === i ? { ...x, unitCost: e.target.value } : x))} />
                        </TableCell>
                        <TableCell className="p-1.5">
                          {outLines.length > 1 && (
                            <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setOutLines((p) => p.filter((_, idx) => idx !== i))}>
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">Kirim narxi — mahsulotning shu partiyadagi tannarxi (bir birlik uchun), foyda hisobotida ishlatiladi.</p>
            </div>

            {/* Inputs — raw materials consumed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-orange-700">Sarflangan hom ashyolar</Label>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
                  onClick={() => setInLines((p) => [...p, newIn()])}>
                  <Plus className="w-3 h-3" /> Qo'shish
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden border-orange-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-orange-50">
                      <TableHead>Hom ashyo</TableHead>
                      <TableHead className="w-32">Miqdor</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inLines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-1.5">
                          <Select value={l.rawMaterialId} onValueChange={(v) =>
                            setInLines((p) => p.map((x, idx) => idx === i ? { ...x, rawMaterialId: v } : x))}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                            <SelectContent>
                              {rawMaterials.map((r) => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Input className="h-8 text-sm" type="number" min="0" step="0.001" placeholder="0"
                            value={l.quantity} onChange={(e) =>
                              setInLines((p) => p.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))} />
                        </TableCell>
                        <TableCell className="p-1.5">
                          {inLines.length > 1 && (
                            <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setInLines((p) => p.filter((_, idx) => idx !== i))}>
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Bekor</Button>
            <Button disabled={saveMutation.isPending || validOuts.length === 0} onClick={handleSave}>
              {saveMutation.isPending ? "Saqlanmoqda..." : editId ? "Yangilash" : "Saqlash"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* View Detail */}
      <Dialog open={viewId !== null} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.productionNumber} — {fmtDate(detail?.date)}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              {detail.note && <p className="text-sm text-muted-foreground">Izoh: {detail.note}</p>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-1.5">Ishlab chiqarildi</p>
                  <div className="border rounded-lg overflow-hidden border-emerald-200">
                    <Table>
                      <TableHeader><TableRow className="bg-emerald-50">
                        <TableHead>Mahsulot</TableHead><TableHead className="text-right">Miqdor</TableHead>
                        <TableHead className="text-right">Kirim narxi</TableHead><TableHead className="text-right">Jami</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {detail.outputs.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="text-sm">{o.productName}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{fmt(o.quantity)} {o.unitShort}</TableCell>
                            <TableCell className="text-right text-sm">{fmt(o.unitCost)}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{fmt(o.totalCost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-orange-700 mb-1.5">Sarflangan hom ashyo</p>
                  <div className="border rounded-lg overflow-hidden border-orange-200">
                    <Table>
                      <TableHeader><TableRow className="bg-orange-50">
                        <TableHead>Hom ashyo</TableHead><TableHead className="text-right">Miqdor</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {detail.inputs.length === 0 ? (
                          <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-xs py-3">Kiritilmagan</TableCell></TableRow>
                        ) : detail.inputs.map((inp) => (
                          <TableRow key={inp.id}>
                            <TableCell className="text-sm">{inp.rawMaterialName}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{fmt(inp.quantity)} {inp.unitShort}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                  exportXlsx([
                    ...detail.outputs.map((o) => ({ Tur: "Mahsulot (chiqim)", Nomi: o.productName, Miqdor: o.quantity, Birlik: o.unitShort || "" })),
                    ...detail.inputs.map((inp) => ({ Tur: "Hom ashyo (kirim)", Nomi: inp.rawMaterialName, Miqdor: inp.quantity, Birlik: inp.unitShort || "" })),
                  ], `${detail.productionNumber}.xlsx`);
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
            <AlertDialogDescription>Bu partiya o'chiriladi va ombor holati qayta hisoblanadi.</AlertDialogDescription>
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
