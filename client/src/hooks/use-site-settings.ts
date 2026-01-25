import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SiteSetting, HeaderMenu } from "@shared/schema";

export interface SiteSettingsMap {
  // Header
  header_logo_url?: string;
  header_logo_alt?: string;
  header_show_login?: boolean;
  header_show_register?: boolean;
  header_show_cart?: boolean;
  
  // Footer
  footer_company_name?: string;
  footer_ceo_name?: string;
  footer_biz_number?: string;
  footer_address?: string;
  footer_phone?: string;
  footer_email?: string;
  footer_copyright?: string;
  footer_show_terms?: boolean;
  footer_show_privacy?: boolean;
  
  // General
  site_name?: string;
  site_description?: string;
  
  [key: string]: string | boolean | number | undefined;
}

export function usePublicSiteSettings() {
  return useQuery<SiteSettingsMap>({
    queryKey: ["/api/site-settings/public"],
    staleTime: 1000 * 60 * 5, // 5분 캐시
  });
}

export function useAdminSiteSettings() {
  return useQuery<SiteSetting[]>({
    queryKey: ["/api/site-settings"],
  });
}

export function useSiteSettingsByCategory(category: string) {
  return useQuery<SiteSetting[]>({
    queryKey: ["/api/site-settings/category", category],
    enabled: !!category,
  });
}

export function useUpdateSiteSettings() {
  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const res = await apiRequest("PUT", "/api/site-settings/bulk", { settings });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings/public"] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings/category"] });
    },
  });
}

export function useSeedSiteSettings() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/site-settings/seed", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings/public"] });
    },
  });
}

export function settingsToMap(settings: SiteSetting[]): Record<string, string> {
  return settings.reduce((acc, s) => {
    acc[s.settingKey] = s.settingValue || "";
    return acc;
  }, {} as Record<string, string>);
}

// ==================== Header Menus ====================

export function usePublicHeaderMenus() {
  return useQuery<HeaderMenu[]>({
    queryKey: ["/api/header-menus/public"],
    staleTime: 1000 * 60 * 5,
  });
}

export function useAdminHeaderMenus() {
  return useQuery<HeaderMenu[]>({
    queryKey: ["/api/header-menus"],
  });
}

export function useCreateHeaderMenu() {
  return useMutation({
    mutationFn: async (data: { name: string; path: string; sortOrder?: number; isVisible?: string; openInNewTab?: string }) => {
      const res = await apiRequest("POST", "/api/header-menus", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/header-menus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/header-menus/public"] });
    },
  });
}

export function useUpdateHeaderMenu() {
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; path?: string; sortOrder?: number; isVisible?: string; openInNewTab?: string }) => {
      const res = await apiRequest("PUT", `/api/header-menus/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/header-menus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/header-menus/public"] });
    },
  });
}

export function useDeleteHeaderMenu() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/header-menus/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/header-menus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/header-menus/public"] });
    },
  });
}

export function useUpdateHeaderMenuOrder() {
  return useMutation({
    mutationFn: async (menus: { id: string; sortOrder: number }[]) => {
      const res = await apiRequest("PUT", "/api/header-menus/order/update", { menus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/header-menus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/header-menus/public"] });
    },
  });
}

export function useSeedHeaderMenus() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/header-menus/seed", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/header-menus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/header-menus/public"] });
    },
  });
}
