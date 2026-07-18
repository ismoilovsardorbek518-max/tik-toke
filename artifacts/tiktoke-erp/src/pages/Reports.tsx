import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, fmt, fmtDate, payLabel, today, monthAgo } from "@/lib/api";
import { xlReportRmReceipts, xlReportProductions, xlReportDeliveries, xlReportProfit, xlWeeklyPlan as xlReportPlan } from "@/lib/excel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, BarChart3 } from "lucide-react";

interface RmReceiptRow {
  receiptId: number; receiptNumber: string; date: string; supplierName: string | null;
  rawMaterialName: string | null; rawMaterialCode: string | null; unitShort: string | null;
  quantity: string; unitPrice: string; totalPrice: string;
}
interface ProductionRow {
  productionId: number; productionNumber: string; date: string;
  productName: string | null; productCode: string | null; unitShort: string | null; quantity: string;
  unitCost: string; totalCost: string;
}
interface DeliveryRow {
  deliveryId: number; deliveryNumber: string; date: string;
  customerName: string | null; paymentMethod: string | null;
  productName: string | null; unitShort: string | null;
  quantity: string; unitPrice: string; discountPercent: string; totalPrice: string;
}
interface ProfitRow {
  productId: number; productName: string | null; unitShort: string | null;
  quantitySold: string; revenue: string; cost: string; profit: string;
}
interface ProfitReport {
  rows: ProfitRow[];
  totals: { revenue: string; cost: string; profit: string };
}

interface PlanRow {
  productId: number; productName: string | null; unitShort: string | null;
  avgWeeklySales: string; currentStock: string; recommendedProduction: string;
}
interface RmNeedRow {
  rawMaterialId: number; rawMaterialName: string | null; unitShort: string | null; neededQty: string;
}
interface ProductionPlan { weeks: number; startDate: string; endDate: string; planRows: PlanRow[]; rmNeeds: RmNeedRow[]; }

interface RM { id: number; name: string; }
interface Product { id: number; name: string; }
interface Customer { id: number; name: string; }
interface Supplier { id: number; name: string; }

