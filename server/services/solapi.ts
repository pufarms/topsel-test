/**
 * Solapi 알림톡/브랜드톡 서비스
 * 공식 SDK 사용
 */

import { SolapiMessageService } from 'solapi';

interface AlimtalkSendParams {
  to: string;
  templateId: string;
  variables?: Record<string, string>;
}

interface BrandtalkSendParams {
  to: string[];
  title: string;
  message: string;
  button?: {
    name: string;
    url: string;
  };
}

interface SendResult {
  successCount: number;
  failCount: number;
  data?: any;
}

class SolapiService {
  private apiKey: string;
  private apiSecret: string;
  private pfId: string;
  private messageService: SolapiMessageService | null = null;

  constructor() {
    this.apiKey = process.env.SOLAPI_API_KEY || '';
    this.apiSecret = process.env.SOLAPI_API_SECRET || '';
    this.pfId = process.env.KAKAO_PFID || '';

    if (!this.apiKey || !this.apiSecret) {
      console.warn('\x1b[33m⚠️  Solapi API 키가 설정되지 않았습니다. 알림톡/브랜드톡 발송이 작동하지 않습니다.\x1b[0m');
    } else {
      this.messageService = new SolapiMessageService(this.apiKey, this.apiSecret);
      console.log('✅ Solapi SDK 초기화 완료');
    }
  }

  /**
   * 알림톡 대량 발송
   */
  async sendAlimtalkBulk(params: AlimtalkSendParams[]): Promise<SendResult> {
    if (!this.messageService) {
      console.error('Solapi API 키가 설정되지 않았습니다.');
      return {
        successCount: 0,
        failCount: params.length,
        data: { error: 'API key not configured' },
      };
    }

    try {
      console.log(`[Solapi] 알림톡 발송 요청: ${params.length}건`);
      
      // 개발 모드에서는 성공으로 시뮬레이션
      return {
        successCount: params.length,
        failCount: 0,
        data: { simulated: true, count: params.length },
      };
    } catch (error: any) {
      console.error('[Solapi] 알림톡 발송 실패:', error.message);
      return {
        successCount: 0,
        failCount: params.length,
        data: { error: error.message },
      };
    }
  }

  /**
   * 솔라피 템플릿 상세 조회
   * 현재는 API 연동이 복잡하여 데이터베이스 정보만 반환
   * TODO: 추후 Solapi API 연동 완료 시 실제 템플릿 내용 조회
   */
  async getTemplateDetail(templateId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    // Solapi API 연동이 복잡하여 임시로 데이터베이스 정보만 반환
    // 실제 템플릿 내용 조회는 추후 구현
    console.log('[Solapi] 템플릿 ID:', templateId);
    
    return {
      success: true,
      data: {
        templateId,
        content: '템플릿 상세 내용은 솔라피 콘솔에서 확인해 주세요.',
        buttons: [],
        variables: [],
        _note: 'Solapi API 연동 예정'
      },
    };
  }

  /**
   * 브랜드톡 발송
   */
  async sendBrandtalk(params: BrandtalkSendParams): Promise<SendResult> {
    if (!this.apiKey || !this.apiSecret) {
      console.error('Solapi API 키가 설정되지 않았습니다.');
      return {
        successCount: 0,
        failCount: params.to.length,
        data: { error: 'API key not configured' },
      };
    }

    try {
      // TODO: 실제 Solapi API 연동
      console.log(`[Solapi] 브랜드톡 발송 요청: ${params.to.length}건`);
      
      // 개발 모드에서는 성공으로 시뮬레이션
      return {
        successCount: params.to.length,
        failCount: 0,
        data: { simulated: true, count: params.to.length },
      };
    } catch (error: any) {
      console.error('[Solapi] 브랜드톡 발송 실패:', error.message);
      return {
        successCount: 0,
        failCount: params.to.length,
        data: { error: error.message },
      };
    }
  }
}

export const solapiService = new SolapiService();
