import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import AdminLayout from "@/pages/admin-layout";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminOrders from "@/pages/admin/orders";
import AdminGallery from "@/pages/admin/gallery";
import AdminManagement from "@/pages/admin/admins";
import PartnerManagement from "@/pages/admin/partners";
import MemberManagement from "@/pages/admin/members";
import MemberDetail from "@/pages/admin/member-detail";
import PlaceholderPage from "@/pages/admin/placeholder";
import CategoryManagement from "@/pages/admin/products/categories";
import ProductRegistrationPage from "@/pages/admin/products/registration";
import NextWeekProductsPage from "@/pages/admin/products/next-week-products";
import CurrentProductsPage from "@/pages/admin/products/current-products";
import SuspendedProductsPage from "@/pages/admin/products/suspended-products";
import InventoryCategoriesPage from "@/pages/admin/inventory/categories";
import MaterialsPage from "@/pages/admin/inventory/materials";
import ProductMappingPage from "@/pages/admin/inventory/mapping";
import StockStatusPage from "@/pages/admin/inventory/stock";
import ReceivingPage from "@/pages/admin/inventory/receiving";
import InventoryHistoryPage from "@/pages/admin/inventory/history";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
  if (!isAdmin) {
    navigate("/dashboard");
    return null;
  }

  return <AdminLayout>{children}</AdminLayout>;
}


function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      
      <Route path="/admin">
        <AdminRoute><AdminDashboard /></AdminRoute>
      </Route>
      <Route path="/admin/users">
        <AdminRoute><MemberManagement /></AdminRoute>
      </Route>
      <Route path="/admin/members/:id">
        <AdminRoute><MemberDetail /></AdminRoute>
      </Route>
      <Route path="/admin/admins">
        <AdminRoute><AdminManagement /></AdminRoute>
      </Route>
      <Route path="/admin/partners">
        <AdminRoute><PartnerManagement /></AdminRoute>
      </Route>
      <Route path="/admin/orders">
        <AdminRoute><AdminOrders /></AdminRoute>
      </Route>
      <Route path="/admin/products/categories">
        <AdminRoute><CategoryManagement /></AdminRoute>
      </Route>
      <Route path="/admin/products/registration">
        <AdminRoute><ProductRegistrationPage /></AdminRoute>
      </Route>
      <Route path="/admin/products/next-week">
        <AdminRoute><NextWeekProductsPage /></AdminRoute>
      </Route>
      <Route path="/admin/products/current">
        <AdminRoute><CurrentProductsPage /></AdminRoute>
      </Route>
      <Route path="/admin/products/suspended">
        <AdminRoute><SuspendedProductsPage /></AdminRoute>
      </Route>
      <Route path="/admin/inventory/categories">
        <AdminRoute><InventoryCategoriesPage /></AdminRoute>
      </Route>
      <Route path="/admin/inventory/materials">
        <AdminRoute><MaterialsPage /></AdminRoute>
      </Route>
      <Route path="/admin/inventory/mapping">
        <AdminRoute><ProductMappingPage /></AdminRoute>
      </Route>
      <Route path="/admin/inventory/stock">
        <AdminRoute><StockStatusPage /></AdminRoute>
      </Route>
      <Route path="/admin/inventory/receiving">
        <AdminRoute><ReceivingPage /></AdminRoute>
      </Route>
      <Route path="/admin/inventory/history">
        <AdminRoute><InventoryHistoryPage /></AdminRoute>
      </Route>
      <Route path="/admin/settlements">
        <AdminRoute><PlaceholderPage title="정산관리" description="정산 내역을 관리합니다" /></AdminRoute>
      </Route>
      <Route path="/admin/stats">
        <AdminRoute><PlaceholderPage title="통계관리" description="통계 데이터를 확인합니다" /></AdminRoute>
      </Route>
      <Route path="/admin/coupons">
        <AdminRoute><PlaceholderPage title="쿠폰관리" description="쿠폰을 관리합니다" /></AdminRoute>
      </Route>
      <Route path="/admin/pages">
        <AdminRoute><PlaceholderPage title="페이지관리" description="페이지를 관리합니다" /></AdminRoute>
      </Route>
      <Route path="/admin/settings/site">
        <AdminRoute><PlaceholderPage title="사이트 설정" description="사이트 기본 설정을 관리합니다" /></AdminRoute>
      </Route>
      <Route path="/admin/settings/gallery">
        <AdminRoute><AdminGallery /></AdminRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
