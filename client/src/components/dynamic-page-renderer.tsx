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
  Play,
  X,
  Tag,
  CreditCard,
  Wallet,
  MessageSquare,
  FileText,
  PartyPopper,
  Check,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface DynamicPageRendererProps {
  content: PageContent | null;
  isEditing?: boolean;
  onSectionClick?: (section: PageSection) => void;
  onFieldEdit?: (sectionId: string, fieldPath: string, currentValue: string, fieldType: 'text' | 'image' | 'icon') => void;
}

interface EditableFieldProps {
  value: string;
  sectionId: string;
  fieldPath: string;
  fieldType: 'text' | 'image' | 'icon';
  isEditing?: boolean;
  onEdit?: (sectionId: string, fieldPath: string, value: string, fieldType: 'text' | 'image' | 'icon') => void;
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
  onEdit?: (sectionId: string, fieldPath: string, value: string, fieldType: 'text' | 'image' | 'icon') => void;
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
  onEdit?: (sectionId: string, fieldPath: string, value: string, fieldType: 'text' | 'image' | 'icon') => void;
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
  Tag: <Tag className="w-6 h-6" />,
  CreditCard: <CreditCard className="w-6 h-6" />,
  Wallet: <Wallet className="w-6 h-6" />,
  MessageSquare: <MessageSquare className="w-6 h-6" />,
  FileText: <FileText className="w-6 h-6" />,
  Play: <Play className="w-6 h-6" />,
  Check: <Check className="w-6 h-6" />,
  PartyPopper: <PartyPopper className="w-6 h-6" />,
};

// Custom hooks for animations
function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !hasStarted) {
            setHasStarted(true);
          }
        },
        { threshold: 0.5 }
      );
      observer.observe(ref.current);
      return () => observer.disconnect();
    }
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    let startTime: number;
    let animationFrame: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [hasStarted, end, duration]);

  return { count, ref };
}

function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

export const availableIcons = Object.keys(iconMap);

interface EditableIconProps {
  iconName: string;
  sectionId: string;
  fieldPath: string;
  isEditing?: boolean;
  onEdit?: (sectionId: string, fieldPath: string, value: string, fieldType: 'text' | 'image' | 'icon') => void;
  className?: string;
}

function EditableIcon({ iconName, sectionId, fieldPath, isEditing, onEdit, className = "" }: EditableIconProps) {
  const isUrl = iconName && (iconName.startsWith('http') || iconName.startsWith('/'));
  const icon = isUrl 
    ? <img src={iconName} alt="아이콘" className="w-6 h-6 object-contain" />
    : (iconMap[iconName] || <Star className="w-6 h-6" />);
  
  if (!isEditing || !onEdit) {
    return <div className={className}>{icon}</div>;
  }
  
  return (
    <div 
      className={`${className} relative group cursor-pointer hover:bg-primary/20 rounded-full transition-colors`}
      onClick={(e) => {
        e.stopPropagation();
        onEdit(sectionId, fieldPath, iconName || '', 'icon');
      }}
      data-testid={`editable-icon-${sectionId}-${fieldPath}`}
    >
      {icon}
      <span className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-primary text-primary-foreground text-xs px-1 py-0.5 rounded transition-opacity z-10">
        아이콘
      </span>
    </div>
  );
}

interface SectionProps {
  data: PageSection["data"];
  sectionId: string;
  isEditing?: boolean;
  onClick?: () => void;
  onFieldEdit?: (sectionId: string, fieldPath: string, currentValue: string, fieldType: 'text' | 'image' | 'icon') => void;
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
                <EditableIcon
                  iconName={item.icon || 'Star'}
                  sectionId={sectionId}
                  fieldPath={`items.${index}.icon`}
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                />
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

// Hero Advanced Section with stats counter and promo badge
function HeroAdvancedSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  if (!data) return null;
  const stats = data.stats || [];
  
