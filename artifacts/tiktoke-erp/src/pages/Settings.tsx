import { useState, useEffect } from "react";
import { Settings2, Building2, Phone, MapPin, User, Save, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const COMPANY_KEY = "tiktoke_company";

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  director: string;
  inn: string;
}

export function getCompanyInfo(): CompanyInfo {
  try {
    const raw = localStorage.getItem(COMPANY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { name: "TIK TOKE ERP", address: "", phone: "", director: "", inn: "" };
}

export default function Settings() {
  const { user } = useAuth();
  const [company, setCompany] = useState<CompanyInfo>(getCompanyInfo());
  const [saved, setSaved] = useState(false);

  // Password change state
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  function handleSaveCompany() {
    localStorage.setItem(COMPANY_KEY, JSON.stringify(company));
    setSaved(true);
    toast.success("Kompaniya ma'lumotlari saqlandi");
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleChangePassword() {
    if (!oldPass || !newPass || !newPass2) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    if (newPass !== newPass2) {
      toast.error("Yangi parollar mos kelmaydi");
      return;
    }
    if (newPass.length < 4) {
      toast.error("Parol kamida 4 ta belgi bo'lishi kerak");
      return;
    }
    setPwLoading(true);
    try {
      const token = localStorage.getItem("tiktoke_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
      });
      if (res.ok) {
        toast.success("Parol muvaffaqiyatli o'zgartirildi");
        setOldPass(""); setNewPass(""); setNewPass2("");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Xatolik yuz berdi");
      }
    } catch {
      toast.error("Server bilan bog'lanib bo'lmadi");
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="h-7 w-7" /> Sozlamalar
        </h1>
        <p className="text-muted-foreground">Kompaniya ma'lumotlari va tizim sozlamalari</p>
      </div>

      {/* Company info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Kompaniya ma'lumotlari
          </CardTitle>
          <CardDescription>Bu ma'lumotlar faktura va cheklarda ko'rinadi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kompaniya nomi</Label>
              <Input
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                placeholder="TIK TOKE ERP"
              />
            </div>
            <div className="space-y-2">
              <Label>INN (STIR)</Label>
              <Input
                value={company.inn}
                onChange={(e) => setCompany({ ...company, inn: e.target.value })}
                placeholder="123456789"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Manzil</Label>
            <Input
              value={company.address}
              onChange={(e) => setCompany({ ...company, address: e.target.value })}
              placeholder="Toshkent sh., ..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Telefon</Label>
              <Input
                value={company.phone}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                placeholder="+998 90 000 00 00"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Direktor F.I.O.</Label>
              <Input
                value={company.director}
                onChange={(e) => setCompany({ ...company, director: e.target.value })}
                placeholder="Karimov Alisher Sobirovich"
              />
            </div>
          </div>
          <Button onClick={handleSaveCompany} className="gap-2">
            {saved ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Save className="h-4 w-4" />}
            {saved ? "Saqlandi!" : "Saqlash"}
          </Button>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <CardTitle>Parolni o'zgartirish</CardTitle>
          <CardDescription>Foydalanuvchi: <span className="font-mono font-semibold">{user?.username}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Joriy parol</Label>
            <Input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} placeholder="••••••" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Yangi parol</Label>
              <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="••••••" />
            </div>
            <div className="space-y-2">
              <Label>Yangi parolni takrorlang</Label>
              <Input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} placeholder="••••••" />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={pwLoading} variant="outline">
            {pwLoading ? "Saqlanmoqda..." : "Parolni o'zgartirish"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
