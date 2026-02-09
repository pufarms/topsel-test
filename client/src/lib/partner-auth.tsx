import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

interface PartnerVendor {
  id: number;
  companyName: string;
  loginId: string;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
}

interface PartnerAuthContextType {
  vendor: PartnerVendor | null;
  isLoading: boolean;
  login: (loginId: string, loginPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const PartnerAuthContext = createContext<PartnerAuthContextType>({
  vendor: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function PartnerAuthProvider({ children }: { children: React.ReactNode }) {
  const [vendor, setVendor] = useState<PartnerVendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setVendor(data);
      } else {
        setVendor(null);
      }
    } catch {
      setVendor(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (loginId: string, loginPassword: string) => {
    const res = await apiRequest("POST", "/api/partner/login", { loginId, loginPassword });
    const data = await res.json();
    setVendor(data.vendor);
  };

  const logout = async () => {
    await apiRequest("POST", "/api/partner/logout");
    setVendor(null);
  };

  return (
    <PartnerAuthContext.Provider value={{ vendor, isLoading, login, logout }}>
      {children}
    </PartnerAuthContext.Provider>
  );
}

export function usePartnerAuth() {
  return useContext(PartnerAuthContext);
}
