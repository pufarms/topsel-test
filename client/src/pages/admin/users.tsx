import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { userTiers, type User } from "@shared/schema";
import * as XLSX from "xlsx";

export default function AdminUsers() {
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateTierMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/tier`, { tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "등급 변경", description: "회원 등급이 변경되었습니다." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "오류", description: "등급 변경에 실패했습니다." });
    },
  });

  const handleExportExcel = () => {
    const sellers = users.filter(u => u.role === "seller");
    if (sellers.length === 0) {
      toast({ variant: "destructive", title: "내보내기 실패", description: "내보낼 사용자가 없습니다." });
      return;
    }

    const data = sellers.map(u => ({
      이름: u.name,
      이메일: u.email,
      등급: u.tier,
      가입일: new Date(u.createdAt).toLocaleDateString("ko-KR"),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "사용자목록");
    XLSX.writeFile(wb, `users_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "내보내기 완료", description: "엑셀 파일이 다운로드되었습니다." });
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const sellers = users.filter(u => u.role === "seller");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <Button onClick={handleExportExcel} data-testid="button-export-excel">
          <Download className="h-4 w-4 mr-2" />
          엑셀 내보내기
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>전체 사용자 목록</CardTitle>
          <CardDescription>일반 사용자(셀러) 계정을 관리합니다</CardDescription>
        </CardHeader>
        <CardContent>
          {sellers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              등록된 사용자가 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이메일</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>등급</TableHead>
                    <TableHead>가입일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <Select
                          value={user.tier}
                          onValueChange={(value) => updateTierMutation.mutate({ userId: user.id, tier: value })}
                          disabled={updateTierMutation.isPending}
                        >
                          <SelectTrigger className="w-32" data-testid={`select-tier-${user.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {userTiers.map((tier) => (
                              <SelectItem key={tier} value={tier}>
                                {tier}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
