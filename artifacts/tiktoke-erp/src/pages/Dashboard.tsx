import { useQuery } from "@tanstack/react-query";
import { apiFetch, fmt, fmtDate, payLabel } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Box, Truck, Factory, TrendingUp, AlertTriangle } from "lucide-react";

interface DashboardData {
  rawMaterialCount: number;
  rawMaterialLowStock: number;
  productCount: number;
  productLowStock: number;
  monthlyRevenue: number;
  monthlyDeliveries: number;
  monthlyProductions: number;
  recentDeliveries: Array<{
    id: number;
    deliveryNumber: string;
    date: string;
    customerName: string | null;
    totalAmount: string;
    paymentMethod: string | null;
  }>;
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch("/dashboard"),
    refetchInterval: 30000,
  });

  if (isLoading || !data) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      Yuklanmoqda...
    </div>
  );

  const d = data;

  return (
    <div className="flex-1 p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bosh sahifa</h1>
        <p className="text-muted-foreground text-sm mt-1">Shu oydagi statistika</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Oylik tushum</p>
                <p className="text-2xl font-bold mt-1 text-primary">{fmt(d.monthlyRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">so'm</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Yuk chiqarish</p>
                <p className="text-2xl font-bold mt-1">{d.monthlyDeliveries}</p>
                <p className="text-xs text-muted-foreground mt-0.5">ta yetkazish</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Truck className="w-4 h-4 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Ishlab chiqarish</p>
                <p className="text-2xl font-bold mt-1">{d.monthlyProductions}</p>
                <p className="text-xs text-muted-foreground mt-0.5">ta partiya</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <Factory className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Ombor holati</p>
                <p className="text-2xl font-bold mt-1">{d.rawMaterialCount + d.productCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {d.rawMaterialLowStock + d.productLowStock > 0 ? (
                    <span className="text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {d.rawMaterialLowStock + d.productLowStock} ta tugagan
                    </span>
                  ) : "Hammasi normal"}
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
                <Package className="w-4 h-4 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Ombor holati</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Hom ashyo turlari</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{d.rawMaterialCount}</span>
                {d.rawMaterialLowStock > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{d.rawMaterialLowStock} tugagan</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Mahsulot turlari</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{d.productCount}</span>
                {d.productLowStock > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{d.productLowStock} tugagan</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Deliveries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">So'nggi yetkazishlar</CardTitle>
          </CardHeader>
          <CardContent>
            {d.recentDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Hali yetkazish yo'q</p>
            ) : (
              <div className="space-y-2">
                {d.recentDeliveries.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium">{r.customerName || "Klient"}</div>
                      <div className="text-xs text-muted-foreground">{r.deliveryNumber} • {fmtDate(r.date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-primary">{fmt(r.totalAmount)} so'm</div>
                      <div className="text-[10px] text-muted-foreground">{payLabel(r.paymentMethod || "cash")}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
