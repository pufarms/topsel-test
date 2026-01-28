import { Link } from "wouter";
import { usePublicSiteSettings } from "@/hooks/use-site-settings";

export function PublicFooter() {
  const { data: settings } = usePublicSiteSettings();

  const companyName = settings?.footer_company_name || "";
  const ceoName = settings?.footer_ceo_name;
  const bizNumber = settings?.footer_biz_number;
  const address = settings?.footer_address;
  const phone = settings?.footer_phone;
  const email = settings?.footer_email;
  const copyright = settings?.footer_copyright || "Copyright © 2025 TopSeller. All rights reserved.";
  const showTerms = settings?.footer_show_terms !== false;
  const showPrivacy = settings?.footer_show_privacy !== false;

  return (
    <footer className="border-t bg-muted/40" data-testid="footer">
      <div className="container px-4 md:px-6 pt-16 pb-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            {companyName && (
              <p className="font-semibold" data-testid="text-company-name">
                {companyName}
              </p>
            )}
            {ceoName && (
              <p className="text-sm text-muted-foreground">
                대표: {ceoName}
              </p>
            )}
            {bizNumber && (
              <p className="text-sm text-muted-foreground">
                사업자등록번호: {bizNumber}
              </p>
            )}
          </div>

          <div className="space-y-2">
            {address && (
              <p className="text-sm text-muted-foreground">
                {address}
              </p>
            )}
            {phone && (
              <p className="text-sm text-muted-foreground">
                전화: {phone}
              </p>
            )}
            {email && (
              <p className="text-sm text-muted-foreground">
                이메일: {email}
              </p>
            )}
          </div>

          <div className="space-y-2">
            {(showTerms || showPrivacy) && (
              <div className="flex flex-wrap gap-4">
                {showTerms && (
                  <Link 
                    href="/terms" 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-terms"
                  >
                    이용약관
                  </Link>
                )}
                {showPrivacy && (
                  <Link 
                    href="/privacy" 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-privacy"
                  >
                    개인정보처리방침
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t">
          <p className="text-xs text-muted-foreground text-center" data-testid="text-copyright">
            {copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
