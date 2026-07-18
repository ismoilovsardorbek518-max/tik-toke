import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, fmt, fmtDate, payLabel, today, monthAgo } from "@/lib/api";
import { xlDeliveries, xlRmReceiptDetail as xlDeliveryDetail } from "@/lib/excel";
import { getCompanyInfo } from "./Settings";
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
import { Plus, Trash2, Eye, Pencil, Download, Truck, X, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product { id: number; name: string; code: string | null; unitShort: string | null; sellingPrice: string; }
interface Customer { id: number; name: string; phone: string | null; address: string | null; }

interface Delivery {
  id: number; deliveryNumber: string; date: string; customerId: number | null;
  customerName: string | null; customerPhone: string | null;
  paymentMethod: string | null; totalAmount: string; note: string | null;
}
interface DeliveryDetail extends Delivery {
  customerAddress: string | null;
  items: Array<{
    id: number; productName: string; productCode: string | null;
    unitShort: string | null; quantity: string; unitPrice: string;
    discountPercent: string; totalPrice: string;
  }>;
}

interface LineItem { productId: string; quantity: string; unitPrice: string; discountPercent: string; }
const newLine = (): LineItem => ({ productId: "", quantity: "", unitPrice: "", discountPercent: "0" });

export default function Deliveries() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [startDate, setStartDate] = useState(monthAgo());
  const [endDate, setEndDate] = useState(today());
  const [clientFilter, setClientFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  const [date, setDate] = useState(today());
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineItem[]>([newLine()]);

  const params = new URLSearchParams({ startDate, endDate });
  if (clientFilter !== "all") params.set("customerId", clientFilter);

  const { data: deliveries = [], isLoading } = useQuery<Delivery[]>({
    queryKey: ["deliveries", startDate, endDate, clientFilter],
    queryFn: () => apiFetch(`/deliveries?${params}`),
  });

  const { data: detail } = useQuery<DeliveryDetail>({
    queryKey: ["delivery", viewId],
    queryFn: () => apiFetch(`/deliveries/${viewId}`),
    enabled: viewId !== null,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/products"),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => apiFetch("/customers"),
  });

  const saveMutation = useMutation({
    mutationFn: (body: object) => editId
      ? apiFetch(`/deliveries/${editId}`, { method: "PUT", body: JSON.stringify(body) })
      : apiFetch("/deliveries", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setSheetOpen(false);
      resetForm();
      toast({ title: editId ? "Yuk chiqarish yangilandi" : "Yuk chiqarish saqlandi" });
    },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/deliveries/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "O'chirildi" });
    },
    onError: (e: Error) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => { setEditId(null); setDate(today()); setCustomerId(""); setPaymentMethod("cash"); setNote(""); setLines([newLine()]); };

  const handleEditClick = async (id: number) => {
    const d = await apiFetch<DeliveryDetail>(`/deliveries/${id}`);
    setEditId(id);
    setDate(d.date);
    setCustomerId(d.customerId ? d.customerId.toString() : "");
    setPaymentMethod(d.paymentMethod || "cash");
    setNote(d.note || "");
    setLines(d.items.map((it: any) => ({
      productId: it.productId.toString(), quantity: it.quantity,
      unitPrice: it.unitPrice, discountPercent: it.discountPercent || "0",
    })));
    setSheetOpen(true);
  };

  const updateLine = (i: number, field: keyof LineItem, val: string) => {
    setLines((prev) => {
      const next = prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l);
      if (field === "productId") {
        const prod = products.find((p) => p.id.toString() === val);
        if (prod) next[i].unitPrice = prod.sellingPrice;
      }
      return next;
    });
  };

  const lineTotal = (l: LineItem) => {
    if (!l.quantity || !l.unitPrice) return 0;
    const base = parseFloat(l.quantity) * parseFloat(l.unitPrice);
    return base - base * (parseFloat(l.discountPercent || "0") / 100);
  };

  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const validLines = lines.filter((l) => l.productId && l.quantity && l.unitPrice);

  const handleSave = () => {
    if (!date || validLines.length === 0) {
      toast({ title: "Sana va kamida 1 ta mahsulot kerak", variant: "destructive" }); return;
    }
    if (!customerId) {
      toast({ title: "Klientni tanlang", variant: "destructive" }); return;
    }
    saveMutation.mutate({
      date, customerId: parseInt(customerId), paymentMethod, note: note || null,
      items: validLines.map((l) => ({
        productId: parseInt(l.productId), quantity: l.quantity,
        unitPrice: l.unitPrice, discountPercent: l.discountPercent || "0",
      })),
    });
  };

  const handlePrint = () => {
    const el = document.getElementById("delivery-faktura");
    if (!el) return;
    const prev = el.style.display;
    el.style.display = "block";
    window.print();
    el.style.display = prev;
  };

  return (
    <div className="flex-1 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Yuk chiqarish</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{deliveries.length} ta hujjat</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => xlDeliveries(
            deliveries, startDate, endDate, `yuk-chiqarish-${startDate}-${endDate}.xlsx`
          )}>
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button className="gap-2" onClick={() => setSheetOpen(true)}>
            <Plus className="w-4 h-4" /> Yangi yuk
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
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Klient:</Label>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              {customers.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Raqam</TableHead>
              <TableHead>Sana</TableHead>
              <TableHead>Klient</TableHead>
              <TableHead>To'lov</TableHead>
              <TableHead>Izoh</TableHead>
              <TableHead className="text-right">Summa (so'm)</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
            ) : deliveries.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Truck className="w-8 h-8 opacity-30" />
                  <span className="text-sm">Yuk chiqarish topilmadi</span>
                </div>
              </TableCell></TableRow>
            ) : deliveries.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-sm font-medium">{d.deliveryNumber}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(d.date)}</TableCell>
                <TableCell className="font-medium text-sm">{d.customerName || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{payLabel(d.paymentMethod || "cash")}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{d.note || "—"}</TableCell>
                <TableCell className="text-right font-semibold text-sm text-primary">{fmt(d.totalAmount)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setViewId(d.id)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => handleEditClick(d.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(d.id)}>
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
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader><SheetTitle>{editId ? "Yuk chiqarishni tahrirlash" : "Yangi yuk chiqarish"}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sana <span className="text-destructive">*</span></Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Klient <span className="text-destructive">*</span></Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className={!customerId ? "border-destructive/50" : ""}><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>To'lov turi</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
                <Label>Izoh</Label>
                <Input placeholder="Qo'shimcha izoh..." value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Mahsulotlar</Label>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
                  onClick={() => setLines((p) => [...p, newLine()])}>
                  <Plus className="w-3 h-3" /> Qator
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="w-24">Miqdor</TableHead>
                      <TableHead className="w-28">Narxi</TableHead>
                      <TableHead className="w-20">Chegirma %</TableHead>
                      <TableHead className="w-28 text-right">Jami</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-1.5">
                          <Select value={line.productId} onValueChange={(v) => updateLine(i, "productId", v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                            <SelectContent>
                              {products.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
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
                        <TableCell className="p-1.5">
                          <Input className="h-8 text-sm" type="number" min="0" max="100" placeholder="0"
                            value={line.discountPercent} onChange={(e) => updateLine(i, "discountPercent", e.target.value)} />
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
                  Jami: <span className="font-bold text-base ml-2 text-primary">{fmt(grandTotal)} so'm</span>
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

      {/* Detail Dialog */}
      <Dialog open={viewId !== null} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.deliveryNumber} — {fmtDate(detail?.date)}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <div><span className="text-muted-foreground">Klient:</span> <b>{detail.customerName || "—"}</b></div>
                {detail.customerPhone && <div><span className="text-muted-foreground">Tel:</span> <b>{detail.customerPhone}</b></div>}
                {detail.customerAddress && <div><span className="text-muted-foreground">Manzil:</span> <b>{detail.customerAddress}</b></div>}
                <div><span className="text-muted-foreground">To'lov:</span> <b>{payLabel(detail.paymentMethod || "cash")}</b></div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>#</TableHead>
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="text-right">Miqdor</TableHead>
                      <TableHead className="text-right">Narxi</TableHead>
                      <TableHead className="text-right">Chegirma</TableHead>
                      <TableHead className="text-right">Jami</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((it, i) => (
                      <TableRow key={it.id}>
                        <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                        <TableCell className="font-medium text-sm">{it.productName}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(it.quantity)} {it.unitShort}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(it.unitPrice)}</TableCell>
                        <TableCell className="text-right text-sm">{it.discountPercent}%</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{fmt(it.totalPrice)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={5} className="font-semibold text-right text-sm">Jami summa:</TableCell>
                      <TableCell className="font-bold text-right text-primary">{fmt(detail.totalAmount)} so'm</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() =>
                  xlDeliveryDetail({
                    receiptNumber: detail.deliveryNumber, date: detail.date,
                    supplierName: detail.customerName ?? "",
                    items: detail.items.map((it: any) => ({
                      rawMaterialName: it.productName, rawMaterialCode: it.productCode ?? "",
                      unitShort: it.unitShort ?? "", quantity: it.quantity,
                      unitPrice: it.unitPrice, totalPrice: it.totalPrice,
                    })),
                  }, `${detail.deliveryNumber}.xlsx`)
                }>
                  <Download className="w-4 h-4" /> Excel
                </Button>
                <Button size="sm" className="gap-2" onClick={handlePrint}>
                  <Printer className="w-4 h-4" /> Faktura chop etish
                </Button>
              </div>

              {/* Hidden Faktura for Print */}
              <DeliveryFaktura detail={detail} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlang</AlertDialogTitle>
            <AlertDialogDescription>Bu yuk chiqarish hujjati o'chiriladi va ombor holati qayta hisoblanadi.</AlertDialogDescription>
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

function DeliveryFaktura({ detail }: { detail: DeliveryDetail }) {
  const company = getCompanyInfo();
  return (
    <div id="delivery-faktura" style={{ display: "none", fontFamily: "Arial, sans-serif", fontSize: 13, color: "#111", padding: 20 }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: "bold" }}>{company.name}</div>
        {company.address && <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{company.address}{company.phone ? ` • Tel: ${company.phone}` : ""}</div>}
        {company.inn && <div style={{ fontSize: 11, color: "#555" }}>INN: {company.inn}</div>}
        <div style={{ fontSize: 16, fontWeight: "bold", marginTop: 8, textTransform: "uppercase", letterSpacing: 2 }}>
          Tovar Fakturasi (Nakładnoy)
        </div>
      </div>
      <table style={{ width: "100%", marginBottom: 14, borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ width: "50%", verticalAlign: "top" }}>
              <div><b>Hujjat №:</b> {detail.deliveryNumber}</div>
              <div><b>Sana:</b> {fmtDate(detail.date)}</div>
              <div><b>To'lov:</b> {payLabel(detail.paymentMethod || "cash")}</div>
            </td>
            <td style={{ width: "50%", verticalAlign: "top", textAlign: "right" }}>
              <div><b>Klient:</b></div>
              <div style={{ fontSize: 14, fontWeight: "bold" }}>{detail.customerName || "Xaridor"}</div>
              {detail.customerPhone && <div style={{ fontSize: 11 }}>{detail.customerPhone}</div>}
              {detail.customerAddress && <div style={{ fontSize: 11, color: "#555" }}>{detail.customerAddress}</div>}
            </td>
          </tr>
        </tbody>
      </table>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "center" }}>№</th>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "left" }}>Mahsulot nomi</th>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "center" }}>Birlik</th>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "right" }}>Miqdor</th>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "right" }}>Narxi</th>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "right" }}>Chegirma</th>
            <th style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "right" }}>Jami</th>
          </tr>
        </thead>
        <tbody>
          {detail.items.map((it, i) => (
            <tr key={it.id}>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "center" }}>{i + 1}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px" }}>{it.productName}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "center" }}>{it.unitShort}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "right" }}>{fmt(it.quantity)}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "right" }}>{fmt(it.unitPrice)}</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "right" }}>{it.discountPercent}%</td>
              <td style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "right", fontWeight: "bold" }}>{fmt(it.totalPrice)}</td>
            </tr>
          ))}
          <tr style={{ background: "#f9f9f9" }}>
            <td colSpan={6} style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "right", fontWeight: "bold" }}>Jami:</td>
            <td style={{ border: "1px solid #ccc", padding: "4px 8px", textAlign: "right", fontWeight: "bold", fontSize: 14 }}>{fmt(detail.totalAmount)} so'm</td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #111", width: 160, marginBottom: 4 }} />
          <div style={{ fontSize: 11 }}>Topshirdi: {company.director || "__________"}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #111", width: 160, marginBottom: 4 }} />
          <div style={{ fontSize: 11 }}>Qabul qildi: {detail.customerName || "__________"}</div>
        </div>
      </div>
    </div>
  );
}
