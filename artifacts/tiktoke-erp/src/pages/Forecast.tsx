import { useQuery } from "@tanstack/react-query";
import { apiFetch, fmt } from "@/lib/api";
import { xlForecast } from "@/lib/excel";
import { Download, TrendingUp, Package, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecipeItem {
  rawMaterialId: number;
  rawMaterialName: string;
  rawMaterialCode: string | null;
  unitShort: string | null;
  quantityPerUnit: string;
  currentStock: string;
}

interface ForecastProduct {
  productId: number;
  productName: string;
  productCode: string | null;
  unitShort: string | null;
  recipe: RecipeItem[];
  maxPossibleUnits: number | null;
  hasRecipe: boolean;
}

interface RmItem {
  name: string;
  code: string | null;
  unitShort: string | null;
  stock: string;
}

interface ForecastData {
  products: ForecastProduct[];
  rawMaterials: RmItem[];
}

export default function Forecast() {
  const { data, isLoading } = useQuery<ForecastData>({
    queryKey: ["forecast"],
    queryFn: () => apiFetch("/forecast"),
  });

  const withRecipe = data?.products.filter((p) => p.hasRecipe) ?? [];
  const withoutRecipe = data?.products.filter((p) => !p.hasRecipe) ?? [];

  const handleExport = () => {
    if (!data) return;
    const rows = withRecipe.map((p) => ({
      "Mahsulot kodi": p.productCode ?? "",
      "Mahsulot nomi": p.productName,
      "Birlik": p.unitShort ?? "",
      "Ishlab chiqarish imkoni": p.maxPossibleUnits ?? 0,
      "Xom ashyo (formula)": p.recipe.map((r) => `${r.rawMaterialName}: ${r.quantityPerUnit} ${r.unitShort ?? ""}`).join("; "),
    }));
    xlForecast(
      withRecipe.map((p) => ({
        productName: p.productName,
        unit: p.unitShort ?? "",
        canMake: p.maxPossibleUnits ?? 0,
        recipe: p.recipe.map((r) => `${r.rawMaterialName}: ${r.quantityPerUnit} ${r.unitShort ?? ""}`).join("; "),
      })),
      `prognoz-${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prognoz</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Qolgan xom ashyo asosida ishlab chiqarish imkoniyati
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="w-4 h-4" /> Excel
        </Button>
      </div>

      {/* Xom ashyo qoldiqlari */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" /> Xom ashyo qoldiqlari
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {data?.rawMaterials.map((rm) => (
            <Card key={rm.name} className={`border ${parseFloat(rm.stock) <= 0 ? "border-destructive/40 bg-destructive/5" : ""}`}>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground truncate">{rm.code}</div>
                <div className="font-medium text-sm truncate">{rm.name}</div>
                <div className={`text-lg font-bold mt-1 ${parseFloat(rm.stock) <= 0 ? "text-destructive" : "text-primary"}`}>
                  {fmt(rm.stock)} <span className="text-xs font-normal text-muted-foreground">{rm.unitShort}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Prognoz jadvali */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" /> Mahsulot bo'yicha prognoz
        </h2>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Yuklanmoqda...</div>
        ) : (
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Mahsulot</TableHead>
                  <TableHead>Formulasi (1 birlik uchun)</TableHead>
                  <TableHead className="text-right">Ishlab chiqarish imkoni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withRecipe.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell>
                      <div className="font-medium">{p.productName}</div>
                      <div className="text-xs text-muted-foreground">{p.productCode}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {p.recipe.map((r) => (
                          <div key={r.rawMaterialId} className="text-xs flex items-center gap-1.5">
                            <span className="text-muted-foreground">{r.rawMaterialName}:</span>
                            <span className="font-medium">{r.quantityPerUnit} {r.unitShort}</span>
                            <span className="text-muted-foreground ml-1">(qoldiq: {fmt(r.currentStock)})</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.maxPossibleUnits !== null ? (
                        <div>
                          <span className={`text-lg font-bold ${p.maxPossibleUnits === 0 ? "text-destructive" : "text-green-600"}`}>
                            {fmt(p.maxPossibleUnits)}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">{p.unitShort}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {withRecipe.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Hech bir mahsulotga formula (xom ashyo) biriktirilmagan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Formulasi yo'q mahsulotlar */}
      {withoutRecipe.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Formulasi yo'q mahsulotlar
          </h2>
          <div className="flex flex-wrap gap-2">
            {withoutRecipe.map((p) => (
              <Badge key={p.productId} variant="secondary" className="text-xs">
                {p.productName}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
