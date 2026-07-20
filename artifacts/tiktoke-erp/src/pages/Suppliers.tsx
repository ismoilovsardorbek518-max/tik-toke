import { useState } from "react";
import { toast } from 'sonner';
import { 
  useGetSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  Supplier,
  SupplierInput
} from "@workspace/api-client-react";
import { Plus, Edit2, Trash2, Search, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSuppliersQueryKey } from "@workspace/api-client-react";

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierInput>({ 
    name: "", phone: "", email: "", address: "" 
  });
  
  const queryClient = useQueryClient();

  const { data: suppliers, isLoading } = useGetSuppliers({ search: search || undefined });
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();

  const handleOpenModal = (item?: Supplier) => {
    if (item) {
      setEditingItem(item);
      setFormData({ 
        name: item.name || "", 
        phone: item.phone || "",
        email: item.email || "",
        address: item.address || ""
      });
    } else {
      setEditingItem(null);
      setFormData({ name: "", phone: "", email: "", address: "" });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error("Nom kiritilishi shart");
      return;
    }

    if (editingItem?.id) {
      updateMutation.mutate(
        { id: editingItem.id, data: formData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
            toast.success("Muvaffaqiyatli — Ma'lumotlar yangilandi");
            setIsModalOpen(false);
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: formData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
            toast.success("Muvaffaqiyatli — Yangi kontragent qo'shildi");
            setIsModalOpen(false);
          }
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Rostdan ham o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
            toast.success("Muvaffaqiyatli — Ma'lumot o'chirildi");
          }
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Yetkazib beruvchilar</h1>
          <p className="text-muted-foreground">Xom ashyo yetkazib beruvchi hamkorlar ro'yxati</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" /> Yangi qo'shish
        </Button>
      </div>

      <div className="flex items-center bg-card p-4 rounded-lg border">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nomi bo'yicha qidiruv..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomi</TableHead>
              <TableHead>Aloqa</TableHead>
              <TableHead>Manzil</TableHead>
              <TableHead className="text-right">Joriy balans</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : suppliers && suppliers.length > 0 ? (
              suppliers.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-base">{item.name}</TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      {item.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" /> {item.phone}
                        </div>
                      )}
                      {item.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" /> {item.email}
                        </div>
                      )}
                      {!item.phone && !item.email && <span className="text-muted-foreground">-</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.address ? (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground max-w-[200px]">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span className="truncate" title={item.address}>{item.address}</span>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-semibold ${item.balance && item.balance < 0 ? 'text-destructive' : item.balance && item.balance > 0 ? 'text-emerald-500' : ''}`}>
                      {formatCurrency(item.balance || 0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenModal(item)}>
                        <Edit2 className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id!)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Ma'lumot topilmadi
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Ma'lumotlarni tahrirlash" : "Yangi qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tashkilot / Ism</Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="MChJ / F.I.Sh." 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input 
                  value={formData.phone || ""} 
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+998 90 123 45 67" 
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={formData.email || ""} 
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="mail@misol.uz" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Manzil</Label>
              <Input 
                value={formData.address || ""} 
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Toshkent sh., Yunusobod t." 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
