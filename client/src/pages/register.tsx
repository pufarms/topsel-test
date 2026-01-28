import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Package, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { usePublicSiteSettings } from "@/hooks/use-site-settings";
import { registerSchema } from "@shared/schema";
import type { z } from "zod";

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const [, navigate] = useLocation();
  const { register, user } = useAuth();
  const { toast } = useToast();
  const { data: siteSettings } = usePublicSiteSettings();
  const [isLoading, setIsLoading] = useState(false);
  
  const siteName = siteSettings?.site_name || "TOPSEL";

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      phone: "",
      email: "",
    },
  });

  if (user) {
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
    navigate(isAdmin ? "/admin" : "/dashboard");
    return null;
  }

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      await register(data.username, data.password, data.name, data.phone, data.email);
      toast({ title: "회원가입 성공", description: "환영합니다!" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "회원가입 실패",
        description: error.message || "다시 시도해주세요.",
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
              {siteSettings?.header_logo_url ? (
                <img src={siteSettings.header_logo_url} alt={siteName} className="h-8" />
              ) : (
                <Package className="h-6 w-6 text-primary" />
              )}
              <span className="text-xl font-bold">{siteName}</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">회원가입</CardTitle>
            <CardDescription>새 계정을 만드세요</CardDescription>
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
                          placeholder="아이디 (4자 이상)" 
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
                          placeholder="비밀번호 (6자 이상)" 
                          data-testid="input-password"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이름</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="홍길동" 
                          data-testid="input-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>연락처 (선택)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="010-0000-0000" 
                          data-testid="input-phone"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일 (선택)</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="example@email.com" 
                          data-testid="input-email"
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
                  data-testid="button-register"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  회원가입
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
                로그인
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
