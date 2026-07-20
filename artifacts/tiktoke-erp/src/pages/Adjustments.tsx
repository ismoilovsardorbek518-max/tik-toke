import { useState } from "react";
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, fmt, fmtDate, today } from "@/lib/api";
import { xlAdjustments } from "@/lib/excel";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Download, SlidersHorizontal } from "lucide-react";

interface Adjustment {
  id: number;
  type: "product" | "raw_material";
  itemId: number;
  itemName: string;
  unitShort: string;
  quantity: string;
  reason: string | null;
  date: string;
}
interface Product { id: number; name: string; unitShort: string | null; }
interface RM { id: number; name: string; unitShort: string | null; }

const emptyForm = { type: "product" as "product" | "raw_material", itemId: "", quantity: "", reason: "", date: today() };

export default function Adjustments() {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: adjustments = [], isLoading } = useQuery<Adjustment[]>({
    queryKey: ["adjustments"],
    queryFn: () => apiFetch("/adjustments"),
  });
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/products"),
  });
  const { data: rms = [] } = useQuery<RM[]>({
    queryKey: ["raw-materials"],
    queryFn: () => apiFetch("/raw-materials"),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => apiFetch("/adjustments", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      flushSync(() => setSheetOpen(false));
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["adjustments"] });
        qc.invalidateQueries({ queryKey: ["products"] });
        qc.invalidateQueries({ queryKey: ["raw-materials"] });
      }, 0);
      setForm(emptyForm);
      toast.success("Korrektirovka qo'shildi");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/adjustments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["raw-materials"] });
      toast.success("O'chirildi");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => { setForm(emptyForm); setSheetOpen(true); };

  const items = form.type === "product" ? products : rms;

  const makeTable = (rows: Adjustment[]) => (
    <div className="border rounded-lg bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Sana</TableHead>
            <TableHead>Nomi</TableHead>
            <TableHead className="text-right">Miqdor</TableHead>
            <TableHead>Birlik</TableHead>
            <TableHead>Sabab</TableHead>
            <TableHead className="w-14" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="h-28 text-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <SlidersHorizontal className="w-7 h-7 opacity-30" />
                <span className="text-sm">Korrektirovka topilmadi</span>
              </div>
            </TableCell></TableRow>
          ) : rows.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="text-sm text-muted-foreground">{fmtDate(a.date)}</TableCell>
              <TableCell className="font-medium text-sm">{a.itemName}</TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={parseFloat(a.quantity) >= 0 ? "secondary" : "destructive"}
                  className="font-mono text-xs"
                >
                  {parseFloat(a.quantity) >= 0 ? "+" : ""}{fmt(parseFloat(a.quantity))}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{a.unitShort}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{a.reason || "—"}</TableCell>
              <TableCell>
                <Button
                  size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(a.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const productAdj = adjustments.filter((a) => a.type === "product");
  const rmAdj = adjustments.filter((a) => a.type === "raw_material");

  return (
    <div className="flex-1 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Korrektirovka</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Qoldiqlarni qo'lda tuzatish</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => xlAdjustments(
            adjustments.map((a) => ({
              date: a.date, type: a.type === "product" ? "Mahsulot" : "Hom ashyo",
              name: a.itemName, quantity: a.quantity, unit: a.unitShort, reason: a.reason || "",
            })), `korrektirovka-${today()}.xlsx`)}>
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Yangi korrektirovka
          </Button>
        </div>
      </div>

      <Tabs defaultValue="product" className="w-full">
        <TabsList className="grid grid-cols-2 w-[300px]">
          <TabsTrigger value="product">Mahsulotlar ({productAdj.length})</TabsTrigger>
          <TabsTrigger value="raw_material">Hom ashyo ({rmAdj.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="product" className="mt-4">{makeTable(productAdj)}</TabsContent>
        <TabsContent value="raw_material" className="mt-4">{makeTable(rmAdj)}</TabsContent>
      </Tabs>

      {/* Add Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-96">
          <SheetHeader><SheetTitle>Yangi korrektirovka</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Turi <span className="text-destructive">*</span></Label>
              <Select value={form.type} onValueChange={(v: "product" | "raw_material") => setForm({ ...form, type: v, itemId: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Mahsulot</SelectItem>
                  <SelectItem value="raw_material">Hom ashyo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nomi <span className="text-destructive">*</span></Label>
              <Select value={form.itemId} onValueChange={(v) => setForm({ ...form, itemId: v })}>
                <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                <SelectContent>
                  {items.map((it) => <SelectItem key={it.id} value={it.id.toString()}>{it.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Miqdor <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                step="0.001"
                placeholder="Musbat = qo'shish, manfiy = ayirish"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Masalan: +50 qo'shadi, -10 ayiradi</p>
            </div>
            <div className="space-y-1.5">
              <Label>Sana <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Sabab</Label>
              <Input placeholder="Masalan: Inventarizatsiya, yo'qolgan..." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Bekor</Button>
            <Button
              disabled={!form.itemId || !form.quantity || !form.date || saveMutation.isPending}
              onClick={() => saveMutation.mutate({
                type: form.type,
                itemId: form.itemId,
                quantity: form.quantity,
                reason: form.reason || null,
                date: form.date,
              })}
            >
              {saveMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlang</AlertDialogTitle>
            <AlertDialogDescription>Bu korrektirovka o'chiriladi va qoldiqqa ta'sir qiladi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => { deleteMutation.mutate(deleteId!); setDeleteId(null); }}>O'chirish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
