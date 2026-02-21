import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Sparkles, Apple, MapPin, Award, Package, Droplets, Thermometer, Clock, Users, Star, ShieldCheck, Truck, DollarSign, FileText, Camera } from "lucide-react";
import type { ProductInfo } from "../types";
import ImageUploader from "./ImageUploader";
import { fileToBase64 } from "../services/geminiService";

interface ProductInfoFormProps {
  onSubmit: (product: ProductInfo) => void;
  onBack: () => void;
}

const fruitCategories = [
  "사과", "배", "감귤/귤", "오렌지", "딸기", "포도", "수박", "참외",
  "복숭아", "자두", "체리", "블루베리", "키위", "망고", "바나나",
  "레몬", "라임", "자몽", "아보카도", "파인애플", "멜론", "기타",
];

const gradeOptions = ["특", "상", "중", "보통", "혼합"];

const storageOptions = ["냉장보관", "냉동보관", "상온보관", "서늘한 곳 보관"];

export default function ProductInfoForm({ onSubmit, onBack }: ProductInfoFormProps) {
  const [form, setForm] = useState<ProductInfo>({
    productName: "",
    origin: "",
    variety: "",
    grade: "",
    weight: "",
    packUnit: "",
    sweetness: "",
    storageMethod: "",
    shelfLife: "",
    targetCustomer: "",
    sellingPoints: "",
    certifications: "",
    deliveryInfo: "",
    priceRange: "",
    additionalNotes: "",
    imageFile: null,
    imageBase64: "",
  });
  const [imagePreview, setImagePreview] = useState("");

  const update = (key: keyof ProductInfo, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageSelect = async (file: File | null) => {
    if (!file) {
      setForm((prev) => ({ ...prev, imageFile: null, imageBase64: "" }));
      setImagePreview("");
      return;
    }
    setForm((prev) => ({ ...prev, imageFile: file }));
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    try {
      const base64 = await fileToBase64(file);
      setForm((prev) => ({ ...prev, imageBase64: base64 }));
    } catch (err) {
      console.error("이미지 변환 실패:", err);
    }
  };

  const isValid = form.productName.trim() && form.origin.trim() && form.sellingPoints.trim() && form.imageBase64;

  const handleSubmit = () => {
    if (isValid) onSubmit(form);
  };

  const fieldGroups = [
    {
      title: "기본 정보",
      icon: <Apple className="h-5 w-5 text-red-500" />,
      fields: [
        { key: "productName" as const, label: "상품명", icon: <Apple className="h-4 w-4" />, placeholder: "예: 경북 영주 부사 사과 5kg", required: true, type: "input" },
        { key: "origin" as const, label: "원산지/산지", icon: <MapPin className="h-4 w-4" />, placeholder: "예: 경북 영주시", required: true, type: "input" },
        { key: "variety" as const, label: "품종", icon: <Star className="h-4 w-4" />, placeholder: "예: 부사, 홍로, 감홍", type: "input" },
        { key: "grade" as const, label: "등급", icon: <Award className="h-4 w-4" />, type: "select", options: gradeOptions },
      ],
    },
    {
      title: "규격 정보",
      icon: <Package className="h-5 w-5 text-blue-500" />,
      fields: [
        { key: "weight" as const, label: "중량/규격", icon: <Package className="h-4 w-4" />, placeholder: "예: 5kg (14~16과)", type: "input" },
        { key: "packUnit" as const, label: "포장단위", icon: <Package className="h-4 w-4" />, placeholder: "예: 박스, 트레이, 봉지", type: "input" },
        { key: "sweetness" as const, label: "당도", icon: <Droplets className="h-4 w-4" />, placeholder: "예: 14~16 Brix", type: "input" },
      ],
    },
    {
      title: "보관/유통",
      icon: <Thermometer className="h-5 w-5 text-cyan-500" />,
      fields: [
        { key: "storageMethod" as const, label: "보관방법", icon: <Thermometer className="h-4 w-4" />, type: "select", options: storageOptions },
        { key: "shelfLife" as const, label: "유통기한", icon: <Clock className="h-4 w-4" />, placeholder: "예: 수령 후 5~7일", type: "input" },
        { key: "deliveryInfo" as const, label: "배송 정보", icon: <Truck className="h-4 w-4" />, placeholder: "예: 산지직송, 주문 후 2~3일 내 출고", type: "input" },
      ],
    },
    {
      title: "마케팅 포인트",
      icon: <Sparkles className="h-5 w-5 text-amber-500" />,
      fields: [
        { key: "targetCustomer" as const, label: "타깃 고객", icon: <Users className="h-4 w-4" />, placeholder: "예: 소매업체, 식당, 급식업체", type: "input" },
        { key: "sellingPoints" as const, label: "핵심 셀링포인트", icon: <Star className="h-4 w-4" />, placeholder: "예: GAP인증, 당도 보장, 40년 과수원 직접 재배", required: true, type: "textarea" },
        { key: "certifications" as const, label: "인증/수상", icon: <ShieldCheck className="h-4 w-4" />, placeholder: "예: GAP, 친환경, 로컬푸드 인증", type: "input" },
        { key: "priceRange" as const, label: "가격대", icon: <DollarSign className="h-4 w-4" />, placeholder: "예: 35,000원~45,000원", type: "input" },
        { key: "additionalNotes" as const, label: "추가 참고사항", icon: <FileText className="h-4 w-4" />, placeholder: "AI가 참고할 추가 정보를 자유롭게 입력하세요", type: "textarea" },
      ],
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">제품 정보 입력</h2>
        <p className="text-muted-foreground">AI가 최적의 마케팅 카피를 생성할 수 있도록 제품 정보를 입력해주세요</p>
        <p className="text-xs text-muted-foreground mt-1">* 표시는 필수 항목입니다</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-5 w-5 text-purple-500" />
            제품 이미지
            <span className="text-destructive text-sm">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUploader
            onImageSelect={handleImageSelect}
            selectedFile={form.imageFile}
            previewUrl={imagePreview}
          />
          <p className="text-xs text-muted-foreground mt-2">
            AI가 이 이미지를 기반으로 각 섹션별 배경을 합성합니다
          </p>
        </CardContent>
      </Card>

      {fieldGroups.map((group) => (
        <Card key={group.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {group.icon}
              {group.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.fields.map((field) => (
                <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                  <Label className="text-sm flex items-center gap-1.5 mb-1.5">
                    {field.icon}
                    {field.label}
                    {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  {field.type === "select" ? (
                    <Select value={form[field.key] as string} onValueChange={(v) => update(field.key, v)}>
                      <SelectTrigger data-testid={`select-${field.key}`}>
                        <SelectValue placeholder="선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === "textarea" ? (
                    <Textarea
                      value={form[field.key] as string}
                      onChange={(e) => update(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      data-testid={`textarea-${field.key}`}
                    />
                  ) : (
                    <Input
                      value={form[field.key] as string}
                      onChange={(e) => update(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      data-testid={`input-${field.key}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="flex-1" data-testid="btn-back-to-apikey">
          <ArrowLeft className="h-4 w-4 mr-2" />
          이전
        </Button>
        <Button onClick={handleSubmit} disabled={!isValid} className="flex-1" data-testid="btn-generate">
          <Sparkles className="h-4 w-4 mr-2" />
          AI 생성 시작
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
