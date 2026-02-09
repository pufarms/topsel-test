import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { PublicHeader } from "@/components/public/PublicHeader";
import { loginSchema } from "@shared/schema";
import type { z } from "zod";
import type { Page } from "@shared/schema";

type LoginForm = z.infer<typeof loginSchema>;

interface LoginPageContent {
  title?: string;
  description?: string;
  fields?: {
    username_label?: string;
    username_placeholder?: string;
    password_label?: string;
    password_placeholder?: string;
    remember_me_label?: string;
    submit_button?: string;
    register_prompt?: string;
    register_link?: string;
  };
  messages?: {
    success_title?: string;
    success_description?: string;
    error_title?: string;
    error_description?: string;
  };
}

const SAVED_USERNAME_KEY = "saved_username";
const REMEMBER_ME_KEY = "remember_me";

export default function Login() {
  const [, navigate] = useLocation();
  const { login, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { data: pageData } = useQuery<Page>({
    queryKey: ["/api/pages/by-path", { path: "/login" }],
    queryFn: async () => {
      const res = await fetch("/api/pages/by-path?path=/login");
      if (!res.ok) throw new Error("Failed to fetch page");
      return res.json();
    },
  });

  const content = (pageData?.content as LoginPageContent) || {};
  const fields = content.fields || {};
  const messages = content.messages || {};

  const savedRememberMe = localStorage.getItem(REMEMBER_ME_KEY) === "true";
  const savedUsername = savedRememberMe ? (localStorage.getItem(SAVED_USERNAME_KEY) || "") : "";

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: savedUsername,
      password: "",
    },
  });

  useEffect(() => {
    setRememberMe(savedRememberMe);
  }, []);

  if (user) {
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
    navigate(isAdmin ? "/admin" : "/");
    return null;
  }

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem(SAVED_USERNAME_KEY, data.username);
        localStorage.setItem(REMEMBER_ME_KEY, "true");
      } else {
        localStorage.removeItem(SAVED_USERNAME_KEY);
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      const resData = await login(data.username, data.password);

      if (resData.role === "vendor" && resData.redirectTo) {
        toast({ 
          title: "협력업체 로그인 성공", 
          description: `${resData.companyName || "협력업체"} 포털로 이동합니다.` 
        });
        window.location.href = resData.redirectTo;
        return;
      }

      toast({ 
        title: messages.success_title || "로그인 성공", 
        description: messages.success_description || "환영합니다!" 
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: messages.error_title || "로그인 실패",
        description: error.message || messages.error_description || "아이디 또는 비밀번호를 확인해주세요.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center p-6 pt-24">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{content.title || "로그인"}</CardTitle>
            <CardDescription>{content.description || "계정에 로그인하세요"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fields.username_label || "아이디"}</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder={fields.username_placeholder || "아이디를 입력하세요"} 
                          autoComplete="off"
                          data-testid="input-username"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fields.password_label || "비밀번호"}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"}
                            placeholder={fields.password_placeholder || "••••••••"} 
                            className="pr-12"
                            autoComplete="new-password"
                            data-testid="input-password"
                            {...field} 
                          />
                          <button
                            type="button"
                            className="absolute right-3 inset-y-0 flex items-center justify-center"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Eye className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    data-testid="checkbox-remember-me"
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {fields.remember_me_label || "아이디 저장"}
                  </label>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {fields.submit_button || "로그인"}
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {fields.register_prompt || "계정이 없으신가요?"}{" "}
              <Link href="/register" className="text-primary hover:underline" data-testid="link-register">
                {fields.register_link || "회원가입"}
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
