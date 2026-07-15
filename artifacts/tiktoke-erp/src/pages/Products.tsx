import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, fmt } from "@/lib/api";
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
import { Plus, Search, Pencil, Trash2, Box } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: number; code: string | null; name: string;
  unitId: number | null; unitName: string | null; unitShort: string | null;
  sellingPrice: string; description: string | null; stock: string;
}
interface Unit { id: number; name: string; shortName: string; }

const emptyForm = { code: "", name: "", unitId: "", sellingPrice: "", description: "" };

export default function Products() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/products"),
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["units"],
    queryFn: () => apiFetch("/units"),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) =>
      editing
        ? apiFetch(`/products/${editing.id}`, { method: "PUT", body: JSON.stringify(body) })
        : apiFetch("/products", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setSheetOpen(false);
      toast({ title: editing ? "Yangilandi" : "Qo'shildi" });
    },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast({ title: "O'chirildi" }); },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ code: p.code ?? "", name: p.name, unitId: p.unitId?.toString() ?? "", sellingPrice: p.sellingPrice, description: p.description ?? "" });
    setSheetOpen(true);
  };

  const filtered = products.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mahsulotlar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} ta tayyor mahsulot</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Yangi qo'shish
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Qidirish..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-lg bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Kod</TableHead>
              <TableHead>Nomi</TableHead>
              <TableHead>Birlik</TableHead>
              <TableHead className="text-right">Narxi (so'm)</TableHead>
              <TableHead className="text-right">Qoldiq</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Box className="w-8 h-8 opacity-30" />
                  <span className="text-sm">Mahsulot topilmadi</span>
                </div>
              </TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground text-sm font-mono">{p.code || "—"}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.unitName || "—"}</TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(p.sellingPrice)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={parseFloat(p.stock) <= 0 ? "destructive" : "secondary"} className="font-mono text-xs">
                    {fmt(parseFloat(p.stock))} {p.unitShort}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-96">
          <SheetHeader><SheetTitle>{editing ? "Tahrirlash" : "Yangi mahsulot"}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Kodi</Label>
              <Input placeholder="Masalan: M-001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nomi <span className="text-destructive">*</span></Label>
              <Input placeholder="Mahsulot nomi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>O'lchov birligi</Label>
              <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
                <SelectTrigger><SelectValue placeholder="Birlik tanlang" /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => <SelectItem key={u.id} value={u.id.toString()}>{u.name} ({u.shortName})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sotish narxi (so'm)</Label>
              <Input type="number" placeholder="0" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Input placeholder="Qo'shimcha izoh" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Bekor</Button>
            <Button
              disabled={!form.name || saveMutation.isPending}
              onClick={() => saveMutation.mutate({
                ...form,
                unitId: form.unitId ? Number(form.unitId) : null,
                sellingPrice: form.sellingPrice || "0",
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
            <AlertDialogDescription>Bu mahsulot o'chiriladi.</AlertDialogDescription>
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
