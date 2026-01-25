# 사이트 설정 구현 (1단계)

## 📋 개요

탑셀러 B2B 과일 도매 플랫폼의 **사이트 설정** 페이지를 구현해주세요.
현재 "준비중" 상태인 **설정 > 사이트 설정** 페이지를 실제 기능으로 교체합니다.

---

## ⚠️ 매우 중요: 기존 코드 보호

### ❌ 절대 수정하지 마세요!

| 영역 | 상태 |
|------|:----:|
| 상품관리 관련 모든 파일 | 🔒 |
| 재고관리 관련 모든 파일 | 🔒 |
| 회원관리 관련 모든 파일 | 🔒 |
| 이미지 갤러리 관련 모든 파일 | 🔒 |
| 주문관리 (준비중 유지) | 🔒 |
| 정산관리 (준비중 유지) | 🔒 |
| 통계관리 (준비중 유지) | 🔒 |
| 쿠폰관리 (준비중 유지) | 🔒 |
| 페이지관리 (준비중 유지 - 2단계에서 구현) | 🔒 |
| 대시보드 | 🔒 |
| 기존 사이드바 메뉴 구조 | 🔒 |
| 기존 라우팅 구조 | 🔒 |

### ✅ 이번 작업 범위만!

| 작업 | 설명 |
|------|------|
| `site_settings` 테이블 | 새로 생성 |
| `/api/site-settings/*` API | 새로 추가 |
| **설정 > 사이트 설정** 페이지 | 기존 "준비중" → 실제 기능으로 **교체** |
| Header, Footer 컴포넌트 | 새로 생성 (회원용 페이지에서 사용) |
| Layout 컴포넌트 | 새로 생성 (회원용 페이지에서 사용) |

---

## 🗂️ 현재 메뉴 구조 (변경 없음!)

```
탑셀러 관리자
├── 🏠 대시보드
├── 👥 회원관리 ▼
│   ├── 관리자 관리
│   ├── 협력업체 관리
│   └── 회원관리
├── 🛒 주문관리              ← 준비중 유지
├── 📦 상품관리 ▼            ← 건드리지 않음
│   └── ...
├── 📊 재고관리 ▼            ← 건드리지 않음
│   └── ...
├── 📋 정산관리              ← 준비중 유지
├── 📈 통계관리              ← 준비중 유지
├── 🎫 쿠폰관리              ← 준비중 유지
├── 📄 페이지관리            ← 준비중 유지 (2단계에서 구현)
└── ⚙️ 설정 ▼
    ├── 사이트 설정         ← 🎯 이번 작업! (준비중 → 실제 기능)
    └── 이미지 갤러리       ← 건드리지 않음
```

---

## 🎯 목표

1. **사이트 설정 페이지**: 관리자가 헤더/푸터 설정 변경 가능
2. **공통 헤더 컴포넌트**: 로고, 메뉴, 로그인/회원가입 버튼
3. **공통 푸터 컴포넌트**: 회사정보, 링크, 저작권
4. **DB 기반 설정**: 코드 수정 없이 설정 변경 가능

---

## 📊 데이터베이스 스키마

### site_settings 테이블 (새로 생성)

```sql
CREATE TABLE site_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(20) DEFAULT 'string',  -- 'string', 'boolean', 'json', 'number'
  category VARCHAR(50) DEFAULT 'general',      -- 'header', 'footer', 'general'
  description VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_site_settings_key ON site_settings(setting_key);
CREATE INDEX idx_site_settings_category ON site_settings(category);
```

### Drizzle 스키마 (shared/schema.ts에 추가)

