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
  onFieldEdit?: (sectionId: string, fieldPath: string, currentValue: string, fieldType: 'text' | 'image') => void;
}

interface EditableFieldProps {
  value: string;
  sectionId: string;
  fieldPath: string;
  fieldType: 'text' | 'image';
  isEditing?: boolean;
  onEdit?: (sectionId: string, fieldPath: string, value: string, fieldType: 'text' | 'image') => void;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  children?: React.ReactNode;
}

function EditableField({ value, sectionId, fieldPath, fieldType, isEditing, onEdit, className = "", as: Component = 'span', children }: EditableFieldProps) {
  if (!isEditing || !onEdit) {
    return <Component className={className}>{children || value}</Component>;
  }
  
  return (
    <Component 
      className={`${className} relative group cursor-pointer hover:bg-primary/10 hover:outline hover:outline-2 hover:outline-primary/50 rounded transition-colors`}
      onClick={(e) => {
        e.stopPropagation();
        onEdit(sectionId, fieldPath, value, fieldType);
      }}
      data-testid={`editable-${sectionId}-${fieldPath}`}
    >
      {children || value}
      <span className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-primary text-primary-foreground text-xs px-1 py-0.5 rounded transition-opacity">
        편집
      </span>
    </Component>
  );
}

interface EditableImageProps {
  src: string;
  alt: string;
  sectionId: string;
  fieldPath: string;
  isEditing?: boolean;
  onEdit?: (sectionId: string, fieldPath: string, value: string, fieldType: 'text' | 'image') => void;
  className?: string;
}

function EditableImage({ src, alt, sectionId, fieldPath, isEditing, onEdit, className = "" }: EditableImageProps) {
  if (!isEditing || !onEdit) {
    return <img src={src} alt={alt} className={className} />;
  }
  
  return (
    <div 
      className="relative group cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onEdit(sectionId, fieldPath, src, 'image');
      }}
      data-testid={`editable-image-${sectionId}-${fieldPath}`}
    >
      <img src={src} alt={alt} className={`${className} group-hover:opacity-80 transition-opacity`} />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity rounded">
        <span className="bg-primary text-primary-foreground text-sm px-3 py-1 rounded">
          이미지 변경
        </span>
      </div>
    </div>
  );
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

interface SectionProps {
  data: PageSection["data"];
  sectionId: string;
  isEditing?: boolean;
  onClick?: () => void;
  onFieldEdit?: (sectionId: string, fieldPath: string, currentValue: string, fieldType: 'text' | 'image') => void;
}

function HeroSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  if (!data) return null;
  const description = data.text || data.description || "";
  const hasBackgroundImage = data.backgroundType === "image" && data.backgroundImage;
  
  return (
    <section
      className={`relative py-16 md:py-24 ${!hasBackgroundImage ? "bg-gradient-to-br from-primary/10 to-primary/5" : ""} ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-hero"
    >
      {hasBackgroundImage && (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${data.backgroundImage})` }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}
      <div className={`container mx-auto px-4 text-center relative z-10 ${hasBackgroundImage ? "text-white" : ""}`}>
        {data.imageUrl && (
          <div className="mb-8">
            <EditableImage
              src={data.imageUrl}
              alt={data.imageAlt || "Hero image"}
              sectionId={sectionId}
              fieldPath="imageUrl"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              className="max-w-full h-auto max-h-[300px] mx-auto rounded-lg object-cover"
            />
          </div>
        )}
        {data.title && (
          <EditableField
            value={data.title}
            sectionId={sectionId}
            fieldPath="title"
            fieldType="text"
            isEditing={isEditing}
            onEdit={onFieldEdit}
            as="h1"
            className="text-3xl md:text-5xl font-bold mb-4"
          />
        )}
        {data.subtitle && (
          <EditableField
            value={data.subtitle}
            sectionId={sectionId}
            fieldPath="subtitle"
            fieldType="text"
            isEditing={isEditing}
            onEdit={onFieldEdit}
            as="h2"
            className="text-xl md:text-2xl text-muted-foreground mb-4"
          />
        )}
        {description && (
          <EditableField
            value={description}
            sectionId={sectionId}
            fieldPath="description"
            fieldType="text"
            isEditing={isEditing}
            onEdit={onFieldEdit}
            as="p"
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
          />
        )}
        <div className="flex flex-wrap gap-4 justify-center">
          {data.buttonText && data.buttonLink && (
            <Button asChild size="lg">
              <Link href={data.buttonLink}>{data.buttonText}</Link>
            </Button>
          )}
          {data.secondaryButtonText && data.secondaryButtonLink && (
            <Button asChild size="lg" variant="outline">
              <Link href={data.secondaryButtonLink}>{data.secondaryButtonText}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function HeadingSection({ data, isEditing, onClick }: { data: PageSection["data"]; isEditing?: boolean; onClick?: () => void }) {
  if (!data) return null;
  const title = data.title || "";
  
  return (
    <div
      className={`py-8 ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-heading"
    >
      <h2 className="text-2xl md:text-3xl font-bold text-center">{title}</h2>
    </div>
  );
}

function TextSection({ data, isEditing, onClick }: { data: PageSection["data"]; isEditing?: boolean; onClick?: () => void }) {
  if (!data) return null;
  const text = data.text || data.description || "";
  
  return (
    <div
      className={`py-6 ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-text"
    >
      <div className="container mx-auto px-4">
        <p className="text-base md:text-lg leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

function ImageSection({ data, isEditing, onClick }: { data: PageSection["data"]; isEditing?: boolean; onClick?: () => void }) {
  if (!data) return null;
  
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
  if (!data) return null;
  
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
  if (!data) return null;
  
  return (
    <section
      className={`py-12 ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-cards"
    >
      <div className="container mx-auto px-4">
        {(data.title || data.subtitle) && (
          <div className="text-center mb-8">
            {data.title && (
              <p className="text-primary font-semibold mb-2">{data.title}</p>
            )}
            {data.subtitle && (
              <h2 className="text-2xl md:text-3xl font-bold">{data.subtitle}</h2>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.items?.map((item, index) => (
            <Card key={item.id || index} className="hover-elevate">
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
  if (!data) return null;
  const description = data.text || data.description;
  const itemCount = data.items?.length || 0;
  const gridCols = itemCount === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  
  return (
    <section
      className={`py-12 bg-muted/50 ${isEditing ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2" : ""}`}
      onClick={onClick}
      data-testid="section-features"
    >
      <div className="container mx-auto px-4">
        {data.title && (
          <div className="text-center mb-8">
            <p className="text-primary font-semibold mb-2">{data.title}</p>
            {data.subtitle && (
              <h2 className="text-2xl md:text-3xl font-bold mb-2">{data.subtitle}</h2>
            )}
            {description && (
              <p className="text-muted-foreground max-w-2xl mx-auto">{description}</p>
            )}
          </div>
        )}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-6`}>
          {data.items?.map((item, index) => (
            <div key={item.id || index} className="text-center p-6">
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
  if (!data) return null;
  const description = data.text || data.description;
  
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
        {description && (
          <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">{description}</p>
        )}
        <div className="flex flex-wrap gap-4 justify-center">
          {data.buttonText && data.buttonLink && (
            <Button asChild variant="secondary" size="lg">
              <Link href={data.buttonLink}>{data.buttonText}</Link>
            </Button>
          )}
          {data.secondaryButtonText && data.secondaryButtonLink && (
            <Button asChild variant="outline" size="lg" className="border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10">
              <Link href={data.secondaryButtonLink}>{data.secondaryButtonText}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

export function DynamicPageRenderer({ content, isEditing, onSectionClick, onFieldEdit }: DynamicPageRendererProps) {
  if (!content || !content.sections || content.sections.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <p>이 페이지에는 아직 콘텐츠가 없습니다.</p>
      </div>
    );
  }

  const sortedSections = [...content.sections].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="min-h-[400px]">
      {sortedSections.map((section, index) => {
        const handleClick = isEditing && onSectionClick ? () => onSectionClick(section) : undefined;
        // Support both flat structure (section.title) and nested structure (section.data.title)
        const sectionData = section.data || section;
        
        const sectionId = section.id || `section-${index}`;
        const commonProps = { data: sectionData, sectionId, isEditing, onClick: handleClick, onFieldEdit };
        
        switch (section.type) {
          case "hero":
            return <HeroSection key={sectionId} {...commonProps} />;
          case "heading":
            return <HeadingSection key={sectionId} data={sectionData} isEditing={isEditing} onClick={handleClick} />;
          case "text":
            return <TextSection key={sectionId} data={sectionData} isEditing={isEditing} onClick={handleClick} />;
          case "image":
            return <ImageSection key={sectionId} data={sectionData} isEditing={isEditing} onClick={handleClick} />;
          case "button":
            return <ButtonSection key={sectionId} data={sectionData} isEditing={isEditing} onClick={handleClick} />;
          case "divider":
            return <DividerSection key={sectionId} isEditing={isEditing} onClick={handleClick} />;
          case "cards":
            return <CardsSection key={sectionId} data={sectionData} isEditing={isEditing} onClick={handleClick} />;
          case "features":
            return <FeaturesSection key={sectionId} data={sectionData} isEditing={isEditing} onClick={handleClick} />;
          case "cta":
            return <CTASection key={sectionId} data={sectionData} isEditing={isEditing} onClick={handleClick} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
