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
  const renderContent = () => {
    if (children) return children;
    if (value && value.includes('<br>')) {
      return <span dangerouslySetInnerHTML={{ __html: value }} />;
    }
    return value;
  };

  if (!isEditing || !onEdit) {
    return <Component className={className}>{renderContent()}</Component>;
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
      {renderContent()}
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

interface EditableButtonProps {
  text: string;
  link: string;
  sectionId: string;
  fieldPath: string;
  isEditing?: boolean;
  onEdit?: (sectionId: string, fieldPath: string, value: string, fieldType: 'text' | 'image') => void;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

function EditableButton({ text, link, sectionId, fieldPath, isEditing, onEdit, variant = "default", size = "default", className = "" }: EditableButtonProps) {
  if (!isEditing) {
    return (
      <Button asChild variant={variant} size={size} className={className}>
        <Link href={link}>{text}</Link>
      </Button>
    );
  }
  
  return (
    <Button
      variant={variant}
      size={size}
      className={`${className} relative group hover:ring-2 hover:ring-primary/50`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onEdit) {
          onEdit(sectionId, fieldPath, `${text}|${link}`, 'text');
        }
      }}
      data-testid={`editable-button-${sectionId}-${fieldPath}`}
    >
      {text}
      <span className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-primary text-primary-foreground text-xs px-1 py-0.5 rounded transition-opacity z-10">
        버튼 편집
      </span>
    </Button>
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
      className={`relative py-16 md:py-24 ${!hasBackgroundImage ? "bg-gradient-to-br from-primary/10 to-primary/5" : ""} ${isEditing ? "cursor-pointer" : ""}`}
      data-testid="section-hero"
    >
      {hasBackgroundImage && (
        <>
          <div 
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${isEditing ? "cursor-pointer group" : ""}`}
            style={{ backgroundImage: `url(${data.backgroundImage})` }}
            onClick={(e) => {
              if (isEditing && onFieldEdit) {
                e.stopPropagation();
                onFieldEdit(sectionId, "backgroundImage", data.backgroundImage || "", "image");
              }
            }}
          >
            {isEditing && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                <span className="bg-primary text-primary-foreground text-sm px-3 py-1 rounded">
                  배경 이미지 변경
                </span>
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-black/50 pointer-events-none" />
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
            <EditableButton
              text={data.buttonText}
              link={data.buttonLink}
              sectionId={sectionId}
              fieldPath="button"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              size="lg"
            />
          )}
          {data.secondaryButtonText && data.secondaryButtonLink && (
            <EditableButton
              text={data.secondaryButtonText}
              link={data.secondaryButtonLink}
              sectionId={sectionId}
              fieldPath="secondaryButton"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              size="lg"
              variant="outline"
            />
          )}
        </div>
      </div>
    </section>
  );
}

function HeadingSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  if (!data) return null;
  const title = data.title || "";
  
  return (
    <div
      className={`py-8 ${isEditing ? "cursor-pointer" : ""}`}
      data-testid="section-heading"
    >
      <EditableField
        value={title}
        sectionId={sectionId}
        fieldPath="title"
        fieldType="text"
        isEditing={isEditing}
        onEdit={onFieldEdit}
        as="h2"
        className="text-2xl md:text-3xl font-bold text-center"
      />
    </div>
  );
}

function TextSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  if (!data) return null;
  const text = data.text || data.description || "";
  
  return (
    <div
      className={`py-6 ${isEditing ? "cursor-pointer" : ""}`}
      data-testid="section-text"
    >
      <div className="container mx-auto px-4">
        <EditableField
          value={text}
          sectionId={sectionId}
          fieldPath="text"
          fieldType="text"
          isEditing={isEditing}
          onEdit={onFieldEdit}
          as="p"
          className="text-base md:text-lg leading-relaxed whitespace-pre-wrap"
        />
      </div>
    </div>
  );
}

function ImageSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  if (!data) return null;
  
  return (
    <div
      className={`py-8 ${isEditing ? "cursor-pointer" : ""}`}
      data-testid="section-image"
    >
      <div className="container mx-auto px-4">
        {data.imageUrl ? (
          <EditableImage
            src={data.imageUrl}
            alt={data.imageAlt || "Image"}
            sectionId={sectionId}
            fieldPath="imageUrl"
            isEditing={isEditing}
            onEdit={onFieldEdit}
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

function ButtonSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  if (!data) return null;
  
  return (
    <div
      className={`py-6 text-center ${isEditing ? "cursor-pointer" : ""}`}
      data-testid="section-button"
    >
      <Button asChild>
        <Link href={data.buttonLink || "#"}>{data.buttonText || "버튼"}</Link>
      </Button>
    </div>
  );
}

function DividerSection({ sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  return (
    <div
      className={`py-8 ${isEditing ? "cursor-pointer" : ""}`}
      data-testid="section-divider"
    >
      <hr className="border-t border-border" />
    </div>
  );
}

function CardsSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  if (!data) return null;
  
  return (
    <section
      className={`py-12 ${isEditing ? "cursor-pointer" : ""}`}
      data-testid="section-cards"
    >
      <div className="container mx-auto px-4">
        {(data.title || data.subtitle) && (
          <div className="text-center mb-8">
            {data.title && (
              <EditableField
                value={data.title}
                sectionId={sectionId}
                fieldPath="title"
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="p"
                className="text-primary font-semibold mb-2"
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
                className="text-2xl md:text-3xl font-bold"
              />
            )}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.items?.map((item, index) => (
            <Card key={item.id || index} className="hover-elevate">
              {item.imageUrl && (
                <div className="aspect-video overflow-hidden rounded-t-lg">
                  <EditableImage
                    src={item.imageUrl}
                    alt={item.title || "Card image"}
                    sectionId={sectionId}
                    fieldPath={`items.${index}.imageUrl`}
                    isEditing={isEditing}
                    onEdit={onFieldEdit}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <EditableField
                  value={item.title || ""}
                  sectionId={sectionId}
                  fieldPath={`items.${index}.title`}
                  fieldType="text"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  as="h3"
                  className="text-lg font-semibold"
                />
              </CardHeader>
              <CardContent>
                <EditableField
                  value={item.description || ""}
                  sectionId={sectionId}
                  fieldPath={`items.${index}.description`}
                  fieldType="text"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  as="p"
                  className="text-sm text-muted-foreground"
                />
                {item.link && (
                  <EditableButton
                    text="자세히 보기"
                    link={item.link}
                    sectionId={sectionId}
                    fieldPath={`items.${index}.link`}
                    isEditing={isEditing}
                    onEdit={onFieldEdit}
                    variant="ghost"
                    className="px-0 mt-2 text-primary"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  if (!data) return null;
  const description = data.text || data.description || "";
  const itemCount = data.items?.length || 0;
  const gridCols = itemCount === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  
  return (
    <section
      className={`py-12 bg-muted/50 ${isEditing ? "cursor-pointer" : ""}`}
      data-testid="section-features"
    >
      <div className="container mx-auto px-4">
        {data.title && (
          <div className="text-center mb-8">
            <EditableField
              value={data.title}
              sectionId={sectionId}
              fieldPath="title"
              fieldType="text"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              as="p"
              className="text-primary font-semibold mb-2"
            />
            {data.subtitle && (
              <EditableField
                value={data.subtitle}
                sectionId={sectionId}
                fieldPath="subtitle"
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="h2"
                className="text-2xl md:text-3xl font-bold mb-2"
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
                className="text-muted-foreground max-w-2xl mx-auto"
              />
            )}
          </div>
        )}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-6`}>
          {data.items?.map((item, index) => (
            <div key={item.id || index} className="text-center p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
                {item.icon && iconMap[item.icon] ? iconMap[item.icon] : <Star className="w-6 h-6" />}
              </div>
              <EditableField
                value={item.title || ""}
                sectionId={sectionId}
                fieldPath={`items.${index}.title`}
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="h3"
                className="font-semibold mb-2"
              />
              <EditableField
                value={item.description || ""}
                sectionId={sectionId}
                fieldPath={`items.${index}.description`}
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="p"
                className="text-sm text-muted-foreground"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  if (!data) return null;
  const description = data.text || data.description || "";
  
  return (
    <section
      className={`py-16 bg-primary text-primary-foreground ${isEditing ? "cursor-pointer" : ""}`}
      data-testid="section-cta"
    >
      <div className="container mx-auto px-4 text-center">
        {data.title && (
          <EditableField
            value={data.title}
            sectionId={sectionId}
            fieldPath="title"
            fieldType="text"
            isEditing={isEditing}
            onEdit={onFieldEdit}
            as="h2"
            className="text-2xl md:text-3xl font-bold mb-4"
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
            className="text-lg opacity-90 max-w-2xl mx-auto mb-8"
          />
        )}
        <div className="flex flex-wrap gap-4 justify-center">
          {data.buttonText && data.buttonLink && (
            <EditableButton
              text={data.buttonText}
              link={data.buttonLink}
              sectionId={sectionId}
              fieldPath="button"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              variant="secondary"
              size="lg"
            />
          )}
          {data.secondaryButtonText && data.secondaryButtonLink && (
            <EditableButton
              text={data.secondaryButtonText}
              link={data.secondaryButtonLink}
              sectionId={sectionId}
              fieldPath="secondaryButton"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              variant="outline"
              size="lg"
              className="border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10"
            />
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
            return <HeadingSection key={sectionId} {...commonProps} />;
          case "text":
            return <TextSection key={sectionId} {...commonProps} />;
          case "image":
            return <ImageSection key={sectionId} {...commonProps} />;
          case "button":
            return <ButtonSection key={sectionId} {...commonProps} />;
          case "divider":
            return <DividerSection key={sectionId} {...commonProps} />;
          case "cards":
            return <CardsSection key={sectionId} {...commonProps} />;
          case "features":
            return <FeaturesSection key={sectionId} {...commonProps} />;
          case "cta":
            return <CTASection key={sectionId} {...commonProps} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