```typescript
// ⚠️ 기존 스키마는 건드리지 말고, 맨 아래에 추가만!

export const siteSettings = pgTable('site_settings', {
  id: serial('id').primaryKey(),
  settingKey: varchar('setting_key', { length: 100 }).unique().notNull(),
  settingValue: text('setting_value'),
  settingType: varchar('setting_type', { length: 20 }).default('string'),
  category: varchar('category', { length: 50 }).default('general'),
  description: varchar('description', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 초기 설정 데이터 (시드)

```typescript
const initialSettings = [
  // 헤더 설정
  { settingKey: 'header_logo_url', settingValue: '/logo.png', settingType: 'string', category: 'header', description: '헤더 로고 이미지 URL' },
  { settingKey: 'header_logo_alt', settingValue: '탑셀러', settingType: 'string', category: 'header', description: '로고 대체 텍스트' },
  { settingKey: 'header_show_login', settingValue: 'true', settingType: 'boolean', category: 'header', description: '로그인 버튼 표시 여부' },
  { settingKey: 'header_show_register', settingValue: 'true', settingType: 'boolean', category: 'header', description: '회원가입 버튼 표시 여부' },
  { settingKey: 'header_show_cart', settingValue: 'true', settingType: 'boolean', category: 'header', description: '장바구니 버튼 표시 여부' },
  
  // 푸터 설정
  { settingKey: 'footer_company_name', settingValue: '현 농업회사법인 주식회사', settingType: 'string', category: 'footer', description: '회사명' },
  { settingKey: 'footer_ceo_name', settingValue: '', settingType: 'string', category: 'footer', description: '대표자명' },
  { settingKey: 'footer_biz_number', settingValue: '', settingType: 'string', category: 'footer', description: '사업자등록번호' },
  { settingKey: 'footer_address', settingValue: '', settingType: 'string', category: 'footer', description: '회사 주소' },
  { settingKey: 'footer_phone', settingValue: '', settingType: 'string', category: 'footer', description: '대표 전화번호' },
  { settingKey: 'footer_email', settingValue: '', settingType: 'string', category: 'footer', description: '대표 이메일' },
  { settingKey: 'footer_copyright', settingValue: 'Copyright © 2025 TopSeller. All rights reserved.', settingType: 'string', category: 'footer', description: '저작권 문구' },
  { settingKey: 'footer_show_terms', settingValue: 'true', settingType: 'boolean', category: 'footer', description: '이용약관 링크 표시' },
  { settingKey: 'footer_show_privacy', settingValue: 'true', settingType: 'boolean', category: 'footer', description: '개인정보처리방침 링크 표시' },
  
  // 일반 설정
  { settingKey: 'site_name', settingValue: '탑셀러', settingType: 'string', category: 'general', description: '사이트 이름' },
  { settingKey: 'site_description', settingValue: 'B2B 과일 도매 플랫폼', settingType: 'string', category: 'general', description: '사이트 설명' },
];
```

---

## 🔌 API 엔드포인트 (새로 추가)

### 파일 위치: `server/routes/site-settings.ts` (새 파일)

```
# 설정 조회
GET    /api/site-settings                    # 전체 설정 목록 (관리자용)
GET    /api/site-settings/public             # 공개 설정만 (헤더/푸터용 - 인증 불필요)
GET    /api/site-settings/category/:category # 카테고리별 조회

# 설정 수정 (관리자 전용)
PUT    /api/site-settings/bulk               # 여러 설정 일괄 수정
```

### API 구현

```typescript
// server/routes/site-settings.ts (새 파일 생성)

