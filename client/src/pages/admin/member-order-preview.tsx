import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Package, 
  BarChart3, 
  FileDown, 
  Plus, 
  Star, 
  CheckCircle2,
  ExternalLink
} from "lucide-react";

export default function MemberOrderPreview() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">주문등록(회원) 미리보기</h1>
          <p className="text-muted-foreground">회원이 보는 주문등록 페이지 미리보기입니다</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => window.open('/dashboard?tab=order-new', '_blank')}>
          <ExternalLink className="h-4 w-4" />
          실제 페이지 열기
        </Button>
      </div>

      <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5">
        <div className="text-center text-sm text-muted-foreground mb-4">
          <Badge variant="outline" className="mb-2">회원 화면 미리보기</Badge>
        </div>
        
        <div className="space-y-6 bg-background rounded-lg border shadow-sm">
          {/* 주문 등록 안내 */}
          <Card className="border-l-4 border-l-emerald-500 m-4">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="h-5 w-5 text-red-500" />
                    <h3 className="text-lg font-bold">주문 등록 안내</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>
                        <strong>주문 마감:</strong> 1차 마감: 당일 오전 9시(최우선 발송)/ 2차 마감: 당일 오전 10시
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>엑셀 파일로만 주문 등록 가능 (개별 수기 접수 불가)/ <strong className="text-blue-600">엑셀 xlsx,xls 형식</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>주문 등록 완료 후 메신저로 알림이 발송됩니다</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>주문 마감 시간을 꼭 지켜주세요</span>
                    </li>
                  </ul>
                </div>
                <Button variant="ghost" className="text-emerald-600 shrink-0">
                  상세 가이드 보기 →
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 주문 대기 리스트 */}
          <Card className="m-4">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">주문 대기 리스트</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 필터 영역 */}
              <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-8">오늘</Button>
                    <Button size="sm" variant="outline" className="h-8">1주일</Button>
                    <Button size="sm" variant="outline" className="h-8">1개월</Button>
                  </div>
                  <span className="text-sm text-muted-foreground">* 최대 1개월까지</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">조회 기간:</span>
                    <input type="date" className="h-8 px-2 border rounded text-sm" defaultValue="2026-02-02" />
                    <span>~</span>
                    <input type="date" className="h-8 px-2 border rounded text-sm" defaultValue="2026-02-02" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium w-12">검색:</label>
                    <select className="h-8 px-2 border rounded text-sm min-w-[120px]">
                      <option>선택 없음</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium w-12">대분류</label>
                    <select className="h-8 px-2 border rounded text-sm min-w-[160px]">
                      <option>-- 전체 대분류 --</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">중분류</label>
                    <select className="h-8 px-2 border rounded text-sm min-w-[160px]">
                      <option>-- 전체 중분류 --</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 bg-sky-500 hover:bg-sky-600">조회</Button>
                    <Button size="sm" variant="secondary" className="h-8">초기화</Button>
                  </div>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8">
                    <FileDown className="h-4 w-4 mr-1" />
                    다운로드
                  </Button>
                  <Button size="sm" variant="outline" className="h-8">
                    <FileDown className="h-4 w-4 mr-1" />
                    양식파일 다운로드
                  </Button>
                  <Button size="sm" className="h-8 bg-primary">
                    <Plus className="h-4 w-4 mr-1" />
                    주문 등록
                  </Button>
                </div>
                <span className="text-sm text-muted-foreground">0 / 0 (페이지 1/1)</span>
              </div>

              {/* 테이블 */}
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold whitespace-nowrap">주문자명</TableHead>
                      <TableHead className="font-semibold whitespace-nowrap">주문자 전화번호</TableHead>
                      <TableHead className="font-semibold whitespace-nowrap">수령자명</TableHead>
                      <TableHead className="font-semibold whitespace-nowrap">수령자휴대폰번호</TableHead>
                      <TableHead className="font-semibold whitespace-nowrap">수령자 전화번호</TableHead>
                      <TableHead className="font-semibold whitespace-nowrap">수령자 우편번호</TableHead>
                      <TableHead className="font-semibold whitespace-nowrap">수령자 주소</TableHead>
                      <TableHead className="font-semibold whitespace-nowrap">배송메시지</TableHead>
                      <TableHead className="font-semibold whitespace-nowrap">상품코드</TableHead>
                      <TableHead className="font-semibold whitespace-nowrap">상품명</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                        등록된 주문이 없습니다
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 주문 대기 합계 */}
          <Card className="m-4 mb-6">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">주문 대기 합계</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <span>페이지 당 항목 수:</span>
                  <select className="h-8 px-2 border rounded text-sm">
                    <option>10개</option>
                  </select>
                </div>
                <Button size="sm" className="h-8 bg-slate-700 hover:bg-slate-800">
                  <FileDown className="h-4 w-4 mr-1" />
                  다운로드
                </Button>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">대분류</TableHead>
                      <TableHead className="font-semibold">중분류</TableHead>
                      <TableHead className="font-semibold">상품코드</TableHead>
                      <TableHead className="font-semibold">상품명</TableHead>
                      <TableHead className="font-semibold">항목</TableHead>
                      <TableHead className="font-semibold text-right">합계</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={5} className="text-center font-semibold">전체 합계</TableCell>
                      <TableCell className="text-right font-bold">0</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
