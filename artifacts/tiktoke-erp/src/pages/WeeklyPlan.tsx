import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, fmt, today } from "@/lib/api";
import { xlWeeklyPlan } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Download, Trash2, ChevronLeft, ChevronRight, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlanRow {
  id: number;
  weekStart: string;
  productId: number;
  productName: string;
  productCode: string | null;
  unitShort: string | null;
  plannedQuantity: string;
  note: string | null;
}
interface Product { id: number; name: string; code: string | null; unitShort: string | null; }

// Haftaning dushanbasi
function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split("T")[0];
}

function weekLabel(dateStr: string): string {
  const start = new Date(dateStr);
  const end = new Date(dateStr);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate().toString().padStart(2,"0")}.${(d.getMonth()+1).toString().padStart(2,"0")}.${d.getFullYear()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function WeeklyPlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editNote, setEditNote] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addNote, setAddNote] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { data: plan = [], isLoading } = useQuery<PlanRow[]>({
    queryKey: ["weekly-plan", weekStart],
    queryFn: () => apiFetch(`/weekly-plan?weekStart=${weekStart}`),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/products"),
  });

  const saveMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/weekly-plan", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weekly-plan"] });
      setShowAdd(false); setAddProductId(""); setAddQty(""); setAddNote("");
      setEditingId(null);
      toast({ title: "Saqlandi" });
    },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/weekly-plan/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weekly-plan"] }); toast({ title: "O'chirildi" }); },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const startEdit = (row: PlanRow) => {
    setEditingId(row.id);
    setEditQty(row.plannedQuantity);
    setEditNote(row.note ?? "");
  };

  const saveEdit = (row: PlanRow) => {
    saveMutation.mutate({ weekStart, productId: row.productId, plannedQuantity: editQty, note: editNote });
  };

  const handleExport = () => {
    xlWeeklyPlan(plan, weekStart, `haftalik-reja-${weekStart}.xlsx`);
  };

  const availableProducts = products.filter(
    (p) => !plan.some((row) => row.productId === p.id)
  );

  return (
    <div className="flex-1 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Haftalik reja</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ishlab chiqarish rejasini qo'lda tahrirlang</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" /> Excel
          </Button>
        </div>
      </div>

      {/* Hafta navigatsiya */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-sm font-medium min-w-52 text-center">
          {weekLabel(weekStart)}
        </div>
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"
          onClick={() => setWeekStart(getMonday(new Date()))}>
          Bu hafta
        </Button>
      </div>

      {/* Jadval */}
      <div className="border rounded-lg bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Mahsulot</TableHead>
              <TableHead className="text-right">Reja (miqdor)</TableHead>
              <TableHead>Birlik</TableHead>
              <TableHead>Izoh</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Yuklanmoqda...</TableCell></TableRow>
            )}
            {!isLoading && plan.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Bu hafta uchun reja yo'q</TableCell></TableRow>
            )}
            {plan.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.productName}</div>
                  <div className="text-xs text-muted-foreground">{row.productCode}</div>
                </TableCell>
                <TableCell className="text-right">
                  {editingId === row.id ? (
                    <Input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)}
                      className="w-24 ml-auto text-right h-7 text-sm" autoFocus />
                  ) : (
                    <span className="font-semibold">{fmt(row.plannedQuantity)}</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{row.unitShort}</TableCell>
                <TableCell>
                  {editingId === row.id ? (
                    <Input value={editNote} onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Izoh..." className="h-7 text-sm" />
                  ) : (
                    <span className="text-sm text-muted-foreground">{row.note}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === row.id ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-green-600"
                        onClick={() => saveEdit(row)}>
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7"
                        onClick={() => setEditingId(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground"
                        onClick={() => startEdit(row)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(row.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {/* Yangi qo'shish qatori */}
            {showAdd && (
              <TableRow>
                <TableCell>
                  <Select value={addProductId} onValueChange={setAddProductId}>
                    <SelectTrigger className="h-7 text-sm"><SelectValue placeholder="Mahsulot..." /></SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input type="number" value={addQty} onChange={(e) => setAddQty(e.target.value)}
                    placeholder="0" className="w-24 ml-auto h-7 text-sm text-right" />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {products.find((p) => p.id.toString() === addProductId)?.unitShort}
                </TableCell>
                <TableCell>
                  <Input value={addNote} onChange={(e) => setAddNote(e.target.value)}
                    placeholder="Izoh..." className="h-7 text-sm" />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-green-600"
                      onClick={() => {
                        if (!addProductId || !addQty) return;
                        saveMutation.mutate({ weekStart, productId: addProductId, plannedQuantity: addQty, note: addNote || null });
                      }}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-7 h-7"
                      onClick={() => { setShowAdd(false); setAddProductId(""); setAddQty(""); }}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!showAdd && (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" /> Mahsulot qo'shish
        </Button>
      )}
    </div>
  );
}
