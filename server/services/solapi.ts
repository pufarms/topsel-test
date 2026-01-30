/**
 * Solapi 알림톡/브랜드톡 서비스
 * 실제 API 연동 시 SOLAPI_API_KEY, SOLAPI_API_SECRET 환경변수 필요
 */

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

  constructor() {
    this.apiKey = process.env.SOLAPI_API_KEY || '';
    this.apiSecret = process.env.SOLAPI_API_SECRET || '';
    this.pfId = process.env.SOLAPI_PF_ID || '';

    if (!this.apiKey || !this.apiSecret) {
      console.warn('\x1b[33m⚠️  Solapi API 키가 설정되지 않았습니다. 알림톡/브랜드톡 발송이 작동하지 않습니다.\x1b[0m');
    }
  }

  /**
   * 알림톡 대량 발송
   */
  async sendAlimtalkBulk(params: AlimtalkSendParams[]): Promise<SendResult> {
    if (!this.apiKey || !this.apiSecret) {
      console.error('Solapi API 키가 설정되지 않았습니다.');
      return {
        successCount: 0,
        failCount: params.length,
        data: { error: 'API key not configured' },
      };
    }

    try {
      // TODO: 실제 Solapi API 연동
      // const response = await axios.post('https://api.solapi.com/kakao/v2/alimtalk', {
      //   messages: params.map(p => ({
      //     to: p.to,
      //     templateId: p.templateId,
      //     variables: p.variables,
      //   })),
      // }, {
      //   headers: {
      //     'Authorization': `Bearer ${this.getAuthToken()}`,
      //   },
      // });

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
   * API 인증 토큰 생성 (HMAC-SHA256)
   */
  private generateAuthToken(): string {
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString('hex');
    const hmac = crypto.createHmac('sha256', this.apiSecret);
    hmac.update(date + salt);
    const signature = hmac.digest('hex');
    return `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
  }

  /**
   * 솔라피 템플릿 상세 조회
   */
  async getTemplateDetail(templateId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.apiKey || !this.apiSecret) {
      console.error('Solapi API 키가 설정되지 않았습니다.');
      return {
        success: false,
        error: 'API key not configured',
      };
    }

    try {
      const response = await fetch(
        `https://api.solapi.com/kakao/v2/templates/${templateId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': this.generateAuthToken(),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errorMessage || 'Failed to fetch template');
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error('템플릿 조회 실패:', error.message);
      return {
        success: false,
        error: error.message,
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
