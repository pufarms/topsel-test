import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { PublicHeader } from "@/components/public/PublicHeader";
import { registerSchema } from "@shared/schema";
import type { z } from "zod";
import type { Page } from "@shared/schema";

type RegisterForm = z.infer<typeof registerSchema>;

interface RegisterPageContent {
  title?: string;
  description?: string;
  fields?: {
    username_label?: string;
    username_placeholder?: string;
    password_label?: string;
    password_placeholder?: string;
    name_label?: string;
    name_placeholder?: string;
    phone_label?: string;
    phone_placeholder?: string;
    email_label?: string;
    email_placeholder?: string;
    submit_button?: string;
    login_prompt?: string;
    login_link?: string;
  };
  messages?: {
    success_title?: string;
    success_description?: string;
    error_title?: string;
    error_description?: string;
  };
}

export default function Register() {
  const [, navigate] = useLocation();
  const { register, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const { data: pageData } = useQuery<Page>({
    queryKey: ["/api/pages/by-path", { path: "/register" }],
    queryFn: async () => {
      const res = await fetch("/api/pages/by-path?path=/register");
      if (!res.ok) throw new Error("Failed to fetch page");
      return res.json();
    },
  });

  const content = (pageData?.content as RegisterPageContent) || {};
  const fields = content.fields || {};
  const messages = content.messages || {};

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
      toast({ 
        title: messages.success_title || "회원가입 성공", 
        description: messages.success_description || "환영합니다!" 
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: messages.error_title || "회원가입 실패",
        description: error.message || messages.error_description || "다시 시도해주세요.",
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
            <CardTitle className="text-2xl">{content.title || "회원가입"}</CardTitle>
            <CardDescription>{content.description || "새 계정을 만드세요"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fields.username_label || "아이디"}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={fields.username_placeholder || "아이디 (4자 이상)"} 
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
                        <Input 
                          type="password" 
                          placeholder={fields.password_placeholder || "비밀번호 (6자 이상)"} 
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
                      <FormLabel>{fields.name_label || "이름"}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={fields.name_placeholder || "이름을 입력하세요"} 
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
                      <FormLabel>{fields.phone_label || "전화번호"}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={fields.phone_placeholder || "전화번호를 입력하세요"} 
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
                      <FormLabel>{fields.email_label || "이메일"}</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder={fields.email_placeholder || "이메일을 입력하세요"} 
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
                  {fields.submit_button || "회원가입"}
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {fields.login_prompt || "이미 계정이 있으신가요?"}{" "}
              <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
                {fields.login_link || "로그인"}
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
