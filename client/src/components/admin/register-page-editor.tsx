import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RegisterPageContent {
  title?: string;
  description?: string;
  sections?: {
    member_info?: { title?: string };
    business_info?: { title?: string };
    manager_info?: { title?: string; description?: string };
    documents?: { title?: string };
    terms?: { title?: string };
    verification?: { title?: string; description?: string; button_text?: string };
    signature?: { title?: string; description?: string };
  };
  labels?: Record<string, string>;
  placeholders?: Record<string, string>;
  terms_content?: {
    service?: { title?: string; content?: string };
    privacy?: { title?: string; content?: string };
    third_party?: { title?: string; content?: string };
  };
  messages?: Record<string, string>;
  submit_button?: string;
}

interface RegisterPageEditorProps {
  content: RegisterPageContent;
  onChange: (content: RegisterPageContent) => void;
}

export function RegisterPageEditor({ content, onChange }: RegisterPageEditorProps) {
  const updateField = (path: string[], value: string) => {
    const newContent = JSON.parse(JSON.stringify(content));
    let current = newContent;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {};
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    onChange(newContent);
  };

  return (
    <div className="space-y-6 p-4 max-h-[70vh] overflow-y-auto">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">기본 정보</TabsTrigger>
          <TabsTrigger value="sections">섹션 제목</TabsTrigger>
          <TabsTrigger value="labels">라벨</TabsTrigger>
          <TabsTrigger value="messages">메시지</TabsTrigger>
          <TabsTrigger value="terms">약관</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">페이지 기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>페이지 제목</Label>
                <Input 
                  value={content.title || ""} 
                  onChange={(e) => updateField(["title"], e.target.value)}
                  placeholder="탑셀러 회원가입"
                />
              </div>
              <div>
                <Label>페이지 설명</Label>
                <Input 
                  value={content.description || ""} 
                  onChange={(e) => updateField(["description"], e.target.value)}
                  placeholder="30년 과일 유통 경력의 믿을 수 있는 파트너"
                />
              </div>
              <div>
                <Label>제출 버튼 텍스트</Label>
                <Input 
                  value={content.submit_button || ""} 
                  onChange={(e) => updateField(["submit_button"], e.target.value)}
                  placeholder="회원가입 신청하기"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">섹션 제목 및 설명</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>회원정보 섹션 제목</Label>
                  <Input 
                    value={content.sections?.member_info?.title || ""} 
                    onChange={(e) => updateField(["sections", "member_info", "title"], e.target.value)}
                    placeholder="회원정보"
                  />
                </div>
                <div>
                  <Label>사업자 정보 섹션 제목</Label>
                  <Input 
                    value={content.sections?.business_info?.title || ""} 
                    onChange={(e) => updateField(["sections", "business_info", "title"], e.target.value)}
                    placeholder="사업자 정보"
                  />
                </div>
                <div>
                  <Label>담당자 정보 섹션 제목</Label>
                  <Input 
                    value={content.sections?.manager_info?.title || ""} 
                    onChange={(e) => updateField(["sections", "manager_info", "title"], e.target.value)}
                    placeholder="담당자 정보"
                  />
                </div>
                <div>
                  <Label>담당자 정보 설명</Label>
                  <Input 
                    value={content.sections?.manager_info?.description || ""} 
                    onChange={(e) => updateField(["sections", "manager_info", "description"], e.target.value)}
                    placeholder="최대 3명까지 등록 가능"
                  />
                </div>
                <div>
                  <Label>서류 업로드 섹션 제목</Label>
                  <Input 
                    value={content.sections?.documents?.title || ""} 
                    onChange={(e) => updateField(["sections", "documents", "title"], e.target.value)}
                    placeholder="서류 업로드"
                  />
                </div>
                <div>
                  <Label>약관 동의 섹션 제목</Label>
                  <Input 
                    value={content.sections?.terms?.title || ""} 
                    onChange={(e) => updateField(["sections", "terms", "title"], e.target.value)}
                    placeholder="약관 동의"
                  />
                </div>
                <div>
                  <Label>본인인증 섹션 제목</Label>
                  <Input 
                    value={content.sections?.verification?.title || ""} 
                    onChange={(e) => updateField(["sections", "verification", "title"], e.target.value)}
                    placeholder="대표자 본인인증"
                  />
                </div>
                <div>
                  <Label>본인인증 버튼 텍스트</Label>
                  <Input 
                    value={content.sections?.verification?.button_text || ""} 
                    onChange={(e) => updateField(["sections", "verification", "button_text"], e.target.value)}
                    placeholder="휴대폰 본인인증 하기"
                  />
                </div>
                <div className="col-span-2">
                  <Label>본인인증 설명</Label>
                  <Input 
                    value={content.sections?.verification?.description || ""} 
                    onChange={(e) => updateField(["sections", "verification", "description"], e.target.value)}
                    placeholder="휴대폰 본인인증을 통해 대표자 정보를 자동으로 입력합니다."
                  />
                </div>
                <div>
                  <Label>전자서명 섹션 제목</Label>
                  <Input 
                    value={content.sections?.signature?.title || ""} 
                    onChange={(e) => updateField(["sections", "signature", "title"], e.target.value)}
                    placeholder="전자 서명"
                  />
                </div>
                <div>
                  <Label>전자서명 설명</Label>
                  <Input 
                    value={content.sections?.signature?.description || ""} 
                    onChange={(e) => updateField(["sections", "signature", "description"], e.target.value)}
                    placeholder="아래 서명란에 본인의 서명을 작성해주세요."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labels" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">입력 필드 라벨</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "member_name", label: "회원명" },
                  { key: "user_id", label: "아이디" },
                  { key: "password", label: "비밀번호" },
                  { key: "password_confirm", label: "비밀번호 확인" },
                  { key: "biz_name", label: "상호명" },
                  { key: "biz_no", label: "사업자번호" },
                  { key: "mail_no", label: "통신판매번호" },
                  { key: "address", label: "사업장 주소" },
                  { key: "ceo_name", label: "대표자명" },
                  { key: "ceo_phone", label: "대표자 연락처" },
                  { key: "email", label: "이메일" },
                  { key: "biz_file", label: "사업자등록증" },
                  { key: "mail_file", label: "통신판매업신고증" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label>{label} 라벨</Label>
                    <Input 
                      value={content.labels?.[key] || ""} 
                      onChange={(e) => updateField(["labels", key], e.target.value)}
                      placeholder={label}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">플레이스홀더 (입력 힌트)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "member_name", placeholder: "한글 6자 이내" },
                  { key: "user_id", placeholder: "사용하실 아이디" },
                  { key: "password", placeholder: "6자 이상" },
                  { key: "password_confirm", placeholder: "비밀번호 확인" },
                  { key: "biz_name", placeholder: "사업자 상호명" },
                  { key: "biz_no", placeholder: "123-45-67890" },
                  { key: "mail_no", placeholder: "제2023-경북-000호" },
                  { key: "address", placeholder: "전체 주소" },
                  { key: "email", placeholder: "example@email.com" },
                ].map(({ key, placeholder }) => (
                  <div key={key}>
                    <Label>{key} 플레이스홀더</Label>
                    <Input 
                      value={content.placeholders?.[key] || ""} 
                      onChange={(e) => updateField(["placeholders", key], e.target.value)}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">알림 메시지</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "success", label: "성공 메시지", placeholder: "관리자 승인 후 이용 가능합니다." },
                  { key: "error", label: "오류 메시지", placeholder: "회원가입 처리 중 오류가 발생했습니다." },
                  { key: "password_match", label: "비밀번호 일치", placeholder: "일치" },
                  { key: "password_mismatch", label: "비밀번호 불일치", placeholder: "불일치" },
                  { key: "password_min_length", label: "비밀번호 최소 길이", placeholder: "6자 이상 입력해주세요" },
                  { key: "signature_required", label: "서명 필수 안내", placeholder: "전자 서명을 해주세요." },
                  { key: "verification_required", label: "본인인증 필수 안내", placeholder: "본인인증을 완료해주세요." },
                  { key: "terms_required", label: "약관 동의 필수 안내", placeholder: "필수 약관에 동의해주세요." },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <Input 
                      value={content.messages?.[key] || ""} 
                      onChange={(e) => updateField(["messages", key], e.target.value)}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">서비스 이용약관</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>제목</Label>
                <Input 
                  value={content.terms_content?.service?.title || ""} 
                  onChange={(e) => updateField(["terms_content", "service", "title"], e.target.value)}
                  placeholder="서비스 이용약관"
                />
              </div>
              <div>
                <Label>내용</Label>
                <Textarea 
                  value={content.terms_content?.service?.content || ""} 
                  onChange={(e) => updateField(["terms_content", "service", "content"], e.target.value)}
                  placeholder="약관 내용..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">개인정보 수집 및 이용 동의</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>제목</Label>
                <Input 
                  value={content.terms_content?.privacy?.title || ""} 
                  onChange={(e) => updateField(["terms_content", "privacy", "title"], e.target.value)}
                  placeholder="개인정보 수집 및 이용 동의"
                />
              </div>
              <div>
                <Label>내용</Label>
                <Textarea 
                  value={content.terms_content?.privacy?.content || ""} 
                  onChange={(e) => updateField(["terms_content", "privacy", "content"], e.target.value)}
                  placeholder="개인정보 수집 내용..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">개인정보 제3자 제공 동의</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>제목</Label>
                <Input 
                  value={content.terms_content?.third_party?.title || ""} 
                  onChange={(e) => updateField(["terms_content", "third_party", "title"], e.target.value)}
                  placeholder="개인정보 제3자 제공 동의"
                />
              </div>
              <div>
                <Label>내용</Label>
                <Textarea 
                  value={content.terms_content?.third_party?.content || ""} 
                  onChange={(e) => updateField(["terms_content", "third_party", "content"], e.target.value)}
                  placeholder="제3자 제공 내용..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
