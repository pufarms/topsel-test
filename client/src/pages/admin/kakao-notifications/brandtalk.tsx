import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Users, Info } from 'lucide-react';

export default function BrandtalkPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            친구톡 관리
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                친구톡 발송은 카카오 비즈니스채널에서 직접 관리합니다.
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                회원가입 시 카카오톡 채널 친구추가로 수집된 친구들에게 메시지를 발송하려면 아래 버튼을 클릭하여 카카오 비즈니스채널 관리 페이지에서 직접 발송해 주세요.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              className="flex-1"
              onClick={() => window.open('https://business.kakao.com', '_blank')}
              data-testid="btn-kakao-business"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              카카오 비즈니스채널 바로가기
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">친구톡이란?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>카카오톡 채널을 친구 추가한 사용자에게 발송하는 메시지입니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>회원가입 시 친구추가를 통해 수집된 친구들에게 프로모션, 이벤트, 할인 정보 등을 발송할 수 있습니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>친구톡은 친구 추가된 사용자에게만 발송되므로 수신율이 높습니다.</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
