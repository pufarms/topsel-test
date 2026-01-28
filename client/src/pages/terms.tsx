import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      
      <main className="flex-1 bg-muted/30">
        <div className="container max-w-4xl mx-auto px-4 py-12 md:py-16">
          <div className="bg-card rounded-xl shadow-sm border p-6 md:p-10">
            <h1 
              className="text-2xl md:text-3xl font-extrabold text-foreground mb-8 pb-4 border-b-[3px] border-emerald-500"
              data-testid="text-terms-title"
            >
              서비스 이용약관
            </h1>

            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-extrabold text-foreground mb-4 pb-2 border-b-2 border-border">
                  제1장 총칙
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제1조 (목적)
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      이 약관은 "현 농업회사법인 주식회사"(이하 "회사"라 한다)가 운영하는 농산물 B2B 위탁판매 플랫폼 "탑셀러"(이하 "몰"이라 한다)에서 제공하는 인터넷 관련 서비스(이하 "서비스"라 한다)를 이용함에 있어 사이버 몰과 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
                    </p>
                  </div>

                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제2조 (용어의 정의)
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p>1. "몰"이란 회사가 재화 또는 용역(이하 "재화 등"이라 함)을 이용자에게 제공하기 위해 컴퓨터 등 정보통신설비를 이용하여 재화 등을 거래할 수 있도록 설정한 가상의 영업장을 말하며, 아울러 사이버몰을 운영하는 사업자의 의미로도 사용합니다.</p>
                      <p>2. "회원"이란 몰에 접속하여 이 약관에 동의하고 사업자 정보를 등록하여 승인을 받은 자로서, 몰이 제공하는 서비스를 지속적으로 이용할 수 있는 자를 말합니다.</p>
                      <p>3. "공급사"란 몰을 통해 회원에게 상품을 공급하고 배송을 담당하는 주체를 말합니다. <span className="text-red-600 font-bold">기본적으로 "회사(탑셀러)"가 주 공급사가 되며, 상품의 특성 및 종류에 따라 제휴된 농가 또는 외부 업체가 공급사가 될 수 있습니다.</span></p>
                      <p>4. "예치금(Deposit)"이란 회원이 재화 등의 구매를 위해 몰에 미리 입금하여 충전한 현금성 재화를 말합니다.</p>
                      <p>5. "포인트(Point)"란 회사가 프로모션, 보상, 관리자 권한 등으로 회원에게 무상 지급한 비현금성 재화를 말합니다.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제3조 (약관의 명시와 개정)
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p>1. 회사는 이 약관의 내용과 상호, 대표자 성명, 영업소 소재지, 사업자등록번호, 연락처 등을 초기 서비스 화면에 게시합니다.</p>
                      <p>2. 회사는 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있으며, 개정 시 적용일자 7일 전(회원에게 불리한 변경의 경우 30일 전)부터 공지합니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-foreground mb-4 pb-2 border-b-2 border-border">
                  제2장 회원 가입 및 관리
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제4조 (회원가입 및 자격)
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p>1. 본 몰은 <span className="text-red-600 font-bold">사업자 전용 B2B 도매 몰</span>로, 유효한 사업자등록증을 소지한 사업자에 한해 가입이 가능합니다.</p>
                      <p>2. 가입 신청자는 회사가 요청하는 증빙 서류(사업자등록증 등)를 제출해야 하며, 회사는 승인 심사를 거쳐 회원 자격을 부여합니다.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제5조 (회원 등급 및 혜택)
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p>1. 회사는 효율적인 서비스 운영을 위해 회원의 구매 실적, 활동 내역, 신용도 등을 기준으로 "회원 등급"을 부여할 수 있습니다.</p>
                      <p>2. 회원 등급의 기준, 명칭, 혜택(할인율, 상세페이지 사용 권한, 구매 한도 등)은 회사의 내부 정책에 따르며, 이는 몰 내 공지사항을 통해 별도로 공지합니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-foreground mb-4 pb-2 border-b-2 border-border">
                  제3장 주문, 결제 및 정산 (핵심 규정)
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제6조 (대금 지급 및 결제 수단)
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p>1. 몰에서 구매한 재화 등에 대한 대금 지급은 다음 각 호의 수단으로만 가능합니다.</p>
                      <ul className="list-disc pl-5 space-y-1 mt-2">
                        <li>① 회원이 미리 충전한 "예치금" 사용</li>
                        <li>② 회사가 지급한 "포인트" 사용</li>
                        <li>③ 기타 회사가 인정하는 전자적 지급 방법 (단, 신용카드 직접 결제 등은 지원하지 않음)</li>
                      </ul>
                      <p className="mt-2">2. 회사는 회원의 대금 지급(예치금 차감)에 대하여 어떠한 명목의 수수료도 추가하여 징수하지 않습니다.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제7조 (예치금 및 포인트의 운영)
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p>1. <strong>예치금(Deposit)의 운영</strong>: 예치금은 회원이 무통장 입금 등의 방법으로 몰에 현금을 입금하여 충전합니다. 충전된 예치금은 유효기간이 없으며, <span className="text-red-600 font-bold">회원의 환불 요청 시 회사가 정한 절차(본인 확인 등)에 따라 언제든지 현금으로 환불이 가능합니다.</span></p>
                      <p>2. <strong>포인트(Point)의 운영</strong>: 포인트는 현금으로 환불되거나 출금될 수 없으며, 예치금과 합산하여 상품 구매 시 사용할 수 있습니다.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제8조 (세금계산서 발행)
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p>1. <strong>[발행 기준]</strong> 회사는 부가가치세법에 의거하여 세금계산서를 발행합니다. 단, 이중 발행 방지를 위해 "예치금 충전 시점"에는 세금계산서를 발행하지 않습니다.</p>
                      <p>2. <strong>[발행 시기]</strong> 세금계산서는 회원이 예치금 또는 포인트를 사용하여 <span className="text-red-600 font-bold">"실제 상품을 구매(발주)하여 예치금이 차감된 시점"</span>을 기준으로 발행됩니다. (면세 상품의 경우 계산서 발행)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-foreground mb-4 pb-2 border-b-2 border-border">
                  제4장 서비스 이용 및 저작권 보호
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제9조 (저작권의 귀속 및 이용 제한)
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p>1. 회사가 작성한 저작물(상세페이지, 상품 이미지, 동영상, 편집물 등)의 저작권은 "회사"에 귀속합니다.</p>
                      <p>2. 회원은 "몰을 통해 공급받은 상품의 위탁판매 및 홍보 목적"에 한하여 회사가 제공하는 콘텐츠를 사용할 수 있습니다.</p>
                      <p>3. <strong>[금지행위]</strong> 회원은 다음 각 호의 행위를 하여서는 안 되며, 이를 위반할 경우 회원 자격 박탈과 동시에 민·형사상 법적 책임을 집니다.</p>
                      <ul className="list-disc pl-5 space-y-1 mt-2">
                        <li>① 몰의 콘텐츠를 회사를 통하지 않은 상품(유사 상품, 타 도매처 상품)의 판매를 위해 무단 도용하는 행위</li>
                        <li>② 몰의 콘텐츠를 임의로 가공, 편집하여 원본의 동일성을 훼손하거나 회사의 브랜드 이미지를 실추시키는 행위</li>
                      </ul>
                      <p className="mt-2">4. <strong>[위약벌]</strong> 저작권 침해 행위 적발 시 위반 건당 금 일금 백만 원(₩1,000,000)의 위약벌을 청구할 수 있습니다.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제10조 (직거래 금지)
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      회원은 몰을 통해 알게 된 공급사(농가)와 직접 거래를 시도하거나 이를 유도해서는 안 되며, 적발 시 즉시 탈퇴 처리 및 손해배상이 청구될 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-foreground mb-4 pb-2 border-b-2 border-border">
                  제5장 배송 및 반품 특약 (신선식품)
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제11조 (배송 및 발주 마감)
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      당일 발주 마감 시간은 <span className="text-red-600 font-bold">"사이트에 공지한 지정한 시간"</span>까지로 하며, 해당 시간 이후 주문(결제) 건은 익일 발주됩니다.
                    </p>
                  </div>

                  <div>
                    <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                      제12조 (신선식품 반품 및 교환 특약)
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      <p>1. <strong>[단순 변심 반품 불가]</strong> 몰에서 판매하는 상품은 신선식품(농축수산물)의 특성상 시간이 경과함에 따라 재판매가 곤란할 정도로 재화의 가치가 현저히 감소합니다. 따라서 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항 제3호에 의거하여 회원의 단순 변심에 의한 청약철회(반품/교환)가 제한됩니다.</p>
                      <p>2. <strong>[하자 처리 절차]</strong> 상품의 하자(오배송, 파손, 부패 등)가 있는 경우, <span className="text-red-600 font-bold">수령 후 24시간 이내에 사진(박스, 송장, 하자부위)을 첨부하여 접수</span>해야 합니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t">
                <h3 className="inline-block text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded mb-3">
                  부칙
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  이 약관은 회원가입시 동의 일부터 적용 됩니다.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
