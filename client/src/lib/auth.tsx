import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "./queryClient";
import type { User } from "@shared/schema";

interface LoginResponse {
  role?: string;
  redirectTo?: string;
  companyName?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  register: (username: string, password: string, name: string, phone?: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }): Promise<LoginResponse> => {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.role !== "vendor") {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, password, name, phone, email }: { username: string; password: string; name: string; phone?: string; email?: string }) => {
      await apiRequest("POST", "/api/auth/register", { username, password, name, phone, email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/me"], null);
    },
  });

  const login = async (username: string, password: string): Promise<LoginResponse> => {
    return await loginMutation.mutateAsync({ username, password });
  };

  const register = async (username: string, password: string, name: string, phone?: string, email?: string) => {
    await registerMutation.mutateAsync({ username, password, name, phone, email });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
