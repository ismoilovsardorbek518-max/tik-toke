import { useState } from "react";
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
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
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Package, Download } from "lucide-react";
import { today } from "@/lib/api";
import { xlRawMaterials } from "@/lib/excel";

interface RM {
  id: number; code: string | null; name: string;
  unitId: number | null; unitName: string | null; unitShort: string | null;
  description: string | null; stock: string;
}
interface Unit { id: number; name: string; shortName: string; }

const emptyForm = { code: "", name: "", unitId: "", description: "" };

export default function RawMaterials() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RM | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: rms = [], isLoading } = useQuery<RM[]>({
    queryKey: ["raw-materials"],
    queryFn: () => apiFetch("/raw-materials"),
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["units"],
    queryFn: () => apiFetch("/units"),
  });

  const saveMutation = useMutation({
    mutationFn: (body: typeof emptyForm) =>
      editing
        ? apiFetch(`/raw-materials/${editing.id}`, { method: "PUT", body: JSON.stringify(body) })
        : apiFetch("/raw-materials", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      flushSync(() => setSheetOpen(false));
      toast.success(editing ? "Yangilandi" : "Qo'shildi");
      setTimeout(() => { qc.invalidateQueries({ queryKey: ["raw-materials"] }); }, 0);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/raw-materials/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["raw-materials"] }); toast.success("O'chirildi"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (rm: RM) => {
    setEditing(rm);
    setForm({ code: rm.code ?? "", name: rm.name, unitId: rm.unitId?.toString() ?? "", description: rm.description ?? "" });
    setSheetOpen(true);
  };

  const filtered = rms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hom ashyo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rms.length} ta hom ashyo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => xlRawMaterials(filtered, `hom-ashyo-${today()}.xlsx`)}>
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Yangi qo'shish
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Qidirish..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Kod</TableHead>
              <TableHead>Nomi</TableHead>
              <TableHead>Birlik</TableHead>
              <TableHead className="text-right">Qoldiq</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Package className="w-8 h-8 opacity-30" />
                  <span className="text-sm">Hom ashyo topilmadi</span>
                </div>
              </TableCell></TableRow>
            ) : filtered.map((rm) => (
              <TableRow key={rm.id}>
                <TableCell className="text-muted-foreground text-sm font-mono">{rm.code || "—"}</TableCell>
                <TableCell className="font-medium">{rm.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{rm.unitName || "—"}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={parseFloat(rm.stock) <= 0 ? "destructive" : "secondary"} className="font-mono text-xs">
                    {fmt(parseFloat(rm.stock))} {rm.unitShort}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(rm)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(rm.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-96">
          <SheetHeader>
            <SheetTitle>{editing ? "Tahrirlash" : "Yangi hom ashyo"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Kodi</Label>
              <Input placeholder="Masalan: HA-001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nomi <span className="text-destructive">*</span></Label>
              <Input placeholder="Hom ashyo nomi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
              <Label>Izoh</Label>
              <Input placeholder="Qo'shimcha izoh" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Bekor qilish</Button>
            <Button
              disabled={!form.name || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ ...form, unitId: form.unitId ? Number(form.unitId) : null } as any)}
            >
              {saveMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlang</AlertDialogTitle>
            <AlertDialogDescription>Bu hom ashyo o'chiriladi. Ushbu amalni bekor qilib bo'lmaydi.</AlertDialogDescription>
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
