import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Building2, Phone, Mail, MapPin, Wallet, Coins, Loader2, Save, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PublicLayout } from "@/components/public/PublicLayout";

const memberGradeLabels: Record<string, string> = {
  PENDING: "승인대기",
  ASSOCIATE: "준회원",
  START: "스타트",
  DRIVING: "드라이빙",
  TOP: "탑셀러",
};

const profileUpdateSchema = z.object({
  representative: z.string().min(1, "대표자명을 입력해주세요"),
  businessAddress: z.string().optional(),
  phone: z.string().min(1, "대표연락처를 입력해주세요"),
  managerName: z.string().optional(),
  managerPhone: z.string().optional(),
  email: z.string().email("유효한 이메일을 입력해주세요").optional().or(z.literal("")),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다").optional().or(z.literal("")),
  passwordConfirm: z.string().optional(),
}).refine((data) => {
  if (data.password && data.password !== data.passwordConfirm) {
    return false;
  }
  return true;
}, {
  message: "비밀번호가 일치하지 않습니다",
  path: ["passwordConfirm"],
});

type ProfileUpdateForm = z.infer<typeof profileUpdateSchema>;

interface MemberProfile {
  id: string;
  username: string;
  grade: string;
  companyName: string;
  businessNumber: string;
  businessAddress: string | null;
  representative: string;
  phone: string;
  managerName: string | null;
  managerPhone: string | null;
  email: string | null;
  deposit: number;
  point: number;
  status: string;
  memo: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function MyPage() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<MemberProfile>({
    queryKey: ["/api/member/profile"],
    enabled: !!user && user.role === "member",
  });

  const form = useForm<ProfileUpdateForm>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      representative: "",
      businessAddress: "",
      phone: "",
      managerName: "",
      managerPhone: "",
      email: "",
      password: "",
      passwordConfirm: "",
    },
    values: profile ? {
      representative: profile.representative || "",
      businessAddress: profile.businessAddress || "",
      phone: profile.phone || "",
      managerName: profile.managerName || "",
      managerPhone: profile.managerPhone || "",
      email: profile.email || "",
      password: "",
      passwordConfirm: "",
    } : undefined,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileUpdateForm) => {
      const { passwordConfirm, ...updateData } = data;
      if (!updateData.password) {
        delete (updateData as any).password;
      }
      return await apiRequest("PATCH", "/api/member/profile", updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/profile"] });
      form.setValue("password", "");
      form.setValue("passwordConfirm", "");
      toast({ title: "저장 완료", description: "회원 정보가 수정되었습니다." });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "수정 실패",
        description: error.message || "다시 시도해주세요.",
      });
    },
  });

  if (authLoading || profileLoading) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PublicLayout>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  if (user.role !== "member") {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">회원 전용 페이지입니다.</p>
              <Button className="mt-4" onClick={() => navigate("/")}>홈으로 이동</Button>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  const onSubmit = async (data: ProfileUpdateForm) => {
    await updateProfileMutation.mutateAsync(data);
  };

  return (
    <PublicLayout>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">마이페이지</h1>
          <p className="text-muted-foreground">회원 정보를 확인하고 수정할 수 있습니다.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">상호명</p>
                <p className="font-medium">{profile?.companyName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">사업자번호</p>
                <p className="font-medium">{profile?.businessNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">아이디</p>
                <p className="font-medium">{profile?.username}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">등급</p>
                <Badge variant="outline" className="mt-1">
                  {profile?.grade ? memberGradeLabels[profile.grade] || profile.grade : "-"}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">예치금</p>
                  <p className="font-medium">{profile?.deposit?.toLocaleString() || 0}원</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">포인트</p>
                  <p className="font-medium">{profile?.point?.toLocaleString() || 0}P</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                정보 수정
              </CardTitle>
              <CardDescription>
                연락처, 주소 등의 정보를 수정할 수 있습니다. 상호명, 사업자번호, 등급은 관리자만 수정 가능합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="representative"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>대표자명 *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-representative" />
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
                          <FormLabel>대표연락처 *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="businessAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>사업장 주소</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-business-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="managerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>담당자명</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-manager-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="managerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>담당자 연락처</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-manager-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>이메일</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator className="my-4" />
                  <p className="text-sm text-muted-foreground">비밀번호 변경 (변경하지 않으려면 비워두세요)</p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>새 비밀번호</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type={showPassword ? "text" : "password"} 
                                {...field} 
                                data-testid="input-password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="passwordConfirm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>비밀번호 확인</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type={showPasswordConfirm ? "text" : "password"} 
                                {...field}
                                data-testid="input-password-confirm"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                              >
                                {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      type="submit" 
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {updateProfileMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      저장
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}