export default function Reports() {
  const [startDate, setStartDate] = useState(monthAgo());
  const [endDate, setEndDate] = useState(today());

  // RM Receipts filters
  const [rmFilter, setRmFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");

  // Production filters
  const [prodFilter, setProdFilter] = useState("all");

  // Delivery filters
  const [customerFilter, setCustomerFilter] = useState("all");
  const [delivProdFilter, setDelivProdFilter] = useState("all");

  // Production plan
  const [planWeeks, setPlanWeeks] = useState("4");

  // Reference data
  const { data: rawMaterials = [] } = useQuery<RM[]>({ queryKey: ["raw-materials"], queryFn: () => apiFetch("/raw-materials") });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => apiFetch("/products") });
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["customers"], queryFn: () => apiFetch("/customers") });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => apiFetch("/suppliers") });

  // Reports data
  const rmParams = new URLSearchParams({ startDate, endDate });
  if (rmFilter !== "all") rmParams.set("rawMaterialId", rmFilter);
  if (supplierFilter !== "all") rmParams.set("supplierId", supplierFilter);

  const { data: rmRows = [], isLoading: rmLoading } = useQuery<RmReceiptRow[]>({
    queryKey: ["report-rm", startDate, endDate, rmFilter, supplierFilter],
    queryFn: () => apiFetch(`/reports/rm-receipts?${rmParams}`),
  });

  const prodParams = new URLSearchParams({ startDate, endDate });
  if (prodFilter !== "all") prodParams.set("productId", prodFilter);

  const { data: prodRows = [], isLoading: prodLoading } = useQuery<ProductionRow[]>({
    queryKey: ["report-prod", startDate, endDate, prodFilter],
    queryFn: () => apiFetch(`/reports/productions?${prodParams}`),
  });

  const delivParams = new URLSearchParams({ startDate, endDate });
  if (customerFilter !== "all") delivParams.set("customerId", customerFilter);
  if (delivProdFilter !== "all") delivParams.set("productId", delivProdFilter);

  const { data: delivRows = [], isLoading: delivLoading } = useQuery<DeliveryRow[]>({
    queryKey: ["report-deliv", startDate, endDate, customerFilter, delivProdFilter],
    queryFn: () => apiFetch(`/reports/deliveries?${delivParams}`),
  });

  const { data: profitReport, isLoading: profitLoading } = useQuery<ProfitReport>({
    queryKey: ["report-profit", startDate, endDate],
    queryFn: () => apiFetch(`/reports/profit?startDate=${startDate}&endDate=${endDate}`),
  });

  const { data: productionPlan, isLoading: planLoading } = useQuery<ProductionPlan>({
    queryKey: ["report-plan", planWeeks],
    queryFn: () => apiFetch(`/reports/production-plan?weeks=${planWeeks}`),
  });
  const profitRows = profitReport?.rows ?? [];
  const profitTotals = profitReport?.totals;

  // Totals
  const rmTotal = rmRows.reduce((s, r) => s + parseFloat(r.totalPrice || "0"), 0);
  const rmQtyTotal = new Map<string, number>();
  rmRows.forEach((r) => {
    const key = r.rawMaterialName || "";
    rmQtyTotal.set(key, (rmQtyTotal.get(key) || 0) + parseFloat(r.quantity || "0"));
  });

  const prodQtyTotal = new Map<string, number>();
  const prodCostTotal = new Map<string, number>();
  prodRows.forEach((r) => {
    const key = r.productName || "";
    prodQtyTotal.set(key, (prodQtyTotal.get(key) || 0) + parseFloat(r.quantity || "0"));
    prodCostTotal.set(key, (prodCostTotal.get(key) || 0) + parseFloat(r.totalCost || "0"));
  });
  const prodGrandQty = prodRows.reduce((s, r) => s + parseFloat(r.quantity || "0"), 0);
  const prodGrandCost = prodRows.reduce((s, r) => s + parseFloat(r.totalCost || "0"), 0);

  const delivTotal = delivRows.reduce((s, r) => s + parseFloat(r.totalPrice || "0"), 0);
  const delivQtyTotal = new Map<string, number>();
  delivRows.forEach((r) => {
    const key = r.productName || "";
    delivQtyTotal.set(key, (delivQtyTotal.get(key) || 0) + parseFloat(r.quantity || "0"));
  });

  const FilterRow = () => (
    <div className="flex flex-wrap gap-3 items-center bg-muted/30 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Dan:</Label>
        <Input type="date" className="w-36 h-8 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Gacha:</Label>
        <Input type="date" className="w-36 h-8 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="flex-1 p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Hisobotlar</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Barcha harakatlar bo'yicha batafsil hisobot</p>
      </div>

      <Tabs defaultValue="rm" className="w-full">
        <TabsList className="grid grid-cols-5 w-[780px]">
          <TabsTrigger value="rm">Hom ashyo kirim</TabsTrigger>
          <TabsTrigger value="prod">Ishlab chiqarish</TabsTrigger>
          <TabsTrigger value="deliv">Yuk chiqarish</TabsTrigger>
          <TabsTrigger value="profit">Foyda</TabsTrigger>
          <TabsTrigger value="plan">📊 Haftalik reja</TabsTrigger>
        </TabsList>

        {/* ─── Hom ashyo kirim ─── */}
        <TabsContent value="rm" className="mt-4 space-y-4">
          <FilterRow />
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Hom ashyo:</Label>
              <Select value={rmFilter} onValueChange={setRmFilter}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {rawMaterials.map((r) => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Yetkazuvchi:</Label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={() => xlReportRmReceipts(
              rmRows.map((r) => ({ receiptNumber: r.receiptNumber, date: r.date, supplierName: r.supplierName || "",
                rawMaterialName: r.rawMaterialName || "", quantity: r.quantity, unit: r.unitShort || "",
                unitPrice: r.unitPrice, total: r.totalPrice })), startDate, endDate)}>
              <Download className="w-4 h-4" /> Excel yuklab olish
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="py-3">
              <CardContent className="py-0 px-4">
                <p className="text-xs text-muted-foreground">Jami hujjatlar</p>
                <p className="text-xl font-bold mt-0.5">{new Set(rmRows.map((r) => r.receiptId)).size}</p>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="py-0 px-4">
                <p className="text-xs text-muted-foreground">Jami summa</p>
                <p className="text-xl font-bold mt-0.5 text-primary">{fmt(rmTotal)} so'm</p>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Raqam</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead>Yetkazuvchi</TableHead>
                  <TableHead>Hom ashyo</TableHead>
                  <TableHead className="text-right">Miqdor</TableHead>
                  <TableHead className="text-right">Narxi</TableHead>
                  <TableHead className="text-right">Jami (so'm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rmLoading ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
                ) : rmRows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Ma'lumot topilmadi</TableCell></TableRow>
                ) : rmRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{r.receiptNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(r.date)}</TableCell>
                    <TableCell className="text-sm">{r.supplierName || "—"}</TableCell>
                    <TableCell className="font-medium text-sm">{r.rawMaterialName}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.quantity)} {r.unitShort}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.unitPrice)}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fmt(r.totalPrice)}</TableCell>
                  </TableRow>
                ))}
                {rmRows.length > 0 && (
                  <TableRow className="bg-primary/5 font-bold">
                    <TableCell colSpan={6} className="text-right text-sm">Jami:</TableCell>
                    <TableCell className="text-right text-primary">{fmt(rmTotal)} so'm</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── Ishlab chiqarish ─── */}
        <TabsContent value="prod" className="mt-4 space-y-4">
          <FilterRow />
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Mahsulot:</Label>
              <Select value={prodFilter} onValueChange={setProdFilter}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={() => xlReportProductions(
              prodRows.map((r) => ({ productionNumber: r.productionNumber, date: r.date,
                productName: r.productName || "", quantity: r.quantity, unit: r.unitShort || "",
                costTotal: r.totalCost })), startDate, endDate)}>
              <Download className="w-4 h-4" /> Excel yuklab olish
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="py-3">
              <CardContent className="py-0 px-4">
                <p className="text-xs text-muted-foreground">Jami partiyalar</p>
                <p className="text-xl font-bold mt-0.5">{new Set(prodRows.map((r) => r.productionId)).size}</p>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="py-0 px-4">
                <p className="text-xs text-muted-foreground">Jami miqdor</p>
                <p className="text-xl font-bold mt-0.5">{fmt(prodGrandQty)}</p>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="py-0 px-4">
                <p className="text-xs text-muted-foreground">Jami tannarx</p>
                <p className="text-xl font-bold mt-0.5 text-primary">{fmt(prodGrandCost)} so'm</p>
              </CardContent>
            </Card>
          </div>

          {/* Per-product summary */}
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Mahsulot</TableHead>
                  <TableHead className="text-right">Jami miqdor</TableHead>
                  <TableHead className="text-right">Jami tannarx (so'm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prodQtyTotal.size === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-16 text-center text-muted-foreground">Ma'lumot topilmadi</TableCell></TableRow>
                ) : Array.from(prodQtyTotal.entries()).map(([name, qty]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium text-sm">{name}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(qty)}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(prodCostTotal.get(name) || 0)}</TableCell>
                  </TableRow>
                ))}
                {prodQtyTotal.size > 0 && (
                  <TableRow className="bg-primary/5 font-bold">
                    <TableCell className="text-sm">Jami:</TableCell>
                    <TableCell className="text-right text-sm">{fmt(prodGrandQty)}</TableCell>
                    <TableCell className="text-right text-primary">{fmt(prodGrandCost)} so'm</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Raqam</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead className="text-right">Miqdor</TableHead>
                  <TableHead>Birlik</TableHead>
                  <TableHead className="text-right">Kirim narxi</TableHead>
                  <TableHead className="text-right">Tannarx jami</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prodLoading ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
                ) : prodRows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Ma'lumot topilmadi</TableCell></TableRow>
                ) : prodRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{r.productionNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(r.date)}</TableCell>
                    <TableCell className="font-medium text-sm">{r.productName}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fmt(r.quantity)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.unitShort}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.unitCost)}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.totalCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── Yuk chiqarish ─── */}
        <TabsContent value="deliv" className="mt-4 space-y-4">
          <FilterRow />
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Klient:</Label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Mahsulot:</Label>
              <Select value={delivProdFilter} onValueChange={setDelivProdFilter}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barchasi</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={() => xlReportDeliveries(
              delivRows.map((r) => ({ deliveryNumber: r.deliveryNumber, date: r.date,
                customerName: r.customerName || "", paymentMethod: payLabel(r.paymentMethod || "cash"),
                productName: r.productName || "", quantity: r.quantity, unit: r.unitShort || "",
                unitPrice: r.unitPrice, discountPercent: r.discountPercent, total: r.totalPrice,
              })), startDate, endDate)}>
              <Download className="w-4 h-4" /> Excel yuklab olish
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="py-3">
              <CardContent className="py-0 px-4">
                <p className="text-xs text-muted-foreground">Jami hujjatlar</p>
                <p className="text-xl font-bold mt-0.5">{new Set(delivRows.map((r) => r.deliveryId)).size}</p>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="py-0 px-4">
                <p className="text-xs text-muted-foreground">Jami summa</p>
                <p className="text-xl font-bold mt-0.5 text-primary">{fmt(delivTotal)} so'm</p>
              </CardContent>
            </Card>
            {Array.from(delivQtyTotal.entries()).slice(0, 2).map(([name, qty]) => (
              <Card key={name} className="py-3">
                <CardContent className="py-0 px-4">
                  <p className="text-xs text-muted-foreground truncate">{name}</p>
                  <p className="text-xl font-bold mt-0.5">{fmt(qty)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Raqam</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>To'lov</TableHead>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead className="text-right">Miqdor</TableHead>
                  <TableHead className="text-right">Narxi</TableHead>
                  <TableHead className="text-right">Chegirma</TableHead>
                  <TableHead className="text-right">Jami (so'm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delivLoading ? (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
                ) : delivRows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Ma'lumot topilmadi</TableCell></TableRow>
                ) : delivRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{r.deliveryNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(r.date)}</TableCell>
                    <TableCell className="font-medium text-sm">{r.customerName || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{payLabel(r.paymentMethod || "cash")}</TableCell>
                    <TableCell className="text-sm">{r.productName}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.quantity)} {r.unitShort}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.unitPrice)}</TableCell>
                    <TableCell className="text-right text-sm">{r.discountPercent}%</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fmt(r.totalPrice)}</TableCell>
                  </TableRow>
                ))}
                {delivRows.length > 0 && (
                  <TableRow className="bg-primary/5 font-bold">
                    <TableCell colSpan={8} className="text-right text-sm">Jami:</TableCell>
                    <TableCell className="text-right text-primary">{fmt(delivTotal)} so'm</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── Foyda ─── */}
        <TabsContent value="profit" className="mt-4 space-y-4">
          <FilterRow />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => xlReportProfit(
              profitRows.map((r) => ({ product: r.productName || "", qty: r.quantitySold,
                revenue: r.revenue, cost: r.cost, profit: r.profit,
              })), startDate, endDate)}>
              <Download className="w-4 h-4" /> Excel yuklab olish
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card className="py-3">
              <CardContent className="py-0 px-4">
                <p className="text-xs text-muted-foreground">Jami tushum</p>
                <p className="text-xl font-bold mt-0.5">{fmt(profitTotals?.revenue)} so'm</p>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="py-0 px-4">
                <p className="text-xs text-muted-foreground">Jami tannarx</p>
                <p className="text-xl font-bold mt-0.5">{fmt(profitTotals?.cost)} so'm</p>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="py-0 px-4">
                <p className="text-xs text-muted-foreground">Sof foyda</p>
                <p className="text-xl font-bold mt-0.5 text-primary">{fmt(profitTotals?.profit)} so'm</p>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Mahsulot</TableHead>
                  <TableHead className="text-right">Sotilgan miqdor</TableHead>
                  <TableHead className="text-right">Tushum (so'm)</TableHead>
                  <TableHead className="text-right">Tannarx (so'm)</TableHead>
                  <TableHead className="text-right">Foyda (so'm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profitLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Yuklanmoqda...</TableCell></TableRow>
                ) : profitRows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Ma'lumot topilmadi</TableCell></TableRow>
                ) : profitRows.map((r) => (
                  <TableRow key={r.productId}>
                    <TableCell className="font-medium text-sm">{r.productName}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.quantitySold)} {r.unitShort}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.revenue)}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.cost)}</TableCell>
                    <TableCell className={`text-right font-semibold text-sm ${parseFloat(r.profit) < 0 ? "text-destructive" : "text-emerald-700"}`}>
                      {fmt(r.profit)}
                    </TableCell>
                  </TableRow>
                ))}
                {profitRows.length > 0 && (
                  <TableRow className="bg-primary/5 font-bold">
                    <TableCell colSpan={2} className="text-sm">Jami:</TableCell>
                    <TableCell className="text-right text-sm">{fmt(profitTotals?.revenue)}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(profitTotals?.cost)}</TableCell>
                    <TableCell className="text-right text-primary">{fmt(profitTotals?.profit)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Foyda = tanlangan davrdagi yuk chiqarish (sotuv) tushumi − shu davrda ishlab chiqarilgan mahsulotning o'rtacha kirim narxiga asoslangan tannarx.
          </p>
        </TabsContent>

        {/* ─── Haftalik ishlab chiqarish rejasi ─── */}
        <TabsContent value="plan" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-center bg-muted/30 rounded-lg p-3">
            <Label className="text-sm font-medium">Tahlil davri:</Label>
            {["1","2","4","8","12"].map((w) => (
              <Button
                key={w}
                size="sm"
                variant={planWeeks === w ? "default" : "outline"}
                className="h-8 px-3 text-xs"
                onClick={() => setPlanWeeks(w)}
              >
                {w} hafta
              </Button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              ({productionPlan?.startDate} → {productionPlan?.endDate})
            </span>
            <Button
              variant="outline" size="sm" className="gap-2 ml-auto"
              onClick={() => xlReportPlan(
                (productionPlan?.planRows ?? []).map((r: any) => ({
                  weekStart: productionPlan?.startDate ?? "", productCode: "", productName: r.productName || "",
                  unitShort: r.unitShort || "", plannedQuantity: r.recommendedProduction, note: `O'rtacha sotuv: ${r.avgWeeklySales}, Qoldiq: ${r.currentStock}`,
                })), productionPlan?.startDate ?? "", `haftalik-reja-${planWeeks}hafta.xlsx`)}>
              <Download className="w-4 h-4" /> Excel
            </Button>
          </div>

          {/* Product plan table */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-foreground">Mahsulotlar — ishlab chiqarish tavsiyasi</h3>
            <div className="border rounded-lg bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Mahsulot</TableHead>
                    <TableHead className="text-right">O'rtacha haftalik sotuv</TableHead>
                    <TableHead className="text-right">Joriy qoldiq</TableHead>
                    <TableHead className="text-right">Kerak bo'lgan ishlab chiqarish</TableHead>
                    <TableHead>Birlik</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planLoading ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Hisoblanmoqda...</TableCell></TableRow>
                  ) : (productionPlan?.planRows ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Bu davrda yuk chiqarish amalga oshirilmagan
                    </TableCell></TableRow>
                  ) : (productionPlan?.planRows ?? []).map((r) => {
                    const needed = parseFloat(r.recommendedProduction);
                    const stock = parseFloat(r.currentStock);
                    return (
                      <TableRow key={r.productId}>
                        <TableCell className="font-medium text-sm">{r.productName}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(r.avgWeeklySales)}</TableCell>
                        <TableCell className="text-right text-sm">
                          <span className={stock <= 0 ? "text-destructive font-semibold" : ""}>{fmt(r.currentStock)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {needed > 0 ? (
                            <span className="font-bold text-primary">{fmt(r.recommendedProduction)}</span>
                          ) : (
                            <span className="text-emerald-600 text-sm">Yetarli ✓</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.unitShort}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Raw material needs table */}
          {(productionPlan?.rmNeeds ?? []).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-foreground">Hom ashyo ehtiyoji (ishlab chiqarish uchun)</h3>
              <div className="border rounded-lg bg-white overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Hom ashyo</TableHead>
                      <TableHead className="text-right">Kerakli miqdor</TableHead>
                      <TableHead>Birlik</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(productionPlan?.rmNeeds ?? []).map((r) => (
                      <TableRow key={r.rawMaterialId}>
                        <TableCell className="font-medium text-sm">{r.rawMaterialName}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{fmt(r.neededQty)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.unitShort}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Hom ashyo miqdori — tarixiy ishlab chiqarishdan hisoblangan nisbatlarga asoslangan tavsiya.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Formula: O'rtacha haftalik sotuv = oxirgi {planWeeks} hafta sotuvlar ÷ {planWeeks}. Kerak bo'lgan ishlab chiqarish = O'rtacha haftalik sotuv − Joriy qoldiq (agar musbat bo'lsa).
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
