import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Package, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { loginSchema } from "@shared/schema";
import type { z } from "zod";

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, navigate] = useLocation();
  const { login, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  if (user) {
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
    navigate(isAdmin ? "/admin" : "/dashboard");
    return null;
  }

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
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
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          data-testid="input-password"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
