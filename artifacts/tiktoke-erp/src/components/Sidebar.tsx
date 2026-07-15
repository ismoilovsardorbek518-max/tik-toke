import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  LayoutDashboard, Package, ArrowDownToLine, Box,
  Factory, Truck, Users, Building2, BarChart3,
  Settings, LogOut, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV = [
  { href: "/", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/raw-materials", label: "Hom ashyo", icon: Package, divider: true },
  { href: "/rm-receipts", label: "Hom ashyo kirim", icon: ArrowDownToLine },
  { href: "/products", label: "Mahsulotlar", icon: Box, divider: true },
  { href: "/productions", label: "Ishlab chiqarish", icon: Factory },
  { href: "/deliveries", label: "Yuk chiqarish", icon: Truck },
  { href: "/clients", label: "Klientlar", icon: Users, divider: true },
  { href: "/suppliers", label: "Yetkazib beruvchilar", icon: Building2 },
  { href: "/units", label: "O'lchov birliklari", icon: ChevronRight },
  { href: "/reports", label: "Hisobotlar", icon: BarChart3, divider: true },
  { href: "/settings", label: "Sozlamalar", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout: authLogout } = useAuth();

  const logout = useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }).catch(() => {}),
    onSettled: () => { authLogout(); },
  });

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-border flex flex-col shadow-sm">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Factory className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight text-primary">TIK TOKE</div>
            <div className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">ERP</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, divider }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <div key={href}>
              {divider && <div className="my-1 border-t border-border/50" />}
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 no-underline",
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
              {user?.username?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">{user?.username}</div>
            <div className="text-[10px] text-muted-foreground capitalize">{user?.role}</div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 text-muted-foreground hover:text-destructive"
            onClick={() => logout.mutate()}
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
