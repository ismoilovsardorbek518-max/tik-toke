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
import { Plus, Download, Trash2, Scale, TrendingUp, TrendingDown, Wallet, ArrowUp, ArrowDown, Truck } from "lucide-react";
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

// Sverka row from backend
interface SverkaRow {
  id: number; date: string; kind: "delivery" | "receipt" | "payment";
  description: string; debit: number; credit: number; runningBalance: string;
}
interface SverkaData {
  partyName: string; partyType: string; currentBalance: number;
  transactions: SverkaRow[];
}

const empty = {
  partyType: "customer", partyId: "", direction: "in",
  amount: "", paymentMethod: "cash", note: "", date: today(),
};

export default function Kassa() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("transactions");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sverkaTarget, setSverkaTarget] = useState<{ type: string; id: number } | null>(null);

  // Tranzaksiyalar tab filter
  const [startDate, setStartDate] = useState(monthAgo());
  const [endDate, setEndDate] = useState(today());

  // Hisobot tab filter
  const [rptStart, setRptStart] = useState(today());
  const [rptEnd, setRptEnd] = useState(today());

  const { data: txs = [] } = useQuery<Tx[]>({
    queryKey: ["kassa", startDate, endDate],
    queryFn: () => apiFetch(`/kassa?startDate=${startDate}&endDate=${endDate}`),
  });

  const { data: rptTxs = [] } = useQuery<Tx[]>({
    queryKey: ["kassa-rpt", rptStart, rptEnd],
    queryFn: () => apiFetch(`/kassa?startDate=${rptStart}&endDate=${rptEnd}`),
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
      qc.invalidateQueries({ queryKey: ["kassa-rpt"] });
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
      qc.invalidateQueries({ queryKey: ["kassa-rpt"] });
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

  // Hisobot hisob-kitoblari
  const rptIn = rptTxs.filter((t) => t.direction === "in").reduce((s, t) => s + parseFloat(t.amount), 0);
  const rptOut = rptTxs.filter((t) => t.direction === "out").reduce((s, t) => s + parseFloat(t.amount), 0);

  // Balance display: positive = qarz (mijoz yoki yetkazuvchidan olindi, hali to'lanmagan)
  const balanceLabel = (b: number, type: "customer" | "supplier") => {
    if (b === 0) return { text: "Toza", cls: "text-muted-foreground" };
    if (type === "customer") {
      return b > 0
        ? { text: `${fmt(b)} so'm — Qarzdor`, cls: "text-destructive font-semibold" }
        : { text: `${fmt(Math.abs(b))} so'm — Ortiqcha to'lagan`, cls: "text-green-600 font-semibold" };
    } else {
      return b > 0
        ? { text: `${fmt(b)} so'm — Biz qarzdormiz`, cls: "text-destructive font-semibold" }
        : { text: `${fmt(Math.abs(b))} so'm — Ortiqcha to'langan`, cls: "text-green-600 font-semibold" };
    }
  };

  const sverkaBalanceLabel = (b: number, type: string) => {
    if (b === 0) return { text: "Toza hisob", cls: "text-muted-foreground" };
    if (type === "customer") {
      return b > 0
        ? { text: `${fmt(b)} so'm — Mijoz qarzdor`, cls: "text-destructive" }
        : { text: `${fmt(Math.abs(b))} so'm — Ortiqcha to'lagan`, cls: "text-green-600" };
    } else {
      return b > 0
        ? { text: `${fmt(b)} so'm — Biz qarzdormiz`, cls: "text-destructive" }
        : { text: `${fmt(Math.abs(b))} so'm — Ortiqcha to'langan`, cls: "text-green-600" };
    }
  };

  return (
    <div className="flex-1 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kassa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Mijoz va yetkazuvchilar bilan hisob-kitob</p>
        </div>
        <Button onClick={() => setSheetOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> To'lov kiritish
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="transactions">Tranzaksiyalar</TabsTrigger>
          <TabsTrigger value="balances">Balanslar</TabsTrigger>
          <TabsTrigger value="report">Hisobot</TabsTrigger>
        </TabsList>

        {/* ===== TRANZAKSIYALAR ===== */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="flex gap-3">
              <div>
                <Label className="text-xs mb-1 block">Dan</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Gacha</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-8 text-sm" />
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() =>
              exportXlsx(txs.map((t) => ({
                "Sana": t.date,
                "Tur": t.partyType === "customer" ? "Mijoz" : "Yetkazuvchi",
                "Nomi": t.partyName,
                "Yo'nalish": t.direction === "in" ? "Kirim" : "Chiqim",
                "Summa (so'm)": t.amount,
                "To'lov turi": payLabel(t.paymentMethod),
                "Izoh": t.note ?? "",
              })), `kassa-tranzaksiyalar-${startDate}-${endDate}.xlsx`)
            }>
              <Download className="w-4 h-4" /> Excel
            </Button>
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
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Tranzaksiyalar yo'q
                  </TableCell></TableRow>
                )}
                {txs.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{fmtDate(t.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {t.partyType === "customer" ? "Mijoz" : "Yetkazuvchi"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{t.partyName}</TableCell>
                    <TableCell>
                      {t.direction === "in"
                        ? <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><ArrowDown className="w-3.5 h-3.5" />Kirim</span>
                        : <span className="flex items-center gap-1 text-orange-500 text-xs font-medium"><ArrowUp className="w-3.5 h-3.5" />Chiqim</span>
                      }
                    </TableCell>
                    <TableCell className="text-right font-semibold font-mono text-sm">{fmt(t.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{payLabel(t.paymentMethod)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{t.note || "—"}</TableCell>
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

        {/* ===== BALANSLAR ===== */}
        <TabsContent value="balances" className="space-y-5 mt-4">
          {/* Mijozlar */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" /> Mijozlar (qarzdorlik holati)
            </h3>
            <div className="border rounded-lg bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Ism</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead className="text-right">Holat</TableHead>
                    <TableHead className="w-24 text-right">Akt sverka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!balances?.customers.length && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Mijozlar yo'q</TableCell></TableRow>
                  )}
                  {balances?.customers.map((c) => {
                    const { text, cls } = balanceLabel(c.balance, "customer");
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.phone ?? "—"}</TableCell>
                        <TableCell className={`text-right text-sm ${cls}`}>{text}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="gap-1 text-xs h-7"
                            onClick={() => setSverkaTarget({ type: "customer", id: c.id })}>
                            <Scale className="w-3 h-3" /> Sverka
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Yetkazuvchilar */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-orange-500" /> Yetkazib beruvchilar (biz qarzkor)
            </h3>
            <div className="border rounded-lg bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Ism</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead className="text-right">Holat</TableHead>
                    <TableHead className="w-24 text-right">Akt sverka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!balances?.suppliers.length && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Yetkazuvchilar yo'q</TableCell></TableRow>
                  )}
                  {balances?.suppliers.map((s) => {
                    const { text, cls } = balanceLabel(s.balance, "supplier");
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.phone ?? "—"}</TableCell>
                        <TableCell className={`text-right text-sm ${cls}`}>{text}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="gap-1 text-xs h-7"
                            onClick={() => setSverkaTarget({ type: "supplier", id: s.id })}>
                            <Scale className="w-3 h-3" /> Sverka
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ===== HISOBOT ===== */}
        <TabsContent value="report" className="space-y-5 mt-4">
          {/* Sana filtri */}
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="flex gap-3 items-end">
              <div>
                <Label className="text-xs mb-1 block">Dan</Label>
                <Input type="date" value={rptStart} onChange={(e) => setRptStart(e.target.value)} className="w-36 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Gacha</Label>
                <Input type="date" value={rptEnd} onChange={(e) => setRptEnd(e.target.value)} className="w-36 h-8 text-sm" />
              </div>
              <Button variant="outline" size="sm" onClick={() => { setRptStart(today()); setRptEnd(today()); }}>Bugun</Button>
              <Button variant="outline" size="sm" onClick={() => { setRptStart(monthAgo()); setRptEnd(today()); }}>Oxirgi oy</Button>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() =>
              exportXlsx([
                { "": "KASSA HISOBOTI", "Davr": `${rptStart} — ${rptEnd}` },
                {},
                { "": "Jami kirim:", "Davr": rptIn },
                { "": "Jami chiqim:", "Davr": rptOut },
                { "": "Sof balans:", "Davr": rptIn - rptOut },
                {},
                ...rptTxs.map((t) => ({
                  "Sana": t.date,
                  "Tur": t.partyType === "customer" ? "Mijoz" : "Yetkazuvchi",
                  "Nomi": t.partyName,
                  "Yo'nalish": t.direction === "in" ? "Kirim" : "Chiqim",
                  "Summa (so'm)": t.amount,
                  "To'lov turi": payLabel(t.paymentMethod),
                  "Izoh": t.note ?? "",
                }))
              ], `kassa-hisobot-${rptStart}-${rptEnd}.xlsx`)
            }>
              <Download className="w-4 h-4" /> Excel
            </Button>
          </div>

          {/* Xulosa kartalar */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-green-100 bg-green-50">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-green-700">
                  <ArrowDown className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Jami kirim</span>
                </div>
                <div className="text-2xl font-bold text-green-700">{fmt(rptIn)}</div>
                <div className="text-xs text-green-600">{rptTxs.filter((t) => t.direction === "in").length} ta to'lov</div>
              </CardContent>
            </Card>
            <Card className="border-orange-100 bg-orange-50">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-orange-600">
                  <ArrowUp className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Jami chiqim</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">{fmt(rptOut)}</div>
                <div className="text-xs text-orange-500">{rptTxs.filter((t) => t.direction === "out").length} ta to'lov</div>
              </CardContent>
            </Card>
            <Card className={`${rptIn - rptOut >= 0 ? "border-blue-100 bg-blue-50" : "border-destructive/20 bg-destructive/5"}`}>
              <CardContent className="p-4 space-y-1">
                <div className={`flex items-center gap-2 ${rptIn - rptOut >= 0 ? "text-blue-700" : "text-destructive"}`}>
                  <Wallet className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Sof balans</span>
                </div>
                <div className={`text-2xl font-bold ${rptIn - rptOut >= 0 ? "text-blue-700" : "text-destructive"}`}>
                  {rptIn - rptOut >= 0 ? "+" : ""}{fmt(rptIn - rptOut)}
                </div>
                <div className="text-xs text-muted-foreground">{rptTxs.length} ta jami operatsiya</div>
              </CardContent>
            </Card>
          </div>

          {/* Hisobot jadvali */}
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Sana</TableHead>
                  <TableHead>Tur</TableHead>
                  <TableHead>Nomi</TableHead>
                  <TableHead>Yo'nalish</TableHead>
                  <TableHead className="text-right">Kirim</TableHead>
                  <TableHead className="text-right">Chiqim</TableHead>
                  <TableHead>To'lov</TableHead>
                  <TableHead>Izoh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rptTxs.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Bu davrda tranzaksiyalar yo'q
                  </TableCell></TableRow>
                )}
                {rptTxs.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{fmtDate(t.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {t.partyType === "customer" ? "Mijoz" : "Yetkazuvchi"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{t.partyName}</TableCell>
                    <TableCell>
                      {t.direction === "in"
                        ? <span className="text-green-600 text-xs font-medium">Kirim</span>
                        : <span className="text-orange-500 text-xs font-medium">Chiqim</span>
                      }
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-green-700">
                      {t.direction === "in" ? fmt(t.amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-orange-600">
                      {t.direction === "out" ? fmt(t.amount) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{payLabel(t.paymentMethod)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{t.note || "—"}</TableCell>
                  </TableRow>
                ))}
                {rptTxs.length > 0 && (
                  <TableRow className="bg-muted/20 font-semibold">
                    <TableCell colSpan={4} className="text-right text-sm">Jami:</TableCell>
                    <TableCell className="text-right font-bold text-green-700 font-mono">{fmt(rptIn)}</TableCell>
                    <TableCell className="text-right font-bold text-orange-600 font-mono">{fmt(rptOut)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== TO'LOV QO'SHISH ===== */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>To'lov kiritish</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Tur <span className="text-destructive">*</span></Label>
              <Select value={form.partyType} onValueChange={(v) => setForm({ ...form, partyType: v, partyId: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Mijoz</SelectItem>
                  <SelectItem value="supplier">Yetkazib beruvchi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kim <span className="text-destructive">*</span></Label>
              <Select value={form.partyId} onValueChange={(v) => setForm({ ...form, partyId: v })}>
                <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                <SelectContent>
                  {parties.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Yo'nalish <span className="text-destructive">*</span></Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {form.partyType === "customer" ? (
                    <>
                      <SelectItem value="in">✅ Kirim — mijoz to'lov qildi</SelectItem>
                      <SelectItem value="out">↩ Chiqim — qaytarish</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="out">✅ Chiqim — biz to'ladik</SelectItem>
                      <SelectItem value="in">↩ Kirim — qaytarish</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Summa (so'm) <span className="text-destructive">*</span></Label>
              <Input type="number" placeholder="0" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label>Sana <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Input placeholder="Ixtiyoriy..." value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Bekor</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ===== AKT SVERKA ===== */}
      <Dialog open={!!sverkaTarget} onOpenChange={(o) => !o && setSverkaTarget(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Akt Sverka — {sverka?.partyName}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({sverka?.partyType === "customer" ? "Mijoz" : "Yetkazuvchi"})
              </span>
            </DialogTitle>
          </DialogHeader>
          {sverka && (() => {
            const { text, cls } = sverkaBalanceLabel(sverka.currentBalance, sverka.partyType);
            return (
              <div className="space-y-4">
                {/* Joriy balans */}
                <div className={`p-4 rounded-lg border text-center ${sverka.currentBalance > 0 ? "border-destructive/40 bg-destructive/5" : sverka.currentBalance < 0 ? "border-green-200 bg-green-50" : "border-border bg-muted/20"}`}>
                  <div className="text-sm text-muted-foreground mb-1">Joriy qoldiq</div>
                  <div className={`text-2xl font-bold ${cls}`}>{text}</div>
                </div>

                {/* Excel export */}
                <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                  exportXlsx(sverka.transactions.map((r) => ({
                    "Sana": r.date,
                    "Tur": r.kind === "delivery" ? "Yuk chiqarish" : r.kind === "receipt" ? "Xom ashyo kirim" : "To'lov",
                    "Tavsif": r.description,
                    "Qarz (debit)": r.debit || "",
                    "To'lov (kredit)": r.credit || "",
                    "Joriy qoldiq": r.runningBalance,
                  })), `sverka-${sverka.partyName}-${today()}.xlsx`);
                }}>
                  <Download className="w-4 h-4" /> Excel
                </Button>

                {/* Jadval */}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Sana</TableHead>
                      <TableHead>Hujjat</TableHead>
                      <TableHead className="text-right text-destructive">Qarz (debit)</TableHead>
                      <TableHead className="text-right text-green-600">To'lov (kredit)</TableHead>
                      <TableHead className="text-right">Joriy qoldiq</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sverka.transactions.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Hujjatlar yo'q</TableCell></TableRow>
                    )}
                    {sverka.transactions.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{fmtDate(r.date)}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1.5">
                            {r.kind === "delivery" && <Truck className="w-3.5 h-3.5 text-primary" />}
                            {r.kind === "payment" && <Wallet className="w-3.5 h-3.5 text-green-600" />}
                            <span>{r.description}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-destructive">
                          {r.debit > 0 ? fmt(r.debit) : ""}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-600">
                          {r.credit > 0 ? fmt(r.credit) : ""}
                        </TableCell>
                        <TableCell className={`text-right font-semibold text-sm ${parseFloat(r.runningBalance) > 0 ? "text-destructive" : parseFloat(r.runningBalance) < 0 ? "text-green-600" : ""}`}>
                          {fmt(Math.abs(parseFloat(r.runningBalance)))}
                          {parseFloat(r.runningBalance) > 0 ? " ↑" : parseFloat(r.runningBalance) < 0 ? " ↓" : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
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
