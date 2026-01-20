import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Package, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { loginSchema } from "@shared/schema";
import type { z } from "zod";

type LoginForm = z.infer<typeof loginSchema>;

const SAVED_USERNAME_KEY = "saved_username";
const REMEMBER_ME_KEY = "remember_me";

export default function Login() {
  const [, navigate] = useLocation();
  const { login, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    const savedRememberMe = localStorage.getItem(REMEMBER_ME_KEY) === "true";
    const savedUsername = localStorage.getItem(SAVED_USERNAME_KEY) || "";
    setRememberMe(savedRememberMe);
    if (savedRememberMe && savedUsername) {
      form.setValue("username", savedUsername);
    }
  }, [form]);

  if (user) {
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
    navigate(isAdmin ? "/admin" : "/dashboard");
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
      await login(data.username, data.password);
      toast({ title: "로그인 성공", description: "환영합니다!" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "로그인 실패",
        description: error.message || "아이디 또는 비밀번호를 확인해주세요.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer w-fit">
              <Package className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">주문관리</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">로그인</CardTitle>
            <CardDescription>계정에 로그인하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>아이디</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder="아이디를 입력하세요" 
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
                      <FormLabel>비밀번호</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••" 
                            className="pr-12"
                            data-testid="input-password"
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Eye className="h-5 w-5 text-muted-foreground" />
                            )}
                          </Button>
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
                    아이디 저장
                  </label>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  로그인
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              계정이 없으신가요?{" "}
              <Link href="/register" className="text-primary hover:underline" data-testid="link-register">
                회원가입
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
