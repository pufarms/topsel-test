import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

interface PublicLayoutProps {
  children: React.ReactNode;
  transparentHeader?: boolean;
  hasHeroBanner?: boolean;
}

export function PublicLayout({ children, transparentHeader = false, hasHeroBanner = false }: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader transparent={transparentHeader} />
      <main className={`flex-1 ${!hasHeroBanner ? "pt-16" : ""}`}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
