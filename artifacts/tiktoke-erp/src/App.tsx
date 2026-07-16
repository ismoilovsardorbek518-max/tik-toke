import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Layout } from '@/components/Layout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useEffect } from 'react';

// Pages
import NotFound from '@/pages/not-found';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import RawMaterials from '@/pages/RawMaterials';
import RmReceipts from '@/pages/RmReceipts';
import Products from '@/pages/Products';
import Productions from '@/pages/Productions';
import Deliveries from '@/pages/Deliveries';
import Clients from '@/pages/Clients';
import Suppliers from '@/pages/Suppliers';
import Units from '@/pages/Units';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Adjustments from '@/pages/Adjustments';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation('/login');
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!isAuthenticated) return null;
  return <Layout><Component /></Layout>;
}

// Define route components at module level to avoid hook call issues
const ProtectedDashboard    = () => <ProtectedRoute component={Dashboard} />;
const ProtectedRawMaterials = () => <ProtectedRoute component={RawMaterials} />;
const ProtectedRmReceipts   = () => <ProtectedRoute component={RmReceipts} />;
const ProtectedProducts     = () => <ProtectedRoute component={Products} />;
const ProtectedProductions  = () => <ProtectedRoute component={Productions} />;
const ProtectedDeliveries   = () => <ProtectedRoute component={Deliveries} />;
const ProtectedClients      = () => <ProtectedRoute component={Clients} />;
const ProtectedSuppliers    = () => <ProtectedRoute component={Suppliers} />;
const ProtectedUnits        = () => <ProtectedRoute component={Units} />;
const ProtectedReports      = () => <ProtectedRoute component={Reports} />;
const ProtectedSettings     = () => <ProtectedRoute component={Settings} />;
const ProtectedAdjustments  = () => <ProtectedRoute component={Adjustments} />;

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={ProtectedDashboard} />
      <Route path="/raw-materials" component={ProtectedRawMaterials} />
      <Route path="/rm-receipts" component={ProtectedRmReceipts} />
      <Route path="/products" component={ProtectedProducts} />
      <Route path="/productions" component={ProtectedProductions} />
      <Route path="/deliveries" component={ProtectedDeliveries} />
      <Route path="/clients" component={ProtectedClients} />
      <Route path="/suppliers" component={ProtectedSuppliers} />
      <Route path="/units" component={ProtectedUnits} />
      <Route path="/reports" component={ProtectedReports} />
      <Route path="/adjustments" component={ProtectedAdjustments} />
      <Route path="/settings" component={ProtectedSettings} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
