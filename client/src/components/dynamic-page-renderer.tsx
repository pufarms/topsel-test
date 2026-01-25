import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import type { PageContent, PageSection } from "@shared/schema";
import {
  Star,
  Heart,
  Shield,
  Zap,
  Award,
  CheckCircle,
  Gift,
  Users,
  TrendingUp,
  Package,
} from "lucide-react";

interface DynamicPageRendererProps {
  content: PageContent | null;
  isEditing?: boolean;
  onSectionClick?: (section: PageSection) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  Star: <Star className="w-6 h-6" />,
  Heart: <Heart className="w-6 h-6" />,
  Shield: <Shield className="w-6 h-6" />,
  Zap: <Zap className="w-6 h-6" />,
  Award: <Award className="w-6 h-6" />,
  CheckCircle: <CheckCircle className="w-6 h-6" />,
  Gift: <Gift className="w-6 h-6" />,
  Users: <Users className="w-6 h-6" />,
  TrendingUp: <TrendingUp className="w-6 h-6" />,
  Package: <Package className="w-6 h-6" />,
};

function HeroSection({ data, isEditing, onClick }: { data: PageSection["data"]; isEditing?: boolean; onClick?: () => void }) {
  return (
    <section
      className={`relative py-16 md:py-24 bg-gradient-to-br from-primary/10 to-primary/5 ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-hero"
    >
      <div className="container mx-auto px-4 text-center">
        {data.imageUrl && (
          <div className="mb-8">
            <img
              src={data.imageUrl}
              alt={data.imageAlt || "Hero image"}
              className="max-w-full h-auto max-h-[300px] mx-auto rounded-lg object-cover"
            />
          </div>
        )}
        {data.title && (
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{data.title}</h1>
        )}
        {data.subtitle && (
          <h2 className="text-xl md:text-2xl text-muted-foreground mb-4">{data.subtitle}</h2>
        )}
        {data.text && (
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">{data.text}</p>
        )}
        {data.buttonText && data.buttonLink && (
          <Button asChild size="lg">
            <Link href={data.buttonLink}>{data.buttonText}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

function HeadingSection({ data, isEditing, onClick }: { data: PageSection["data"]; isEditing?: boolean; onClick?: () => void }) {
  return (
    <div
      className={`py-8 ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-heading"
    >
      <h2 className="text-2xl md:text-3xl font-bold text-center">{data.title}</h2>
    </div>
  );
}

function TextSection({ data, isEditing, onClick }: { data: PageSection["data"]; isEditing?: boolean; onClick?: () => void }) {
  return (
    <div
      className={`py-6 ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-text"
    >
      <div className="container mx-auto px-4">
        <p className="text-base md:text-lg leading-relaxed whitespace-pre-wrap">{data.text}</p>
      </div>
    </div>
  );
}

function ImageSection({ data, isEditing, onClick }: { data: PageSection["data"]; isEditing?: boolean; onClick?: () => void }) {
  return (
    <div
      className={`py-8 ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-image"
    >
      <div className="container mx-auto px-4">
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={data.imageAlt || "Image"}
            className="max-w-full h-auto mx-auto rounded-lg"
          />
        ) : (
          <div className="bg-muted h-48 rounded-lg flex items-center justify-center text-muted-foreground">
            이미지를 추가하세요
          </div>
        )}
      </div>
    </div>
  );
}

function ButtonSection({ data, isEditing, onClick }: { data: PageSection["data"]; isEditing?: boolean; onClick?: () => void }) {
  return (
    <div
      className={`py-6 text-center ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-button"
    >
      <Button asChild>
        <Link href={data.buttonLink || "#"}>{data.buttonText || "버튼"}</Link>
      </Button>
    </div>
  );
}

function DividerSection({ isEditing, onClick }: { isEditing?: boolean; onClick?: () => void }) {
  return (
    <div
      className={`py-8 ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-divider"
    >
      <hr className="border-t border-border" />
    </div>
  );
}

function CardsSection({ data, isEditing, onClick }: { data: PageSection["data"]; isEditing?: boolean; onClick?: () => void }) {
  return (
    <section
      className={`py-12 ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-cards"
    >
      <div className="container mx-auto px-4">
        {data.title && (
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">{data.title}</h2>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.items?.map((item) => (
            <Card key={item.id} className="hover-elevate">
              {item.imageUrl && (
                <div className="aspect-video overflow-hidden rounded-t-lg">
                  <img
                    src={item.imageUrl}
                    alt={item.title || "Card image"}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{item.description}</CardDescription>
                {item.link && (
                  <Button asChild variant="ghost" className="px-0 mt-2 text-primary">
                    <Link href={item.link}>자세히 보기</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection({ data, isEditing, onClick }: { data: PageSection["data"]; isEditing?: boolean; onClick?: () => void }) {
  return (
    <section
      className={`py-12 bg-muted/50 ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-features"
    >
      <div className="container mx-auto px-4">
        {data.title && (
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">{data.title}</h2>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {data.items?.map((item) => (
            <div key={item.id} className="text-center p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
                {item.icon && iconMap[item.icon] ? iconMap[item.icon] : <Star className="w-6 h-6" />}
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ data, isEditing, onClick }: { data: PageSection["data"]; isEditing?: boolean; onClick?: () => void }) {
  return (
    <section
      className={`py-16 bg-primary text-primary-foreground ${isEditing ? "cursor-pointer ring-2 ring-primary-foreground/50 ring-offset-2 ring-offset-primary" : ""}`}
      onClick={onClick}
      data-testid="section-cta"
    >
      <div className="container mx-auto px-4 text-center">
        {data.title && (
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{data.title}</h2>
        )}
        {data.text && (
          <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">{data.text}</p>
        )}
        {data.buttonText && data.buttonLink && (
          <Button asChild variant="secondary" size="lg">
            <Link href={data.buttonLink}>{data.buttonText}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

export function DynamicPageRenderer({ content, isEditing, onSectionClick }: DynamicPageRendererProps) {
  if (!content || !content.sections || content.sections.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <p>이 페이지에는 아직 콘텐츠가 없습니다.</p>
      </div>
    );
  }

  const sortedSections = [...content.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-[400px]">
      {sortedSections.map((section) => {
        const handleClick = isEditing && onSectionClick ? () => onSectionClick(section) : undefined;
        
        switch (section.type) {
          case "hero":
            return <HeroSection key={section.id} data={section.data} isEditing={isEditing} onClick={handleClick} />;
          case "heading":
            return <HeadingSection key={section.id} data={section.data} isEditing={isEditing} onClick={handleClick} />;
          case "text":
            return <TextSection key={section.id} data={section.data} isEditing={isEditing} onClick={handleClick} />;
          case "image":
            return <ImageSection key={section.id} data={section.data} isEditing={isEditing} onClick={handleClick} />;
          case "button":
            return <ButtonSection key={section.id} data={section.data} isEditing={isEditing} onClick={handleClick} />;
          case "divider":
            return <DividerSection key={section.id} isEditing={isEditing} onClick={handleClick} />;
          case "cards":
            return <CardsSection key={section.id} data={section.data} isEditing={isEditing} onClick={handleClick} />;
          case "features":
            return <FeaturesSection key={section.id} data={section.data} isEditing={isEditing} onClick={handleClick} />;
          case "cta":
            return <CTASection key={section.id} data={section.data} isEditing={isEditing} onClick={handleClick} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