import { Router } from 'express';
import { db } from '../db';
import { siteSettings } from '../../shared/schema';
import { eq, or } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// 공개 설정 조회 (헤더/푸터용 - 인증 불필요)
router.get('/public', async (req, res) => {
  try {
    const settings = await db.select().from(siteSettings)
      .where(
        or(
          eq(siteSettings.category, 'header'),
          eq(siteSettings.category, 'footer'),
          eq(siteSettings.category, 'general')
        )
      );
    
    // key-value 형태로 변환
    const result = settings.reduce((acc, setting) => {
      let value: any = setting.settingValue;
      if (setting.settingType === 'boolean') {
        value = setting.settingValue === 'true';
      } else if (setting.settingType === 'number') {
        value = Number(setting.settingValue);
      } else if (setting.settingType === 'json') {
        try {
          value = JSON.parse(setting.settingValue || '{}');
        } catch {
          value = {};
        }
      }
      acc[setting.settingKey] = value;
      return acc;
    }, {} as Record<string, any>);
    
    res.json(result);
  } catch (error) {
    console.error('Failed to fetch public settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// 전체 설정 조회 (관리자용)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const settings = await db.select().from(siteSettings).orderBy(siteSettings.category);
    res.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// 카테고리별 조회 (관리자용)
router.get('/category/:category', requireAdmin, async (req, res) => {
  try {
    const settings = await db.select().from(siteSettings)
      .where(eq(siteSettings.category, req.params.category));
    res.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings by category:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// 일괄 수정 (관리자용)
router.put('/bulk', requireAdmin, async (req, res) => {
  try {
    const { settings } = req.body; // { key: value, key2: value2, ... }
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings format' });
    }
    
    for (const [key, value] of Object.entries(settings)) {
      await db.update(siteSettings)
        .set({ 
          settingValue: String(value),
          updatedAt: new Date()
        })
        .where(eq(siteSettings.settingKey, key));
    }
    
    res.json({ success: true, message: '설정이 저장되었습니다.' });
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
```

### 라우터 등록 (server/index.ts 또는 server/routes/index.ts)

```typescript
// ⚠️ 기존 라우터 등록 코드 아래에 추가만!

import siteSettingsRouter from './routes/site-settings';
app.use('/api/site-settings', siteSettingsRouter);
```

---

## 🎨 관리자 페이지: 사이트 설정

### 현재 상태 → 변경 후

**현재 (준비중)**
```
┌──────────────────────────────────────────────────────────────────┐
│ 사이트 설정                                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🚧 준비중                                                        │
│  사이트 기본 설정을 관리합니다                                     │
│  이 기능은 곧 제공될 예정입니다.                                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**변경 후 (실제 기능)**
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 사이트 설정                                                                       │
│ 사이트의 기본 정보와 헤더/푸터를 설정합니다.                                        │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ [일반 설정] [헤더 설정] [푸터 설정]                          ← 탭 메뉴             │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ ■ 일반 설정 탭 (기본 선택)                                                        │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ 사이트 기본 정보                                                              │ │
│ │                                                                              │ │
│ │ 사이트 이름          [탑셀러_________________________]                        │ │
│ │ 사이트 설명          [B2B 과일 도매 플랫폼____________]                        │ │
│ │                                                                              │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│ ■ 헤더 설정 탭                                                                    │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ 로고 설정                                                                    │ │
│ │                                                                              │ │
│ │ 로고 이미지 URL      [/logo.png___________________]                          │ │
│ │                      💡 이미지 갤러리에서 업로드 후 URL 입력                   │ │
│ │                      💡 권장 크기: 가로 200px 이하, 세로 40px                 │ │
│ │                                                                              │ │
│ │ 로고 대체 텍스트     [탑셀러_______________________]                          │ │
│ │                                                                              │ │
│ │ ─────────────────────────────────────────────────────────────────────────── │ │
│ │                                                                              │ │
│ │ 버튼 표시 설정                                                               │ │
│ │                                                                              │ │
│ │ 로그인 버튼 표시                                                    [ON/OFF] │ │
│ │ 회원가입 버튼 표시                                                  [ON/OFF] │ │
│ │ 장바구니 버튼 표시 (로그인 시)                                       [ON/OFF] │ │
│ │                                                                              │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│ ■ 푸터 설정 탭                                                                    │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ 회사 정보                                                                    │ │
│ │                                                                              │ │
│ │ 회사명        [현 농업회사법인 주식회사_______]  대표자     [_______________] │ │
│ │ 사업자등록번호 [___-__-_____________________]  전화번호    [_______________] │ │
│ │ 주소          [____________________________________________________________] │ │
│ │ 이메일        [____________________________________________________________] │ │
│ │                                                                              │ │
│ │ ─────────────────────────────────────────────────────────────────────────── │ │
│ │                                                                              │ │
│ │ 링크 표시 설정                                                               │ │
│ │                                                                              │ │
│ │ 이용약관 링크 표시                                                  [ON/OFF] │ │
│ │ 개인정보처리방침 링크 표시                                          [ON/OFF] │ │
│ │                                                                              │ │
│ │ ─────────────────────────────────────────────────────────────────────────── │ │
│ │                                                                              │ │
│ │ 저작권 문구                                                                  │ │
│ │                                                                              │ │
│ │ [Copyright © 2025 TopSeller. All rights reserved.________________________] │ │
│ │                                                                              │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│                                                           [취소]  [저장]         │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 관리자 컴포넌트 구현

**파일 위치**: 기존 사이트 설정 페이지 파일을 찾아서 교체
(예: `client/src/pages/admin/SiteSettingsPage.tsx` 또는 유사한 경로)

```typescript
// client/src/pages/admin/SiteSettingsPage.tsx
// ⚠️ 기존 "준비중" 컴포넌트를 이 내용으로 교체!

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function SiteSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // 설정 조회
  const { data: settings, isLoading } = useQuery({
    queryKey: ['site-settings', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/site-settings', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });
  
  // 로컬 상태
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  useEffect(() => {
    if (settings) {
      const data = settings.reduce((acc: any, s: any) => {
        acc[s.settingKey] = s.settingType === 'boolean' 
          ? s.settingValue === 'true' 
          : s.settingValue;
        return acc;
      }, {});
      setFormData(data);
    }
  }, [settings]);
  
  // 저장
  const mutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch('/api/site-settings/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ settings: data }),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '저장 완료', description: '설정이 저장되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    },
    onError: () => {
      toast({ title: '저장 실패', description: '설정 저장에 실패했습니다.', variant: 'destructive' });
    },
  });
  
  const handleSave = () => {
    mutation.mutate(formData);
  };
  
  const updateField = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-4xl">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">사이트 설정</h1>
        <p className="text-gray-500 text-sm mt-1">사이트의 기본 정보와 헤더/푸터를 설정합니다.</p>
      </div>
      
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">일반 설정</TabsTrigger>
          <TabsTrigger value="header">헤더 설정</TabsTrigger>
          <TabsTrigger value="footer">푸터 설정</TabsTrigger>
        </TabsList>
        
        {/* 일반 설정 */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>사이트 기본 정보</CardTitle>
              <CardDescription>사이트의 이름과 설명을 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="site_name">사이트 이름</Label>
                <Input 
                  id="site_name"
                  value={formData.site_name || ''} 
                  onChange={e => updateField('site_name', e.target.value)}
                  placeholder="탑셀러"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site_description">사이트 설명</Label>
                <Input 
                  id="site_description"
                  value={formData.site_description || ''} 
                  onChange={e => updateField('site_description', e.target.value)}
                  placeholder="B2B 과일 도매 플랫폼"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* 헤더 설정 */}
        <TabsContent value="header" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>로고 설정</CardTitle>
              <CardDescription>헤더에 표시될 로고를 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="header_logo_url">로고 이미지 URL</Label>
                <Input 
                  id="header_logo_url"
                  value={formData.header_logo_url || ''} 
                  onChange={e => updateField('header_logo_url', e.target.value)}
                  placeholder="/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  💡 이미지 갤러리에서 업로드 후 URL을 입력하세요. 권장 크기: 가로 200px 이하, 세로 40px
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="header_logo_alt">로고 대체 텍스트</Label>
                <Input 
                  id="header_logo_alt"
                  value={formData.header_logo_alt || ''} 
                  onChange={e => updateField('header_logo_alt', e.target.value)}
                  placeholder="탑셀러"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>버튼 표시 설정</CardTitle>
              <CardDescription>헤더에 표시될 버튼을 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>로그인 버튼 표시</Label>
                  <p className="text-xs text-muted-foreground">비로그인 상태에서 로그인 버튼을 표시합니다.</p>
                </div>
                <Switch 
                  checked={formData.header_show_login || false}
                  onCheckedChange={v => updateField('header_show_login', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>회원가입 버튼 표시</Label>
                  <p className="text-xs text-muted-foreground">비로그인 상태에서 회원가입 버튼을 표시합니다.</p>
                </div>
                <Switch 
                  checked={formData.header_show_register || false}
                  onCheckedChange={v => updateField('header_show_register', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>장바구니 버튼 표시</Label>
                  <p className="text-xs text-muted-foreground">로그인 상태에서 장바구니 버튼을 표시합니다.</p>
                </div>
                <Switch 
                  checked={formData.header_show_cart || false}
                  onCheckedChange={v => updateField('header_show_cart', v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* 푸터 설정 */}
        <TabsContent value="footer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>회사 정보</CardTitle>
              <CardDescription>푸터에 표시될 회사 정보를 입력합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="footer_company_name">회사명</Label>
                  <Input 
                    id="footer_company_name"
                    value={formData.footer_company_name || ''} 
                    onChange={e => updateField('footer_company_name', e.target.value)}
                    placeholder="주식회사 OOO"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="footer_ceo_name">대표자</Label>
                  <Input 
                    id="footer_ceo_name"
                    value={formData.footer_ceo_name || ''} 
                    onChange={e => updateField('footer_ceo_name', e.target.value)}
                    placeholder="홍길동"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="footer_biz_number">사업자등록번호</Label>
                  <Input 
                    id="footer_biz_number"
                    value={formData.footer_biz_number || ''} 
                    onChange={e => updateField('footer_biz_number', e.target.value)}
                    placeholder="000-00-00000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="footer_phone">전화번호</Label>
                  <Input 
                    id="footer_phone"
                    value={formData.footer_phone || ''} 
                    onChange={e => updateField('footer_phone', e.target.value)}
                    placeholder="02-0000-0000"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="footer_address">주소</Label>
                  <Input 
                    id="footer_address"
                    value={formData.footer_address || ''} 
                    onChange={e => updateField('footer_address', e.target.value)}
                    placeholder="서울특별시 OO구 OO로 123"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="footer_email">이메일</Label>
                  <Input 
                    id="footer_email"
                    value={formData.footer_email || ''} 
                    onChange={e => updateField('footer_email', e.target.value)}
                    placeholder="info@example.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>링크 표시 설정</CardTitle>
              <CardDescription>푸터에 표시될 링크를 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>이용약관 링크 표시</Label>
                  <p className="text-xs text-muted-foreground">푸터에 이용약관 링크를 표시합니다.</p>
                </div>
                <Switch 
                  checked={formData.footer_show_terms || false}
                  onCheckedChange={v => updateField('footer_show_terms', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>개인정보처리방침 링크 표시</Label>
                  <p className="text-xs text-muted-foreground">푸터에 개인정보처리방침 링크를 표시합니다.</p>
                </div>
                <Switch 
                  checked={formData.footer_show_privacy || false}
                  onCheckedChange={v => updateField('footer_show_privacy', v)}
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>저작권 문구</CardTitle>
              <CardDescription>푸터 하단에 표시될 저작권 문구를 입력합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <Input 
                value={formData.footer_copyright || ''} 
                onChange={e => updateField('footer_copyright', e.target.value)}
                placeholder="Copyright © 2025 TopSeller. All rights reserved."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* 저장 버튼 */}
      <div className="flex justify-end gap-4 mt-6">
        <Button variant="outline" onClick={() => window.location.reload()}>
          취소
        </Button>
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            '저장'
          )}
        </Button>
      </div>
    </div>
  );
}
```

---

## 🎨 회원용 공통 컴포넌트 (새로 생성)

### 1) 설정 조회 Hook

**파일 위치**: `client/src/hooks/useSiteSettings.ts` (새 파일)

```typescript
// client/src/hooks/useSiteSettings.ts

import { useQuery } from '@tanstack/react-query';

export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings', 'public'],
    queryFn: async () => {
      const res = await fetch('/api/site-settings/public');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5분 캐시
  });
}
```

### 2) 헤더 컴포넌트

**파일 위치**: `client/src/components/layout/PublicHeader.tsx` (새 파일)

```typescript
// client/src/components/layout/PublicHeader.tsx

import { Link, useLocation } from 'wouter';
import { useState } from 'react';
import { Menu, X, ShoppingCart, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface PublicHeaderProps {
  user?: any; // 로그인된 사용자 정보
  onLogout?: () => void;
}

export function PublicHeader({ user, onLogout }: PublicHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location] = useLocation();
  const { data: settings } = useSiteSettings();
  
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* 로고 */}
          <Link href="/" className="flex items-center">
            {settings?.header_logo_url ? (
              <img 
                src={settings.header_logo_url} 
                alt={settings.header_logo_alt || '로고'} 
                className="h-8 w-auto"
              />
            ) : (
              <span className="text-xl font-bold text-green-600">
                {settings?.site_name || '탑셀러'}
              </span>
            )}
          </Link>
          
          {/* 데스크톱 메뉴 */}
          <nav className="hidden md:flex items-center space-x-8">
            {/* TODO: 2단계 페이지 관리에서 동적 메뉴 생성 */}
            <Link href="/products" className={`text-sm font-medium transition-colors ${location === '/products' ? 'text-green-600' : 'text-gray-700 hover:text-green-600'}`}>
              상품목록
            </Link>
            <Link href="/notice" className={`text-sm font-medium transition-colors ${location === '/notice' ? 'text-green-600' : 'text-gray-700 hover:text-green-600'}`}>
              공지사항
            </Link>
            <Link href="/guide" className={`text-sm font-medium transition-colors ${location === '/guide' ? 'text-green-600' : 'text-gray-700 hover:text-green-600'}`}>
              이용안내
            </Link>
          </nav>
          
          {/* 우측 버튼 영역 */}
          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <>
                {/* 로그인 상태 */}
                {settings?.header_show_cart && (
                  <Link href="/cart">
                    <Button variant="ghost" size="icon">
                      <ShoppingCart className="h-5 w-5" />
                    </Button>
                  </Link>
                )}
                <Link href="/mypage">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden lg:inline">{user.name || '마이페이지'}</span>
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={onLogout}>
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                {/* 비로그인 상태 */}
                {settings?.header_show_login && (
                  <Link href="/login">
                    <Button variant="ghost" size="sm">로그인</Button>
                  </Link>
                )}
                {settings?.header_show_register && (
                  <Link href="/register">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      회원가입
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
          
          {/* 모바일 메뉴 버튼 */}
          <button 
            className="md:hidden p-2 rounded-md hover:bg-gray-100"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="메뉴 열기"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        
        {/* 모바일 메뉴 */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-3">
              <Link href="/products" className="text-sm font-medium text-gray-700 py-2">상품목록</Link>
              <Link href="/notice" className="text-sm font-medium text-gray-700 py-2">공지사항</Link>
              <Link href="/guide" className="text-sm font-medium text-gray-700 py-2">이용안내</Link>
              <hr className="my-2" />
              {user ? (
                <>
                  <Link href="/mypage" className="text-sm font-medium text-gray-700 py-2">마이페이지</Link>
                  <Link href="/cart" className="text-sm font-medium text-gray-700 py-2">장바구니</Link>
                  <button onClick={onLogout} className="text-sm font-medium text-gray-700 py-2 text-left">로그아웃</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-medium text-gray-700 py-2">로그인</Link>
                  <Link href="/register" className="text-sm font-medium text-green-600 py-2">회원가입</Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
```

### 3) 푸터 컴포넌트

**파일 위치**: `client/src/components/layout/PublicFooter.tsx` (새 파일)

```typescript
// client/src/components/layout/PublicFooter.tsx

import { Link } from 'wouter';
import { useSiteSettings } from '@/hooks/useSiteSettings';

export function PublicFooter() {
  const { data: settings } = useSiteSettings();
  
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* 상단: 링크 */}
        <div className="flex flex-wrap gap-4 sm:gap-6 mb-8 text-sm">
          {settings?.footer_show_terms && (
            <Link href="/terms" className="hover:text-white transition-colors">
              이용약관
            </Link>
          )}
          {settings?.footer_show_privacy && (
            <Link href="/privacy" className="hover:text-white font-semibold transition-colors">
              개인정보처리방침
            </Link>
          )}
          <Link href="/support" className="hover:text-white transition-colors">
            고객센터
          </Link>
        </div>
        
        {/* 중단: 회사 정보 */}
        <div className="text-sm space-y-2 mb-8 text-gray-400">
          {settings?.footer_company_name && (
            <p>
              <span className="font-semibold text-gray-300">{settings.footer_company_name}</span>
              {settings?.footer_ceo_name && (
                <span className="ml-3">대표: {settings.footer_ceo_name}</span>
              )}
            </p>
          )}
          {settings?.footer_biz_number && (
            <p>사업자등록번호: {settings.footer_biz_number}</p>
          )}
          {settings?.footer_address && (
            <p>주소: {settings.footer_address}</p>
          )}
          {(settings?.footer_phone || settings?.footer_email) && (
            <p>
              {settings?.footer_phone && <span>전화: {settings.footer_phone}</span>}
              {settings?.footer_phone && settings?.footer_email && <span className="mx-2">|</span>}
              {settings?.footer_email && <span>이메일: {settings.footer_email}</span>}
            </p>
          )}
        </div>
        
        {/* 하단: 저작권 */}
        <div className="border-t border-gray-700 pt-8 text-sm text-gray-500">
          {settings?.footer_copyright || 'Copyright © 2025 TopSeller. All rights reserved.'}
        </div>
      </div>
    </footer>
  );
}
```

### 4) 레이아웃 컴포넌트

**파일 위치**: `client/src/components/layout/PublicLayout.tsx` (새 파일)

```typescript
// client/src/components/layout/PublicLayout.tsx

import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';

interface PublicLayoutProps {
  children: React.ReactNode;
  user?: any;
  onLogout?: () => void;
}

export function PublicLayout({ children, user, onLogout }: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PublicHeader user={user} onLogout={onLogout} />
      <main className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
```

---

## ✅ 체크리스트

### DB / 백엔드
- [ ] `site_settings` 테이블 생성 (마이그레이션)
- [ ] Drizzle 스키마에 `siteSettings` 추가 (기존 스키마 맨 아래에!)
- [ ] 초기 설정 데이터 시드
- [ ] `server/routes/site-settings.ts` 새 파일 생성
- [ ] 라우터 등록 (`/api/site-settings`)

### 프론트엔드 - 관리자
- [ ] 기존 "준비중" 사이트 설정 페이지 → 실제 기능으로 교체
- [ ] 일반 설정 탭 (사이트 이름, 설명)
- [ ] 헤더 설정 탭 (로고, 버튼 표시)
- [ ] 푸터 설정 탭 (회사 정보, 링크, 저작권)
- [ ] 저장 기능

### 프론트엔드 - 회원용 공통 컴포넌트
- [ ] `useSiteSettings` 훅 (새 파일)
- [ ] `PublicHeader` 컴포넌트 (새 파일)
- [ ] `PublicFooter` 컴포넌트 (새 파일)
- [ ] `PublicLayout` 컴포넌트 (새 파일)

### 반응형
- [ ] 헤더 모바일 메뉴 (햄버거)
- [ ] 푸터 모바일 레이아웃

---

## ⚠️ 주의사항

| 항목 | 설명 |
|------|------|
| **기존 코드 보호** | 상품관리, 재고관리, 회원관리, 이미지 갤러리 등 절대 수정 금지! |
| **추가만** | 새 테이블, 새 API, 새 컴포넌트만 추가 |
| **교체 대상** | "준비중" 상태인 사이트 설정 페이지만 교체 |
| **캐싱** | 공개 설정은 5분 캐시 (staleTime) |
| **권한** | 설정 수정은 관리자만 가능 (requireAdmin) |
| **로고 이미지** | 이미지 갤러리에서 업로드 후 URL 입력 |
| **메뉴** | 2단계 페이지 관리에서 동적으로 생성 예정 |

---

## 📝 다음 단계

이 작업 완료 후:
1. **2단계: 페이지 관리** 시스템 구현
2. **3단계: 메인페이지** 구현
3. **4단계: 회원가입 페이지** 구현 (약관+본인인증+서명)
