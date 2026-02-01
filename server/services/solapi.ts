/**
 * Solapi 알림톡/브랜드톡 서비스
 * 공식 SDK 사용
 */

import { SolapiMessageService } from 'solapi';
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
  private sender: string;
  private baseUrl: string = 'https://api.solapi.com';
  private messageService: SolapiMessageService | null = null;

  constructor() {
    this.apiKey = process.env.SOLAPI_API_KEY || '';
    this.apiSecret = process.env.SOLAPI_API_SECRET || '';
    this.pfId = process.env.KAKAO_PFID || '';
    this.sender = process.env.SOLAPI_SENDER || '';

    if (!this.apiKey || !this.apiSecret) {
      console.warn('\x1b[33m⚠️  Solapi API 키가 설정되지 않았습니다. 알림톡/브랜드톡 발송이 작동하지 않습니다.\x1b[0m');
    } else {
      this.messageService = new SolapiMessageService(this.apiKey, this.apiSecret);
      console.log('✅ Solapi SDK 초기화 완료');
    }
  }

  /**
   * HMAC-SHA256 인증 헤더 생성 (Solapi 공식 형식)
   */
  private generateAuthHeader(): string {
    const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const salt = crypto.randomBytes(32).toString('hex');
    const hmacData = date + salt;
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(hmacData)
      .digest('hex');
    return `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
  }

  /**
   * 알림톡 단일 발송 (공통 유틸리티 함수)
   * @param templateId - 솔라피 템플릿 ID (예: KA01TP...)
   * @param receiverPhone - 수신자 전화번호 (하이픈 포함/미포함 모두 가능)
   * @param variables - 템플릿 변수 (예: { 이름: '홍길동', 주문번호: 'ORD001' })
   * @returns SendResult - 발송 결과
   * 
   * @example
   * // 주문관리 등에서 호출 예시
   * const result = await solapiService.sendAlimTalk(
   *   'KA01TP250401064812535rjuhD934ZTC',
   *   '010-1234-5678',
   *   { 이름: '홍길동', 주문번호: 'ORD-2024-001' }
   * );
   */
  async sendAlimTalk(
    templateId: string,
    receiverPhone: string,
    variables?: Record<string, string>
  ): Promise<SendResult> {
    return this.sendAlimtalkBulk([{
      to: receiverPhone,
      templateId,
      variables: variables || {},
    }]);
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

    if (!this.pfId) {
      console.error('KAKAO_PFID가 설정되지 않았습니다.');
      return {
        successCount: 0,
        failCount: params.length,
        data: { error: 'KAKAO_PFID not configured' },
      };
    }

    if (!this.sender) {
      console.error('SOLAPI_SENDER가 설정되지 않았습니다.');
      return {
        successCount: 0,
        failCount: params.length,
        data: { error: 'SOLAPI_SENDER not configured' },
      };
    }

    try {
      console.log(`[Solapi] 알림톡 발송 요청: ${params.length}건`);
      console.log(`[Solapi] 발신번호: ${this.sender}, PFID: ${this.pfId}`);
      
      // Solapi SDK를 통한 실제 발송
      const messages = params.map(p => ({
        to: p.to.replace(/-/g, ''),
        from: this.sender.replace(/-/g, ''),
        kakaoOptions: {
          pfId: this.pfId,
          templateId: p.templateId,
          variables: p.variables || {},
        },
      }));

      console.log('[Solapi] 발송 메시지:', JSON.stringify(messages, null, 2));

      const result = await this.messageService.send(messages);
      
      console.log('[Solapi] 발송 결과:', JSON.stringify(result, null, 2));

      // 결과 분석 (타입 안전하게 처리)
      const count = result.groupInfo?.count as any;
      
      // Solapi 응답 필드:
      // - registeredSuccess: 메시지가 큐에 성공적으로 등록됨 (비동기 발송 전)
      // - registeredFailed: 등록 실패 (잘못된 형식, API 오류 등)
      // - sentSuccess: 실제 발송 완료 (비동기, 즉시 반환 시 0일 수 있음)
      // - sentFailed: 발송 실패 (비동기)
      let successCount = 0;
      let failCount = params.length;
      
      if (count) {
        // registeredSuccess가 성공 지표 (메시지가 큐에 등록됨 = 발송 예정)
        // sentSuccess는 비동기로 업데이트되므로 즉시 반환 시 0일 수 있음
        successCount = count.registeredSuccess || count.sentSuccess || count.success || 0;
        failCount = count.registeredFailed || count.sentFailed || count.failed || 0;
        
        console.log(`[Solapi] 등록성공: ${count.registeredSuccess || 0}, 등록실패: ${count.registeredFailed || 0}, 발송완료: ${count.sentSuccess || 0}`);
      } else {
        // count가 없으면 전체 결과를 확인
        console.warn('[Solapi] count 정보 없음, 응답 전체 확인 필요');
        // failedMessageList가 비어있으면 성공으로 간주
        if (!result.failedMessageList || result.failedMessageList.length === 0) {
          successCount = params.length;
          failCount = 0;
        }
      }

      return {
        successCount,
        failCount,
        data: result,
      };
    } catch (error: any) {
      console.error('[Solapi] 알림톡 발송 실패:', error.message);
      console.error('[Solapi] 오류 상세:', error);
      return {
        successCount: 0,
        failCount: params.length,
        data: { error: error.message },
      };
    }
  }

  /**
   * 솔라피 템플릿 상세 조회 (REST API 직접 호출)
   */
  async getTemplateDetail(templateId: string) {
    try {
      console.log('🔍 [Solapi] 템플릿 상세 조회 시작:', templateId);

      // URL 인코딩
      const encodedId = encodeURIComponent(templateId);
      const url = `https://api.solapi.com/kakao/v2/templates/${encodedId}`;

      // HMAC 인증 헤더 생성 (수정됨)
      const date = new Date().toISOString();
      const salt = crypto.randomBytes(16).toString('hex');
      
      // 서명 생성: date와 salt를 공백 없이 연결
      const hmacData = date + salt;
      const signature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(hmacData)
        .digest('hex');

      const authHeader = `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

      console.log('🚀 [Solapi] REST API 호출:', url);
      console.log('🔑 [Solapi] 인증 정보:', {
        apiKey: this.apiKey,
        date,
        saltLength: salt.length,
        signatureLength: signature.length
      });

      // REST API 호출
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 [Solapi] 응답 상태:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Solapi] API 오류:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });

        return {
          success: false,
          error: {
            status: response.status,
            message: response.statusText,
            details: errorText
          }
        };
      }

      const responseData = await response.json();
      console.log('✅ [Solapi] 템플릿 조회 성공:', responseData.name);

      return {
        success: true,
        data: responseData
      };

    } catch (error: any) {
      console.error('❌ [Solapi] getTemplateDetail 예외:', error);
      return {
        success: false,
        error: {
          status: 500,
          message: error.message || '템플릿 조회 중 오류 발생',
          details: error.stack
        }
      };
    }
  }

  /**
   * 브랜드 템플릿 목록 조회
   */
  async getBrandTemplates() {
    try {
      console.log('🔍 [Solapi] 브랜드 템플릿 목록 조회 시작');
      
      const url = 'https://api.solapi.com/kakao/v2/brand-templates';
      
      const date = new Date().toISOString();
      const salt = crypto.randomBytes(16).toString('hex');
      const hmacData = date + salt;
      const signature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(hmacData)
        .digest('hex');

      const authHeader = `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

      console.log('🚀 [Solapi] API 호출:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 [Solapi] 응답 상태:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Solapi] API 오류:', errorText);
        return {
          success: false,
          error: {
            status: response.status,
            message: errorText
          }
        };
      }

      const result = await response.json();
      console.log('✅ [Solapi] 브랜드 템플릿 조회 성공:', result.data?.length || 0, '개');

      return {
        success: true,
        data: result.data || []
      };

    } catch (error: any) {
      console.error('❌ [Solapi] getBrandTemplates 예외:', error);
      return {
        success: false,
        error: {
          status: 500,
          message: error.message
        }
      };
    }
  }

  /**
   * 브랜드 템플릿 상세 조회
   */
  async getBrandTemplateDetail(templateId: string) {
    try {
      console.log('🔍 [Solapi] 브랜드 템플릿 상세 조회:', templateId);
      
      const encodedId = encodeURIComponent(templateId);
      const url = `https://api.solapi.com/kakao/v2/brand-templates/${encodedId}`;
      
      const date = new Date().toISOString();
      const salt = crypto.randomBytes(16).toString('hex');
      const hmacData = date + salt;
      const signature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(hmacData)
        .digest('hex');

      const authHeader = `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: {
            status: response.status,
            message: errorText
          }
        };
      }

      const responseData = await response.json();
      return {
        success: true,
        data: responseData
      };

    } catch (error: any) {
      return {
        success: false,
        error: {
          status: 500,
          message: error.message
        }
      };
    }
  }

  /**
   * 브랜드톡 발송 (REST API 직접 호출)
   */
  async sendBrandtalk(params: BrandtalkSendParams): Promise<SendResult> {
    if (!this.messageService) {
      console.error('Solapi SDK가 초기화되지 않았습니다.');
      return {
        successCount: 0,
        failCount: params.to.length,
        data: { error: 'Solapi SDK not initialized' },
      };
    }

    if (!this.pfId) {
      console.error('카카오 PF ID가 설정되지 않았습니다.');
      return {
        successCount: 0,
        failCount: params.to.length,
        data: { error: 'Kakao PF ID not configured' },
      };
    }

    try {
      console.log('🚀 [Solapi] 브랜드톡 발송 시작 (SDK 사용)');
      console.log('   - 수신자:', params.to.length, '명');
      console.log('   - 제목:', params.title);

      const senderNumber = process.env.SOLAPI_SENDER || '';
      if (!senderNumber) {
        console.error('발신 번호가 설정되지 않았습니다.');
        return {
          successCount: 0,
          failCount: params.to.length,
          data: { error: 'Sender number not configured' },
        };
      }

      // 버튼 구성 (SDK 타입에 맞춤)
      const buttons = params.button ? [{
        linkType: 'WL' as const,
        name: params.button.name,
        linkMobile: params.button.url,
        linkPc: params.button.url
      }] : [];

      // 메시지 배열 생성
      const messages = params.to.map(phoneNumber => ({
        to: phoneNumber,
        from: senderNumber,
        kakaoOptions: {
          pfId: this.pfId,
          bms: {
            targeting: 'I' as const, // I: 정보성, M: 마케팅, N: 무분류
            chatBubbleType: 'TEXT' as const, // TEXT: 텍스트형
            content: params.message,
            buttons: buttons
          }
        }
      }));

      console.log('📤 [Solapi] SDK send 호출');
      console.log('   - 메시지 구조:', JSON.stringify(messages[0], null, 2));

      // SDK의 send 메서드 사용 (인증 자동 처리)
      const result = await this.messageService.send(messages);
      
      console.log('✅ [Solapi] 브랜드톡 발송 완료:', JSON.stringify(result, null, 2));

      // 발송 결과 분석 (DetailGroupMessageResponse 타입)
      const successCount = (result as any).successCount || params.to.length;
      const failCount = (result as any).failCount || 0;

      return {
        successCount,
        failCount,
        data: result,
      };

    } catch (error: any) {
      console.error('❌ [Solapi] 브랜드톡 발송 예외:', error);
      console.error('   - 에러 메시지:', error.message);
      console.error('   - 에러 상세:', JSON.stringify(error, null, 2));
      return {
        successCount: 0,
        failCount: params.to.length,
        data: { error: error.message },
      };
    }
  }

  /**
   * 브랜드톡 직접 발송 (템플릿 없이)
   */
  async sendBrandTalkDirect(params: {
    to: string[];
    from: string;
    content: string;
    buttons?: any[];
    targeting?: string;
  }): Promise<{ success: boolean; data?: any; error?: { message: string } }> {
    if (!this.apiKey || !this.apiSecret) {
      return {
        success: false,
        error: { message: 'API key not configured' }
      };
    }

    if (!this.pfId) {
      return {
        success: false,
        error: { message: 'Kakao PF ID not configured' }
      };
    }

    try {
      console.log('🚀 [Solapi] 브랜드톡 직접 발송 시작');
      console.log('   - 수신자:', params.to.length, '명');

      const messages = params.to.map(phoneNumber => ({
        to: phoneNumber,
        from: params.from,
        kakaoOptions: {
          pfId: this.pfId,
          bms: {
            targeting: params.targeting || 'I',
            content: params.content,
            buttons: params.buttons || []
          }
        }
      }));

      const url = 'https://api.solapi.com/messages/v4/send-many';
      
      const date = new Date().toISOString();
      const salt = crypto.randomBytes(16).toString('hex');
      const hmacData = date + salt;
      const signature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(hmacData)
        .digest('hex');

      const authHeader = `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Solapi] 발송 실패:', errorText);
        return {
          success: false,
          error: { message: errorText }
        };
      }

      const result = await response.json();
      console.log('✅ [Solapi] 브랜드톡 발송 성공:', result.groupId);

      return {
        success: true,
        data: result
      };

    } catch (error: any) {
      console.error('❌ [Solapi] 브랜드톡 발송 예외:', error);
      return {
        success: false,
        error: { message: error.message || '발송 실패' }
      };
    }
  }
}

export const solapiService = new SolapiService();
