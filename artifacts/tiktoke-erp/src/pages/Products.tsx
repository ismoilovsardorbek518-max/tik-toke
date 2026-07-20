import { useState } from "react";
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, fmt } from "@/lib/api";
import { xlProducts } from "@/lib/excel";
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
import { Plus, Search, Pencil, Trash2, Box, Download, FlaskConical, X, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Product {
  id: number; code: string | null; name: string;
  unitId: number | null; unitName: string | null; unitShort: string | null;
  sellingPrice: string; weight: string | null; description: string | null; stock: string;
}
interface Unit { id: number; name: string; shortName: string; }
interface RM { id: number; name: string; code: string | null; unitShort: string | null; }
interface RecipeItem {
  id: number; rawMaterialId: number; rawMaterialName: string;
  rawMaterialCode: string | null; unitShort: string | null; quantityPerUnit: string;
}

const emptyForm = { code: "", name: "", unitId: "", sellingPrice: "", weight: "", description: "" };

export default function Products() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Recipe state
  const [recipeProductId, setRecipeProductId] = useState<number | null>(null);
  const [recipeLines, setRecipeLines] = useState<Array<{ rawMaterialId: string; quantityPerUnit: string }>>([]);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/products"),
  });
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["units"],
    queryFn: () => apiFetch("/units"),
  });
  const { data: rawMaterials = [] } = useQuery<RM[]>({
    queryKey: ["raw-materials"],
    queryFn: () => apiFetch("/raw-materials"),
  });
  const { data: currentRecipe = [] } = useQuery<RecipeItem[]>({
    queryKey: ["recipe", recipeProductId],
    queryFn: () => apiFetch(`/products/${recipeProductId}/recipe`),
    enabled: recipeProductId !== null,
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) =>
      editing
        ? apiFetch(`/products/${editing.id}`, { method: "PUT", body: JSON.stringify(body) })
        : apiFetch("/products", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      flushSync(() => setSheetOpen(false));
      toast.success(editing ? "Yangilandi" : "Qo'shildi");
      setTimeout(() => { qc.invalidateQueries({ queryKey: ["products"] }); }, 0);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("O'chirildi"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRecipeMutation = useMutation({
    mutationFn: ({ id, items }: { id: number; items: any[] }) =>
      apiFetch(`/products/${id}/recipe`, { method: "PUT", body: JSON.stringify({ items }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipe", recipeProductId] });
      qc.invalidateQueries({ queryKey: ["forecast"] });
      toast.success("Formula saqlandi");
      setRecipeProductId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      code: p.code ?? "", name: p.name, unitId: p.unitId?.toString() ?? "",
      sellingPrice: p.sellingPrice, weight: p.weight ?? "", description: p.description ?? ""
    });
    setSheetOpen(true);
  };
  const openRecipe = (p: Product) => {
    setRecipeProductId(p.id);
  };

  // When recipe loads, populate lines
  const recipeProduct = products.find((p) => p.id === recipeProductId);

  const filtered = products.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Init recipe lines from server data when opened
  const initRecipeLines = () => {
    setRecipeLines(currentRecipe.map((r) => ({
      rawMaterialId: r.rawMaterialId.toString(),
      quantityPerUnit: r.quantityPerUnit,
    })));
  };

  return (
    <div className="flex-1 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mahsulotlar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} ta tayyor mahsulot</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => xlProducts(filtered, `mahsulotlar-${new Date().toISOString().split("T")[0]}.xlsx`)}>
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Yangi qo'shish
          </Button>
        </div>
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
              <TableHead className="text-right">Og'irligi</TableHead>
              <TableHead className="text-right">Narxi (so'm)</TableHead>
              <TableHead className="text-right">Qoldiq</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center">
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
                <TableCell className="text-right text-sm text-muted-foreground">
                  {p.weight ? `${p.weight} kg` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(p.sellingPrice)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={parseFloat(p.stock) <= 0 ? "destructive" : "secondary"} className="font-mono text-xs">
                    {fmt(parseFloat(p.stock))} {p.unitShort}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground" title="Xom ashyo formulasi"
                      onClick={() => { openRecipe(p); }}>
                      <FlaskConical className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mahsulot qo'shish/tahrirlash */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Kodi <span className="text-xs text-muted-foreground">(bo'sh qolsa avtomatik beriladi)</span></Label>
              <Input placeholder="PRD-00001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
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
              <Label>Og'irligi (kg)</Label>
              <Input type="number" placeholder="0.000" value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })} />
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
                weight: form.weight || null,
              })}
            >
              {saveMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Xom ashyo formulasi (recipe) sheet */}
      <Sheet open={recipeProductId !== null} onOpenChange={(o) => { if (!o) setRecipeProductId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              <FlaskConical className="w-4 h-4 inline mr-2" />
              {recipeProduct?.name} — Xom ashyo formulasi
            </SheetTitle>
            <p className="text-xs text-muted-foreground">1 birlik mahsulot uchun kerakli xom ashyo</p>
          </SheetHeader>

          <div className="space-y-3 mt-4">
            {/* Load existing recipe */}
            {currentRecipe.length > 0 && recipeLines.length === 0 && (
              <Button variant="outline" size="sm" onClick={initRecipeLines}>
                Mavjud formulani yuklash
              </Button>
            )}

            {recipeLines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs mb-1 block">Xom ashyo</Label>
                  <Select value={line.rawMaterialId}
                    onValueChange={(v) => {
                      const updated = [...recipeLines];
                      updated[idx] = { ...updated[idx], rawMaterialId: v };
                      setRecipeLines(updated);
                    }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                    <SelectContent>
                      {rawMaterials.map((rm) => (
                        <SelectItem key={rm.id} value={rm.id.toString()}>
                          {rm.name} {rm.code ? `(${rm.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28">
                  <Label className="text-xs mb-1 block">Miqdor</Label>
                  <Input type="number" placeholder="0.0000" value={line.quantityPerUnit}
                    className="h-8 text-sm"
                    onChange={(e) => {
                      const updated = [...recipeLines];
                      updated[idx] = { ...updated[idx], quantityPerUnit: e.target.value };
                      setRecipeLines(updated);
                    }} />
                </div>
                <div className="text-xs text-muted-foreground pb-1.5 min-w-8">
                  {rawMaterials.find((rm) => rm.id.toString() === line.rawMaterialId)?.unitShort}
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive mb-0"
                  onClick={() => setRecipeLines(recipeLines.filter((_, i) => i !== idx))}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" className="gap-1 w-full"
              onClick={() => setRecipeLines([...recipeLines, { rawMaterialId: "", quantityPerUnit: "" }])}>
              <Plus className="w-3.5 h-3.5" /> Xom ashyo qo'shish
            </Button>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setRecipeProductId(null)}>Bekor</Button>
            <Button
              disabled={saveRecipeMutation.isPending}
              onClick={() => {
                if (!recipeProductId) return;
                const items = recipeLines.filter((l) => l.rawMaterialId && l.quantityPerUnit);
                saveRecipeMutation.mutate({ id: recipeProductId, items: items.map((l) => ({
                  rawMaterialId: parseInt(l.rawMaterialId),
                  quantityPerUnit: l.quantityPerUnit,
                })) });
              }}>
              {saveRecipeMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
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