  return (
    <section
      className={`relative min-h-screen flex items-center justify-center overflow-hidden ${isEditing ? "cursor-pointer" : ""}`}
      style={{
        backgroundImage: data.backgroundImage 
          ? `linear-gradient(135deg, rgba(17, 24, 39, 0.85) 0%, rgba(17, 24, 39, 0.75) 100%), url('${data.backgroundImage}')`
          : 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      data-testid="section-hero-advanced"
    >
      {/* Promo Badge */}
      {data.promoBadge && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-10">
          <a 
            href={data.promoBadgeLink || "#"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: 'white' }}
          >
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <EditableField
              value={data.promoBadge}
              sectionId={sectionId}
              fieldPath="promoBadge"
              fieldType="text"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              as="span"
            />
          </a>
        </div>
      )}

      <div className="container text-center pt-32 pb-20">
        {data.title && (
          <EditableField
            value={data.title}
            sectionId={sectionId}
            fieldPath="title"
            fieldType="text"
            isEditing={isEditing}
            onEdit={onFieldEdit}
            as="h1"
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 text-white"
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
            as="p"
            className="text-base sm:text-lg md:text-xl mb-4 font-medium text-white/90"
          />
        )}
        {data.description && (
          <EditableField
            value={data.description}
            sectionId={sectionId}
            fieldPath="description"
            fieldType="text"
            isEditing={isEditing}
            onEdit={onFieldEdit}
            as="p"
            className="text-sm sm:text-base md:text-lg mb-10 text-white/70"
          />
        )}

        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mb-16">
          {data.buttonText && data.buttonLink && (
            <Link href={data.buttonLink}>
              <button className="ts-btn ts-btn-primary text-base px-8 py-3">
                {data.buttonText}
              </button>
            </Link>
          )}
          {data.secondaryButtonText && data.secondaryButtonLink && (
            <Link href={data.secondaryButtonLink}>
              <button className="ts-btn ts-btn-outline-white text-base px-8 py-3">
                {data.secondaryButtonText}
              </button>
            </Link>
          )}
        </div>

        {/* Stats Counter */}
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-xl mx-auto">
            {stats.map((stat: any, index: number) => (
              <StatCounter key={index} stat={stat} sectionId={sectionId} index={index} isEditing={isEditing} onFieldEdit={onFieldEdit} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatCounter({ stat, sectionId, index, isEditing, onFieldEdit }: { stat: any; sectionId: string; index: number; isEditing?: boolean; onFieldEdit?: any }) {
  const counter = useCountUp(parseInt(stat.value) || 0, 2000);
  return (
    <div className="text-center" ref={counter.ref}>
      <div 
        className="text-3xl sm:text-4xl md:text-5xl font-extrabold"
        style={{ color: stat.color || 'var(--ts-accent-green)' }}
      >
        {counter.count}{stat.suffix || ''}
      </div>
      <EditableField
        value={stat.label || ''}
        sectionId={sectionId}
        fieldPath={`stats.${index}.label`}
        fieldType="text"
        isEditing={isEditing}
        onEdit={onFieldEdit}
        as="div"
        className="text-xs sm:text-sm mt-2 text-white/60"
      />
    </div>
  );
}

// Image + Text Section (side by side)
function ImageTextSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  const anim = useScrollAnimation();
  if (!data) return null;
  const isLight = data.theme !== 'dark';
  const imageFirst = data.layout !== 'text-image';
  
  return (
    <section
      className={`${isLight ? 'ts-section-light' : 'ts-section-dark'} ${isEditing ? "cursor-pointer" : ""}`}
      data-testid="section-image-text"
    >
      <div className="container">
        {(data.sectionTitle || data.sectionSubtitle) && (
          <div 
            ref={anim.ref}
            className={`text-center mb-12 transition-all duration-700 ${anim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {data.sectionSubtitle && (
              <span className="subtitle-label mb-3" style={{ color: isLight ? 'var(--ts-primary)' : 'var(--ts-accent-cyan)' }}>
                {data.sectionSubtitle}
              </span>
            )}
            {data.sectionTitle && (
              <EditableField
                value={data.sectionTitle}
                sectionId={sectionId}
                fieldPath="sectionTitle"
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="h2"
                className={`h2-section mb-4 ${isLight ? '' : 'text-white'}`}
              />
            )}
            {data.sectionDescription && (
              <EditableField
                value={data.sectionDescription}
                sectionId={sectionId}
                fieldPath="sectionDescription"
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="p"
                className={`body-text max-w-2xl mx-auto ${isLight ? '' : 'text-white/70'}`}
              />
            )}
          </div>
        )}
        <div 
          ref={!data.sectionTitle ? anim.ref : undefined}
          className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center transition-all duration-700 ${anim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Image */}
          <div className={imageFirst ? 'order-2 lg:order-1' : 'order-2'}>
            <div className="rounded-2xl overflow-hidden shadow-xl">
              <EditableImage
                src={data.imageUrl || 'https://via.placeholder.com/600x450'}
                alt={data.imageAlt || '이미지'}
                sectionId={sectionId}
                fieldPath="imageUrl"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
          </div>
          {/* Content */}
          <div className={imageFirst ? 'order-1 lg:order-2' : 'order-1'}>
            <EditableField
              value={data.title || ''}
              sectionId={sectionId}
              fieldPath="title"
              fieldType="text"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              as="h3"
              className={`text-xl sm:text-2xl md:text-3xl font-bold mb-6 ${isLight ? '' : 'text-white'}`}
              style={{ color: isLight ? 'var(--ts-navy)' : 'white' }}
            />
            {data.paragraphs?.map((p: string, i: number) => (
              <EditableField
                key={i}
                value={p}
                sectionId={sectionId}
                fieldPath={`paragraphs.${i}`}
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="p"
                className={`body-text mb-4 text-base leading-relaxed ${i === (data.paragraphs.length - 1) ? 'font-medium' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Video Gallery Section
function VideoGallerySection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const anim = useScrollAnimation();
  if (!data) return null;
  const videos = data.videos || [];
  
  return (
    <section className="ts-section-dark" data-testid="section-video-gallery">
      {/* Video Modal */}
      {activeVideoId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setActiveVideoId(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={() => setActiveVideoId(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <div className="w-full max-w-4xl aspect-video mx-4" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      <div className="container">
        <div 
          ref={anim.ref}
          className={`text-center mb-12 transition-all duration-700 ${anim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {data.subtitle && (
            <span className="subtitle-label mb-3" style={{ color: 'var(--ts-accent-cyan)' }}>
              {data.subtitle}
            </span>
          )}
          {data.title && (
            <EditableField
              value={data.title}
              sectionId={sectionId}
              fieldPath="title"
              fieldType="text"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              as="h2"
              className="h2-section mb-4 text-white"
            />
          )}
          {data.description && (
            <EditableField
              value={data.description}
              sectionId={sectionId}
              fieldPath="description"
              fieldType="text"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              as="p"
              className="body-text text-white/70"
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {videos.slice(0, 5).map((video: any, index: number) => (
            <div
              key={`${video.id}-${index}`}
              className={`${index >= 3 ? 'hidden lg:block' : ''} ${index >= 2 && index < 3 ? 'hidden sm:block' : ''}`}
            >
              <div 
                className="relative rounded-xl overflow-hidden cursor-pointer group aspect-video"
                onClick={() => setActiveVideoId(video.id)}
              >
                <img 
                  src={video.thumbnail || `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
                  alt={`비디오 ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center transition-colors group-hover:bg-white">
                    <Play className="w-6 h-6 text-red-600 ml-1" fill="currentColor" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Stats Cards Section (for delivery system style)
function StatsCardsSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  const anim = useScrollAnimation();
  if (!data) return null;
  const isLight = data.theme !== 'dark';
  const stats = data.stats || [];
  
  return (
    <section className={isLight ? 'ts-section-light' : 'ts-section-dark'} data-testid="section-stats-cards">
      <div className="container">
        <div 
          ref={anim.ref}
          className={`text-center mb-12 transition-all duration-700 ${anim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {data.subtitle && (
            <span className="subtitle-label mb-3" style={{ color: isLight ? 'var(--ts-primary)' : 'var(--ts-accent-cyan)' }}>
              {data.subtitle}
            </span>
          )}
          {data.title && (
            <EditableField
              value={data.title}
              sectionId={sectionId}
              fieldPath="title"
              fieldType="text"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              as="h2"
              className={`h2-section mb-4 ${isLight ? '' : 'text-white'}`}
            />
          )}
          {data.description && (
            <EditableField
              value={data.description}
              sectionId={sectionId}
              fieldPath="description"
              fieldType="text"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              as="p"
              className={`body-text max-w-3xl mx-auto ${isLight ? '' : 'text-white/70'}`}
            />
          )}
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-${stats.length} gap-6 max-w-3xl mx-auto`}>
          {stats.map((stat: any, index: number) => (
            <div 
              key={index} 
              className="text-center p-6 rounded-xl" 
              style={{ background: isLight ? 'var(--ts-gray-50)' : 'rgba(255,255,255,0.05)' }}
            >
              <div 
                className="text-4xl sm:text-5xl font-extrabold mb-2"
                style={{ color: stat.color || 'var(--ts-primary)' }}
              >
                {stat.value}
              </div>
              <EditableField
                value={stat.label || ''}
                sectionId={sectionId}
                fieldPath={`stats.${index}.label`}
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="div"
                className={`text-sm ${isLight ? 'text-gray-600' : 'text-white/70'}`}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Icon Cards Section (for benefits style - 4 columns)
function IconCardsSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  const anim = useScrollAnimation();
  if (!data) return null;
  const isLight = data.theme !== 'dark';
  const items = data.items || [];
  
  return (
    <section className={isLight ? 'ts-section-light' : 'ts-section-dark'} data-testid="section-icon-cards">
      <div className="container">
        <div 
          ref={anim.ref}
          className={`transition-all duration-700 ${anim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-12">
            {data.subtitle && (
              <span className="subtitle-label mb-3" style={{ color: isLight ? 'var(--ts-primary)' : 'var(--ts-accent-cyan)' }}>
                {data.subtitle}
              </span>
            )}
            {data.title && (
              <EditableField
                value={data.title}
                sectionId={sectionId}
                fieldPath="title"
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="h2"
                className={`h2-section mb-4 ${isLight ? '' : 'text-white'}`}
              />
            )}
            {data.description && (
              <EditableField
                value={data.description}
                sectionId={sectionId}
                fieldPath="description"
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="p"
                className={`body-text max-w-3xl mx-auto ${isLight ? '' : 'text-white/70'}`}
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {items.map((item: any, index: number) => (
              <div 
                key={index} 
                className="text-center p-6 rounded-xl"
                style={{ 
                  background: isLight ? 'white' : 'rgba(255,255,255,0.05)', 
                  border: isLight ? '1px solid var(--ts-border)' : '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <div 
                  className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center"
                  style={{ background: item.iconBg || 'rgba(93,122,242,0.2)' }}
                >
                  <EditableIcon
                    iconName={item.icon || 'Star'}
                    sectionId={sectionId}
                    fieldPath={`items.${index}.icon`}
                    isEditing={isEditing}
                    onEdit={onFieldEdit}
                    className={`${item.iconColor ? '' : 'text-primary'}`}
                  />
                </div>
                <EditableField
                  value={item.title || ''}
                  sectionId={sectionId}
                  fieldPath={`items.${index}.title`}
                  fieldType="text"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  as="h3"
                  className={`font-bold text-lg mb-2 ${isLight ? '' : 'text-white'}`}
                />
                <EditableField
                  value={item.description || ''}
                  sectionId={sectionId}
                  fieldPath={`items.${index}.description`}
                  fieldType="text"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  as="p"
                  className={`text-sm ${isLight ? 'text-gray-600' : 'text-white/60'}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// CTA Advanced Section with gradient and benefits list
function CTAAdvancedSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  const anim = useScrollAnimation();
  if (!data) return null;
  const benefits = data.benefits || [];
  
  return (
    <section
      className="py-20"
      style={{ background: 'linear-gradient(135deg, var(--ts-primary) 0%, #4338ca 100%)' }}
      data-testid="section-cta-advanced"
    >
      <div className="container">
        <div 
          ref={anim.ref}
          className={`text-center transition-all duration-700 ${anim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Promo Badge */}
          {data.promoBadge && (
            <a 
              href={data.promoBadgeLink || "#"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 transition-colors hover:opacity-90"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              <PartyPopper className="w-4 h-4" />
              {data.promoBadge}
            </a>
          )}

          {data.title && (
            <EditableField
              value={data.title}
              sectionId={sectionId}
              fieldPath="title"
              fieldType="text"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              as="h2"
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4 text-white"
            />
          )}
          {data.description && (
            <EditableField
              value={data.description}
              sectionId={sectionId}
              fieldPath="description"
              fieldType="text"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              as="p"
              className="body-text max-w-2xl mx-auto mb-8 text-white/90"
            />
          )}

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            {data.buttonText && data.buttonLink && (
              <Link href={data.buttonLink}>
                <button 
                  className="w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-base transition-colors hover:opacity-90"
                  style={{ background: 'white', color: 'var(--ts-primary)' }}
                >
                  {data.buttonText}
                </button>
              </Link>
            )}
            {data.secondaryButtonText && data.secondaryButtonLink && (
              <Link href={data.secondaryButtonLink}>
                <button 
                  className="w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-base transition-colors hover:opacity-90"
                  style={{ background: 'transparent', color: 'white', border: '2px solid white' }}
                >
                  {data.secondaryButtonText}
                </button>
              </Link>
            )}
          </div>

          {/* Benefits List */}
          {benefits.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {benefits.map((benefit: string, index: number) => (
                <div 
                  key={index}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                  <Check className="w-4 h-4" style={{ color: 'var(--ts-accent-green)' }} />
                  <span className="text-sm font-medium text-white">{benefit}</span>
                </div>
              ))}
            </div>
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
          case "hero_advanced":
            return <HeroAdvancedSection key={sectionId} {...commonProps} />;
          case "heading":
            return <HeadingSection key={sectionId} {...commonProps} />;
          case "text":
            return <TextSection key={sectionId} {...commonProps} />;
          case "image":
            return <ImageSection key={sectionId} {...commonProps} />;
          case "image_text":
          case "text_image":
            return <ImageTextSection key={sectionId} {...commonProps} />;
          case "button":
            return <ButtonSection key={sectionId} {...commonProps} />;
          case "divider":
            return <DividerSection key={sectionId} {...commonProps} />;
          case "cards":
            return <CardsSection key={sectionId} {...commonProps} />;
          case "features":
            return <FeaturesSection key={sectionId} {...commonProps} />;
          case "video_gallery":
            return <VideoGallerySection key={sectionId} {...commonProps} />;
          case "stats_cards":
            return <StatsCardsSection key={sectionId} {...commonProps} />;
          case "icon_cards":
            return <IconCardsSection key={sectionId} {...commonProps} />;
          case "cta":
            return <CTASection key={sectionId} {...commonProps} />;
          case "cta_advanced":
            return <CTAAdvancedSection key={sectionId} {...commonProps} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
