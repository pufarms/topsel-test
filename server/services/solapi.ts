/**
 * Solapi 알림톡/브랜드톡 서비스
 * 공식 SDK 사용
 */

import { SolapiMessageService } from 'solapi';
import axios from 'axios';
import crypto from 'crypto';

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
  private baseUrl: string = 'https://api.solapi.com';
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
   * API 인증 토큰 생성
   */
  private generateAuthToken(): string {
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(32).toString('hex');
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(date + salt)
      .digest('hex');
    return `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
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
   */
  async getTemplateDetail(templateId: string): Promise<any> {
    try {
      const encodedTemplateId = encodeURIComponent(templateId);
      const url = `${this.baseUrl}/kakao/v2/templates/${encodedTemplateId}`;
      const authToken = this.generateAuthToken();
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('Solapi API response:', response.data);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Solapi API error:', error.response?.data);
      return {
        success: false,
        error: {
          status: error.response?.status || 500,
          message: error.response?.data?.message || error.message,
          code: error.response?.data?.errorCode || 'UNKNOWN_ERROR'
        }
      };
    }
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
