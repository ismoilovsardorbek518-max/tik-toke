import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, fmt, fmtDate, payLabel, exportXlsx, today, monthAgo } from "@/lib/api";
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Download, Trash2, Eye, ArrowUpCircle, ArrowDownCircle, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

interface Tx {
  id: number; partyType: string; partyId: number; partyName: string;
  direction: string; amount: string; paymentMethod: string;
  note: string | null; date: string; createdAt: string;
}
interface BalanceParty { id: number; name: string; balance: number; phone: string | null; }
interface Balances { customers: BalanceParty[]; suppliers: BalanceParty[]; }
interface SverkaData {
  partyName: string; partyType: string; currentBalance: number;
  transactions: Array<Tx & { runningBalance: string }>;
}

const empty = { partyType: "customer", partyId: "", direction: "in", amount: "", paymentMethod: "cash", note: "", date: today() };

export default function Kassa() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("transactions");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sverkaTarget, setSverkaTarget] = useState<{ type: string; id: number } | null>(null);
  const [startDate, setStartDate] = useState(monthAgo());
  const [endDate, setEndDate] = useState(today());

  const { data: txs = [] } = useQuery<Tx[]>({
    queryKey: ["kassa", startDate, endDate],
    queryFn: () => apiFetch(`/kassa?startDate=${startDate}&endDate=${endDate}`),
  });
  const { data: balances } = useQuery<Balances>({
    queryKey: ["kassa-balances"],
    queryFn: () => apiFetch("/kassa/balances"),
  });
  const { data: sverka } = useQuery<SverkaData>({
    queryKey: ["sverka", sverkaTarget?.type, sverkaTarget?.id],
    queryFn: () => apiFetch(`/kassa/sverka/${sverkaTarget!.type}/${sverkaTarget!.id}`),
    enabled: !!sverkaTarget,
  });

  const { data: customers = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["customers"],
    queryFn: () => apiFetch("/customers"),
  });
  const { data: suppliers = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["suppliers"],
    queryFn: () => apiFetch("/suppliers"),
  });

  const saveMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/kassa", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kassa"] });
      qc.invalidateQueries({ queryKey: ["kassa-balances"] });
      qc.invalidateQueries({ queryKey: ["sverka"] });
      setSheetOpen(false);
      setForm(empty);
      toast({ title: "Tranzaksiya saqlandi" });
    },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/kassa/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kassa"] });
      qc.invalidateQueries({ queryKey: ["kassa-balances"] });
      toast({ title: "O'chirildi" });
    },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const parties = form.partyType === "customer" ? customers : suppliers;

  const handleSave = () => {
    if (!form.partyId || !form.amount || !form.date) {
      toast({ title: "Xato", description: "Barcha maydonlarni to'ldiring", variant: "destructive" }); return;
    }
    saveMutation.mutate(form);
  };

  const handleExport = () => {
    exportXlsx(txs.map((t) => ({
      "Sana": t.date,
      "Tur": t.partyType === "customer" ? "Mijoz" : "Yetkazuvchi",
      "Nomi": t.partyName,
      "Yo'nalish": t.direction === "in" ? "Kirim" : "Chiqim",
      "Summa": t.amount,
      "To'lov turi": payLabel(t.paymentMethod),
      "Izoh": t.note ?? "",
    })), `kassa-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="flex-1 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kassa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Mijoz va yetkazuvchilar bilan hisob-kitob</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button onClick={() => setSheetOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Tranzaksiya
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="transactions">Tranzaksiyalar</TabsTrigger>
          <TabsTrigger value="balances">Balanslar</TabsTrigger>
        </TabsList>

        {/* Tranzaksiyalar */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          <div className="flex gap-3 items-end">
            <div>
              <Label className="text-xs mb-1 block">Dan</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-38" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Gacha</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-38" />
            </div>
          </div>
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Sana</TableHead>
                  <TableHead>Tur</TableHead>
                  <TableHead>Nomi</TableHead>
                  <TableHead>Yo'nalish</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead>To'lov</TableHead>
                  <TableHead>Izoh</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Tranzaksiyalar yo'q</TableCell></TableRow>
                )}
                {txs.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{t.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {t.partyType === "customer" ? "Mijoz" : "Yetkazuvchi"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{t.partyName}</TableCell>
                    <TableCell>
                      {t.direction === "in"
                        ? <span className="flex items-center gap-1 text-green-600 text-xs"><ArrowUpCircle className="w-3.5 h-3.5" />Kirim</span>
                        : <span className="flex items-center gap-1 text-red-500 text-xs"><ArrowDownCircle className="w-3.5 h-3.5" />Chiqim</span>
                      }
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmt(t.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{payLabel(t.paymentMethod)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{t.note}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(t.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Balanslar */}
        <TabsContent value="balances" className="space-y-5 mt-4">
          {/* Mijozlar */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Mijozlar balansi</h3>
            <div className="border rounded-lg bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Ism</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead className="text-right">Balans (so'm)</TableHead>
                    <TableHead className="w-20">Akt sverka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances?.customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.phone ?? "—"}</TableCell>
                      <TableCell className={`text-right font-semibold ${c.balance < 0 ? "text-destructive" : c.balance > 0 ? "text-primary" : ""}`}>
                        {fmt(Math.abs(c.balance))} {c.balance < 0 ? "(qarz)" : c.balance > 0 ? "(ortiqcha)" : ""}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="gap-1 text-xs h-7"
                          onClick={() => setSverkaTarget({ type: "customer", id: c.id })}>
                          <Scale className="w-3 h-3" /> Sverka
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Yetkazuvchilar */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Yetkazib beruvchilar balansi</h3>
            <div className="border rounded-lg bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Ism</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead className="text-right">Balans (so'm)</TableHead>
                    <TableHead className="w-20">Akt sverka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances?.suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.phone ?? "—"}</TableCell>
                      <TableCell className={`text-right font-semibold ${s.balance < 0 ? "text-destructive" : s.balance > 0 ? "text-primary" : ""}`}>
                        {fmt(Math.abs(s.balance))} {s.balance < 0 ? "(qarz)" : s.balance > 0 ? "(ortiqcha)" : ""}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="gap-1 text-xs h-7"
                          onClick={() => setSverkaTarget({ type: "supplier", id: s.id })}>
                          <Scale className="w-3 h-3" /> Sverka
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Tranzaksiya qo'shish sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Tranzaksiya qo'shish</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tur</Label>
              <Select value={form.partyType} onValueChange={(v) => setForm({ ...form, partyType: v, partyId: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Mijoz</SelectItem>
                  <SelectItem value="supplier">Yetkazib beruvchi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kim</Label>
              <Select value={form.partyId} onValueChange={(v) => setForm({ ...form, partyId: v })}>
                <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                <SelectContent>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Yo'nalish</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Kirim (to'lov keldi)</SelectItem>
                  <SelectItem value="out">Chiqim (to'lov qilindi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Summa (so'm)</Label>
              <Input type="number" placeholder="0" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>To'lov turi</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Naqd</SelectItem>
                  <SelectItem value="card">Karta</SelectItem>
                  <SelectItem value="transfer">O'tkazma</SelectItem>
                  <SelectItem value="credit">Nasiya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sana</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Izoh</Label>
              <Input placeholder="Ixtiyoriy..." value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Akt sverka dialog */}
      <Dialog open={!!sverkaTarget} onOpenChange={(o) => !o && setSverkaTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Akt Sverka — {sverka?.partyName}</DialogTitle>
          </DialogHeader>
          {sverka && (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg border text-center ${sverka.currentBalance < 0 ? "border-destructive/40 bg-destructive/5" : "border-green-200 bg-green-50"}`}>
                <div className="text-sm text-muted-foreground">Joriy balans</div>
                <div className={`text-2xl font-bold ${sverka.currentBalance < 0 ? "text-destructive" : "text-green-600"}`}>
                  {fmt(Math.abs(sverka.currentBalance))} so'm
                  {sverka.currentBalance < 0 ? " (qarz)" : " (ortiqcha)"}
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                exportXlsx(sverka.transactions.map((t) => ({
                  "Sana": t.date, "Yo'nalish": t.direction === "in" ? "Kirim" : "Chiqim",
                  "Summa": t.amount, "To'lov turi": payLabel(t.paymentMethod),
                  "Joriy balans": t.runningBalance, "Izoh": t.note ?? "",
                })), `sverka-${sverka.partyName}-${today()}.xlsx`);
              }}>
                <Download className="w-4 h-4" /> Excel
              </Button>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Sana</TableHead>
                    <TableHead>Yo'nalish</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead className="text-right">Joriy balans</TableHead>
                    <TableHead>Izoh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sverka.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{t.date}</TableCell>
                      <TableCell>
                        {t.direction === "in"
                          ? <span className="text-green-600 text-xs flex items-center gap-1"><ArrowUpCircle className="w-3 h-3" />Kirim</span>
                          : <span className="text-red-500 text-xs flex items-center gap-1"><ArrowDownCircle className="w-3 h-3" />Chiqim</span>
                        }
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt(t.amount)}</TableCell>
                      <TableCell className={`text-right text-sm ${parseFloat(t.runningBalance) < 0 ? "text-destructive" : ""}`}>
                        {fmt(Math.abs(parseFloat(t.runningBalance)))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlang</AlertDialogTitle>
            <AlertDialogDescription>Tranzaksiya o'chirilsa balans ham qaytariladi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteMutation.mutate(deleteId!); setDeleteId(null); }}>
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
