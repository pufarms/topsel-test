import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@topsel.kr';

function getBaseTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
              <tr>
                <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 40px;text-align:center;">
                  <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">TOPSEL</h1>
                  <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:8px 0 0;letter-spacing:0.5px;">탑셀러 주문관리시스템</p>
                </td>
              </tr>
              <tr>
                <td style="padding:40px;">
                  ${content}
                </td>
              </tr>
              <tr>
                <td style="padding:24px 40px;background-color:#f8f9fa;border-top:1px solid #e9ecef;">
                  <p style="color:#868e96;font-size:12px;margin:0;text-align:center;line-height:1.6;">
                    본 메일은 탑셀러 시스템에서 자동 발송된 메일입니다.<br>
                    문의사항이 있으시면 관리자에게 연락해 주세요.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export async function sendVerificationCode(
  toEmail: string,
  code: string,
  type: 'email_change' | 'signup'
): Promise<{ success: boolean; message: string }> {
  const typeLabel = type === 'signup' ? '회원가입' : '이메일 변경';
  const subject = `[Topsel] ${typeLabel} 인증번호 안내`;

  const content = `
    <h2 style="color:#1a1a2e;font-size:20px;font-weight:700;margin:0 0 8px;letter-spacing:-0.3px;">${typeLabel} 인증번호</h2>
    <p style="color:#495057;font-size:15px;line-height:1.7;margin:0 0 28px;">
      안녕하세요, 탑셀러입니다.<br>
      아래 인증번호를 입력하여 ${typeLabel} 절차를 완료해 주세요.
    </p>
    <div style="background-color:#f0f4ff;border:2px solid #2563eb;border-radius:10px;padding:24px;text-align:center;margin:0 0 28px;">
      <p style="color:#868e96;font-size:13px;margin:0 0 8px;">인증번호</p>
      <p style="color:#2563eb;font-size:36px;font-weight:800;letter-spacing:8px;margin:0;">${code}</p>
    </div>
    <div style="background-color:#fff3cd;border-radius:8px;padding:16px;margin:0 0 16px;">
      <p style="color:#856404;font-size:13px;margin:0;line-height:1.6;">
        ⏰ 인증번호는 <strong>5분간</strong> 유효합니다.<br>
        ⚠️ 본인이 요청하지 않은 경우 이 메일을 무시해 주세요.
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: `탑셀러 <${SENDER_EMAIL}>`,
      to: toEmail,
      subject,
      html: getBaseTemplate(content),
    });
    return { success: true, message: '인증번호가 발송되었습니다.' };
  } catch (error: any) {
    console.error('[이메일 발송 실패] sendVerificationCode:', error?.message || error);
    return { success: false, message: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
  }
}

export async function sendTempPassword(
  toEmail: string,
  tempPassword: string
): Promise<{ success: boolean; message: string }> {
  const subject = '[Topsel] 임시 비밀번호가 발급되었습니다';

  const content = `
    <h2 style="color:#1a1a2e;font-size:20px;font-weight:700;margin:0 0 8px;letter-spacing:-0.3px;">임시 비밀번호 안내</h2>
    <p style="color:#495057;font-size:15px;line-height:1.7;margin:0 0 28px;">
      안녕하세요, 탑셀러입니다.<br>
      요청하신 임시 비밀번호가 발급되었습니다.
    </p>
    <div style="background-color:#f0f4ff;border:2px solid #2563eb;border-radius:10px;padding:24px;text-align:center;margin:0 0 28px;">
      <p style="color:#868e96;font-size:13px;margin:0 0 8px;">임시 비밀번호</p>
      <p style="color:#2563eb;font-size:28px;font-weight:800;letter-spacing:4px;margin:0;">${tempPassword}</p>
    </div>
    <div style="background-color:#f8d7da;border-radius:8px;padding:16px;margin:0 0 16px;">
      <p style="color:#721c24;font-size:13px;margin:0;line-height:1.6;">
        🔒 <strong>보안 안내</strong><br>
        로그인 후 반드시 비밀번호를 변경해 주세요.<br>
        임시 비밀번호는 보안에 취약하므로 즉시 변경을 권장합니다.
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: `탑셀러 <${SENDER_EMAIL}>`,
      to: toEmail,
      subject,
      html: getBaseTemplate(content),
    });
    return { success: true, message: '임시 비밀번호가 이메일로 발송되었습니다.' };
  } catch (error: any) {
    console.error('[이메일 발송 실패] sendTempPassword:', error?.message || error);
    return { success: false, message: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
  }
}
