import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SiteSetting } from "@shared/schema";

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
