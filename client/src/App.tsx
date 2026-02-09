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
import Logout from "@/pages/logout";
import AboutPage from "@/pages/about";
import Dashboard from "@/pages/dashboard";
import AdminLayout from "@/pages/admin-layout";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminOrders from "@/pages/admin/orders";
import AdminGallery from "@/pages/admin/gallery";
import AdminManagement from "@/pages/admin/admins";
import PartnerManagement from "@/pages/admin/partners";
import VendorManagement from "@/pages/admin/vendors";
import MemberManagement from "@/pages/admin/members";
import TermAgreementsPage from "@/pages/admin/term-agreements";
import MemberDetail from "@/pages/admin/member-detail";
import PlaceholderPage from "@/pages/admin/placeholder";
import AdminSettlements from "@/pages/admin/settlements";
import CategoryManagement from "@/pages/admin/products/categories";
import ProductRegistrationPage from "@/pages/admin/products/registration";
import NextWeekProductsPage from "@/pages/admin/products/next-week-products";
import CurrentProductsPage from "@/pages/admin/products/current-products";
import SuspendedProductsPage from "@/pages/admin/products/suspended-products";
import MaterialsPage from "@/pages/admin/inventory/materials";
import MaterialTypesPage from "@/pages/admin/inventory/material-types";
import ProductMappingPage from "@/pages/admin/inventory/mapping";
import StockStatusPage from "@/pages/admin/inventory/stock";
import ReceivingPage from "@/pages/admin/inventory/receiving";
import InventoryHistoryPage from "@/pages/admin/inventory/history";
import SiteSettingsPage from "@/pages/admin/settings/site-settings";
import FormTemplatesPage from "@/pages/admin/settings/form-templates";
import PagesManagement from "@/pages/admin/pages";
import AlimtalkPage from "@/pages/admin/kakao-notifications/alimtalk";
import BrandtalkPage from "@/pages/admin/kakao-notifications/brandtalk";
import OrdersPendingPage from "@/pages/admin/orders/pending";
import OrdersAdminCancelPage from "@/pages/admin/orders/admin-cancel";
import OrdersPreparingPage from "@/pages/admin/orders/preparing";
import OrdersPrintWaybillPage from "@/pages/admin/orders/print-waybill";
import OrdersReadyToShipPage from "@/pages/admin/orders/ready-to-ship";
import OrdersCancelledPage from "@/pages/admin/orders/cancelled";
import OrdersShippingPage from "@/pages/admin/orders/shipping";
import OrdersCompletedPage from "@/pages/admin/orders/completed";
import OrdersAllocationsPage from "@/pages/admin/orders/allocations";
import PublicPreviewPage from "@/pages/public-preview";
import MemberOrderPreview from "@/pages/admin/member-order-preview";
import MyPage from "@/pages/mypage";
import DynamicPage from "@/pages/dynamic-page";
import { PartnerAuthProvider } from "@/lib/partner-auth";
import PartnerLogin from "@/pages/partner/login";
import PartnerLayout from "@/pages/partner/layout";
import PartnerDashboard from "@/pages/partner/dashboard";
import PartnerAllocations from "@/pages/partner/allocations";
import PartnerOrders from "@/pages/partner/orders";
import PartnerTracking from "@/pages/partner/tracking";
import PartnerDelivery from "@/pages/partner/delivery";
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
      <Route path="/" component={DynamicPage} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/logout" component={Logout} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/mypage" component={MyPage} />
      <Route path="/public-preview" component={PublicPreviewPage} />
      <Route path="/about" component={AboutPage} />
      
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
      <Route path="/admin/vendors">
        <AdminRoute><VendorManagement /></AdminRoute>
      </Route>
      <Route path="/admin/term-agreements">
        <AdminRoute><TermAgreementsPage /></AdminRoute>
      </Route>
      <Route path="/admin/orders">
        <AdminRoute><AdminOrders /></AdminRoute>
      </Route>
      <Route path="/admin/orders/pending">
        <AdminRoute><OrdersPendingPage /></AdminRoute>
      </Route>
      <Route path="/admin/orders/admin-cancel">
        <AdminRoute><OrdersAdminCancelPage /></AdminRoute>
      </Route>
      <Route path="/admin/orders/preparing">
        <AdminRoute><OrdersPreparingPage /></AdminRoute>
      </Route>
      <Route path="/admin/orders/print-waybill">
        <AdminRoute><OrdersPrintWaybillPage /></AdminRoute>
      </Route>
      <Route path="/admin/orders/ready-to-ship">
        <AdminRoute><OrdersReadyToShipPage /></AdminRoute>
      </Route>
      <Route path="/admin/orders/cancelled">
        <AdminRoute><OrdersCancelledPage /></AdminRoute>
      </Route>
      <Route path="/admin/orders/shipping">
        <AdminRoute><OrdersShippingPage /></AdminRoute>
      </Route>
      <Route path="/admin/orders/completed">
        <AdminRoute><OrdersCompletedPage /></AdminRoute>
      </Route>
      <Route path="/admin/orders/allocations">
        <AdminRoute><OrdersAllocationsPage /></AdminRoute>
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
      <Route path="/admin/inventory/materials">
        <AdminRoute><MaterialsPage /></AdminRoute>
      </Route>
      <Route path="/admin/inventory/material-types">
        <AdminRoute><MaterialTypesPage /></AdminRoute>
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
        <AdminRoute><AdminSettlements /></AdminRoute>
      </Route>
      <Route path="/admin/stats">
        <AdminRoute><PlaceholderPage title="통계관리" description="통계 데이터를 확인합니다" /></AdminRoute>
      </Route>
      <Route path="/admin/coupons">
        <AdminRoute><PlaceholderPage title="쿠폰관리" description="쿠폰을 관리합니다" /></AdminRoute>
      </Route>
      <Route path="/admin/kakao-notifications/alimtalk">
        <AdminRoute><AlimtalkPage /></AdminRoute>
      </Route>
      <Route path="/admin/kakao-notifications/brandtalk">
        <AdminRoute><BrandtalkPage /></AdminRoute>
      </Route>
      <Route path="/admin/pages">
        <AdminRoute><PagesManagement /></AdminRoute>
      </Route>
      <Route path="/admin/member-order-preview">
        <AdminRoute><MemberOrderPreview /></AdminRoute>
      </Route>
      <Route path="/admin/settings/site">
        <AdminRoute><SiteSettingsPage /></AdminRoute>
      </Route>
      <Route path="/admin/settings/form-templates">
        <AdminRoute><FormTemplatesPage /></AdminRoute>
      </Route>
      <Route path="/admin/settings/gallery">
        <AdminRoute><AdminGallery /></AdminRoute>
      </Route>

      <Route path="/partner/login">
        <PartnerAuthProvider><PartnerLogin /></PartnerAuthProvider>
      </Route>
      <Route path="/partner">
        <PartnerAuthProvider><PartnerLayout><PartnerDashboard /></PartnerLayout></PartnerAuthProvider>
      </Route>
      <Route path="/partner/allocations">
        <PartnerAuthProvider><PartnerLayout><PartnerAllocations /></PartnerLayout></PartnerAuthProvider>
      </Route>
      <Route path="/partner/orders">
        <PartnerAuthProvider><PartnerLayout><PartnerOrders /></PartnerLayout></PartnerAuthProvider>
      </Route>
      <Route path="/partner/tracking">
        <PartnerAuthProvider><PartnerLayout><PartnerTracking /></PartnerLayout></PartnerAuthProvider>
      </Route>
      <Route path="/partner/delivery">
        <PartnerAuthProvider><PartnerLayout><PartnerDelivery /></PartnerLayout></PartnerAuthProvider>
      </Route>
      
      {/* Dynamic CMS pages - catch-all route */}
      <Route path="/:path*" component={DynamicPage} />
      
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
