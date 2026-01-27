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
  ImageIcon,
  Pencil,
  Video,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface DynamicPageRendererProps {
  content: PageContent | null;
  isEditing?: boolean;
  onSectionClick?: (section: PageSection) => void;
  onFieldEdit?: (sectionId: string, fieldPath: string, currentValue: string, fieldType: 'text' | 'image' | 'icon' | 'button') => void;
  onPositionChange?: (sectionId: string, contentAlign: 'left' | 'center' | 'right', contentVerticalAlign: 'top' | 'center' | 'bottom') => void;
}

interface EditableFieldProps {
  value: string;
  sectionId: string;
  fieldPath: string;
  fieldType: 'text' | 'image' | 'icon';
  isEditing?: boolean;
  onEdit?: (sectionId: string, fieldPath: string, value: string, fieldType: 'text' | 'image' | 'icon') => void;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

function EditableField({ value, sectionId, fieldPath, fieldType, isEditing, onEdit, className = "", as: Component = 'span', children, style }: EditableFieldProps) {
  const renderContent = () => {
    if (children) return children;
    // Check for any HTML tags (br, span, strong, em, etc.)
    if (value && /<[^>]+>/.test(value)) {
      return <span dangerouslySetInnerHTML={{ __html: value }} />;
    }
    return value;
  };

  if (!isEditing || !onEdit) {
    return <Component className={className} style={style}>{renderContent()}</Component>;
  }
  
  return (
    <Component 
      className={`${className} relative group cursor-pointer hover-elevate rounded`}
      style={style}
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
  style?: React.CSSProperties;
}

function EditableImage({ src, alt, sectionId, fieldPath, isEditing, onEdit, className = "", style }: EditableImageProps) {
  if (!isEditing || !onEdit) {
    return <img src={src} alt={alt} className={className} style={style} />;
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
      <img src={src} alt={alt} className={`${className} group-hover:opacity-80 transition-opacity`} style={style} />
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
  openInNewTab?: boolean;
  sectionId: string;
  fieldPath: string;
  isEditing?: boolean;
  onEdit?: (sectionId: string, fieldPath: string, value: string, fieldType: 'text' | 'image' | 'icon' | 'button') => void;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

function EditableButton({ text, link, openInNewTab = false, sectionId, fieldPath, isEditing, onEdit, variant = "default", size = "default", className = "" }: EditableButtonProps) {
  if (!isEditing) {
    return (
      <Button asChild variant={variant} size={size} className={className}>
        <Link href={link} target={openInNewTab ? "_blank" : undefined} rel={openInNewTab ? "noopener noreferrer" : undefined}>{text}</Link>
      </Button>
    );
  }
  
  return (
    <Button
      variant={variant}
      size={size}
      className={`${className} relative group`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onEdit) {
          onEdit(sectionId, fieldPath, `${text}|${link}|${openInNewTab}`, 'button');
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
      className={`${className} relative group cursor-pointer hover-elevate rounded-full`}
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
  onFieldEdit?: (sectionId: string, fieldPath: string, currentValue: string, fieldType: 'text' | 'image' | 'icon' | 'button') => void;
  onPositionChange?: (sectionId: string, contentAlign: 'left' | 'center' | 'right', contentVerticalAlign: 'top' | 'center' | 'bottom') => void;
  selectedElement?: { sectionId: string; fieldPath: string } | null;
  onElementSelect?: (element: { sectionId: string; fieldPath: string } | null) => void;
}

// Position Toolbar Component for editing mode
interface PositionToolbarProps {
  sectionId: string;
  currentAlign: 'left' | 'center' | 'right';
  currentVerticalAlign: 'top' | 'center' | 'bottom';
  onPositionChange: (sectionId: string, contentAlign: 'left' | 'center' | 'right', contentVerticalAlign: 'top' | 'center' | 'bottom') => void;
}

function PositionToolbar({ sectionId, currentAlign, currentVerticalAlign, onPositionChange }: PositionToolbarProps) {
  return (
    <div 
      className="absolute top-4 left-4 z-30 flex flex-col gap-2 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border p-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground px-1">
        <AlignCenter className="w-3 h-3" />
        <span>위치 조정</span>
      </div>
      
      {/* Horizontal Alignment */}
      <div className="flex gap-1">
        <Button
          size="icon"
          variant={currentAlign === 'left' ? 'default' : 'ghost'}
          onClick={() => onPositionChange(sectionId, 'left', currentVerticalAlign)}
          title="왼쪽 정렬"
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant={currentAlign === 'center' ? 'default' : 'ghost'}
          onClick={() => onPositionChange(sectionId, 'center', currentVerticalAlign)}
          title="가운데 정렬"
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant={currentAlign === 'right' ? 'default' : 'ghost'}
          onClick={() => onPositionChange(sectionId, 'right', currentVerticalAlign)}
          title="오른쪽 정렬"
        >
          <AlignRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Vertical Alignment */}
      <div className="flex gap-1">
        <Button
          size="icon"
          variant={currentVerticalAlign === 'top' ? 'default' : 'ghost'}
          onClick={() => onPositionChange(sectionId, currentAlign, 'top')}
          title="상단 정렬"
        >
          <AlignVerticalJustifyStart className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant={currentVerticalAlign === 'center' ? 'default' : 'ghost'}
          onClick={() => onPositionChange(sectionId, currentAlign, 'center')}
          title="중앙 정렬"
        >
          <AlignVerticalJustifyCenter className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant={currentVerticalAlign === 'bottom' ? 'default' : 'ghost'}
          onClick={() => onPositionChange(sectionId, currentAlign, 'bottom')}
          title="하단 정렬"
        >
          <AlignVerticalJustifyEnd className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function HeroSection({ data, sectionId, isEditing, onClick, onFieldEdit, onPositionChange }: SectionProps) {
  if (!data) return null;
  const description = data.text || data.description || "";
  const hasBackgroundImage = data.backgroundType === "image" && data.backgroundImage;
  
  // Get alignment values with defaults
  const contentAlign = data.contentAlign || 'center';
  const contentVerticalAlign = data.contentVerticalAlign || 'center';
  
  const getAlignClass = () => {
    switch (contentAlign) {
      case 'left': return 'text-left items-start';
      case 'right': return 'text-right items-end';
      default: return 'text-center items-center';
    }
  };
  
  const getButtonJustifyClass = () => {
    switch (contentAlign) {
      case 'left': return 'justify-start';
      case 'right': return 'justify-end';
      default: return 'justify-center';
    }
  };

  const getVerticalPaddingClass = () => {
    switch (contentVerticalAlign) {
      case 'top': return 'pt-8 pb-24';
      case 'bottom': return 'pt-24 pb-8';
      default: return 'py-16 md:py-24';
    }
  };
  
  return (
    <section
      className={`relative min-h-[400px] flex ${contentVerticalAlign === 'top' ? 'items-start' : contentVerticalAlign === 'bottom' ? 'items-end' : 'items-center'} ${!hasBackgroundImage ? "bg-gradient-to-br from-primary/10 to-primary/5" : ""} ${isEditing ? "cursor-pointer" : ""}`}
      data-testid="section-hero"
    >
      {/* Position Toolbar for editing mode */}
      {isEditing && onPositionChange && (
        <PositionToolbar
          sectionId={sectionId}
          currentAlign={contentAlign}
          currentVerticalAlign={contentVerticalAlign}
          onPositionChange={onPositionChange}
        />
      )}

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
      <div className={`container mx-auto px-4 ${getVerticalPaddingClass()} relative z-10 flex flex-col ${getAlignClass()} ${hasBackgroundImage ? "text-white" : ""}`}>
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
        <div className={`flex flex-wrap gap-4 ${getButtonJustifyClass()}`}>
          {data.buttonText && data.buttonLink && (
            <EditableButton
              text={data.buttonText}
              link={data.buttonLink}
              openInNewTab={data.buttonNewTab}
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
              openInNewTab={data.secondaryButtonNewTab}
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
              openInNewTab={data.buttonNewTab}
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
              openInNewTab={data.secondaryButtonNewTab}
              sectionId={sectionId}
              fieldPath="secondaryButton"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              variant="outline"
              size="lg"
              className="border-primary-foreground/50 text-primary-foreground"
            />
          )}
        </div>
      </div>
    </section>
  );
}

// Hero Advanced Section with stats counter and promo badge
function HeroAdvancedSection({ data, sectionId, isEditing, onClick, onFieldEdit, onPositionChange }: Omit<SectionProps, 'selectedElement' | 'onElementSelect'>) {
  if (!data) return null;
  const stats = data.stats || [];
  
  // Get alignment values with defaults
  const contentAlign = data.contentAlign || 'center';
  const contentVerticalAlign = data.contentVerticalAlign || 'center';
  
  // Calculate alignment classes
  const getHorizontalAlignClass = () => {
    switch (contentAlign) {
      case 'left': return 'items-start text-left';
      case 'right': return 'items-end text-right';
      default: return 'items-center text-center';
    }
  };
  
  const getVerticalAlignClass = () => {
    switch (contentVerticalAlign) {
      case 'top': return 'justify-start pt-32';
      case 'bottom': return 'justify-end pb-32';
      default: return 'justify-center';
    }
  };
  
  const getButtonJustifyClass = () => {
    switch (contentAlign) {
      case 'left': return 'justify-start';
      case 'right': return 'justify-end';
      default: return 'justify-center';
    }
  };
  
  const getStatsAlignClass = () => {
    switch (contentAlign) {
      case 'left': return 'mx-0';
      case 'right': return 'ml-auto mr-0';
      default: return 'mx-auto';
    }
  };
  
  return (
    <section
      className={`relative min-h-screen flex ${getVerticalAlignClass()} overflow-hidden ${isEditing ? "cursor-pointer" : ""}`}
      style={{
        backgroundImage: data.backgroundImage 
          ? `linear-gradient(135deg, rgba(17, 24, 39, 0.85) 0%, rgba(17, 24, 39, 0.75) 100%), url('${data.backgroundImage}')`
          : 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      data-testid="section-hero-advanced"
    >
      {/* Position Toolbar for editing mode */}
      {isEditing && onPositionChange && (
        <PositionToolbar
          sectionId={sectionId}
          currentAlign={contentAlign}
          currentVerticalAlign={contentVerticalAlign}
          onPositionChange={onPositionChange}
        />
      )}

      {/* Background Image Editor */}
      {isEditing && onFieldEdit && (
        <div
          className="absolute top-4 right-4 z-20 cursor-pointer group"
          onClick={(e) => {
            e.stopPropagation();
            onFieldEdit(sectionId, "backgroundImage", data.backgroundImage || "", "image");
          }}
          data-testid={`editable-image-${sectionId}-backgroundImage`}
        >
          <div className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg">
            <ImageIcon className="w-4 h-4" />
            <span className="text-sm font-medium">배경 이미지 변경</span>
          </div>
        </div>
      )}

      {/* Promo Badge - positioned based on alignment */}
      {data.promoBadge && (
        <div className={`absolute top-24 z-10 ${contentAlign === 'left' ? 'left-8' : contentAlign === 'right' ? 'right-8' : 'left-1/2 -translate-x-1/2'}`}>
          <a 
            href={data.promoBadgeLink || "#"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
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

      {/* Content container */}
      <div className="container py-20">
        <div className={`flex flex-col ${getHorizontalAlignClass()}`}>
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
          <div className={`flex flex-wrap gap-4 ${getButtonJustifyClass()} mb-16`}>
            {data.buttonText && (
              <EditableButton
                text={data.buttonText}
                link={data.buttonLink || "#"}
                openInNewTab={data.buttonNewTab}
                sectionId={sectionId}
                fieldPath="button"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                className="ts-btn ts-btn-primary text-base px-8 py-3"
              />
            )}
            {data.secondaryButtonText && (
              <EditableButton
                text={data.secondaryButtonText}
                link={data.secondaryButtonLink || "#"}
                openInNewTab={data.secondaryButtonNewTab}
                sectionId={sectionId}
                fieldPath="secondaryButton"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                className="ts-btn ts-btn-outline-white text-base px-8 py-3"
              />
            )}
          </div>

          {/* Stats Counter */}
          {stats.length > 0 && (
            <div className={`${getStatsAlignClass()}`}>
              <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-xl">
                {stats.map((stat: any, index: number) => (
                  <StatCounter key={index} stat={stat} sectionId={sectionId} index={index} isEditing={isEditing} onFieldEdit={onFieldEdit} />
                ))}
              </div>
            </div>
          )}
        </div>
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

function SliderStatCounter({ stat, sectionId, index, isEditing, onFieldEdit, slideIndex }: { stat: any; sectionId: string; index: number; isEditing?: boolean; onFieldEdit?: any; slideIndex: number }) {
  const [count, setCount] = useState(0);
  const targetValue = parseInt(stat.value) || 0;
  
  // Re-animate counter when slide changes
  useEffect(() => {
    setCount(0);
    const duration = 2000;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * targetValue));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [slideIndex, targetValue]);
  
  return (
    <div className="text-center">
      <div 
        className="text-2xl sm:text-3xl md:text-4xl font-extrabold"
        style={{ color: stat.color || 'var(--ts-accent-green)' }}
      >
        {count}{stat.suffix || ''}
      </div>
      <EditableField
        value={stat.label || ''}
        sectionId={sectionId}
        fieldPath={`stats.${index}.label`}
        fieldType="text"
        isEditing={isEditing}
        onEdit={onFieldEdit}
        as="div"
        className="text-xs sm:text-sm mt-1 text-white/70"
      />
    </div>
  );
}

// Hero Slider Section - Full-screen image slider with Fade + Ken Burns effect
function HeroSliderSection({ data, sectionId, isEditing, onFieldEdit }: SectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  if (!data) return null;
  
  const slides = data.slides || [];
  const slideDuration = data.slideDuration || 5500;
  const autoPlay = data.autoPlay !== false;
  
  // Start/stop auto-play
  useEffect(() => {
    if (autoPlay && slides.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % slides.length);
      }, slideDuration);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoPlay, slides.length, slideDuration, currentIndex]);
  
  const goToSlide = (index: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCurrentIndex(index);
  };
  
  const prevSlide = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length);
  };
  
  const nextSlide = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCurrentIndex(prev => (prev + 1) % slides.length);
  };
  
  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
  };
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevSlide();
      else if (e.key === 'ArrowRight') nextSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length]);
  
  if (slides.length === 0) {
    return (
      <section
        className="relative w-full h-screen bg-[#0a0a0a] flex items-center justify-center"
        data-testid="section-hero-slider"
      >
        <p className="text-white/50">슬라이드 이미지를 추가하세요</p>
      </section>
    );
  }
  
  return (
    <section
      className={`relative w-full h-screen overflow-hidden bg-[#0a0a0a] ${isEditing ? "cursor-pointer" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid="section-hero-slider"
    >
      {/* Slides */}
      {slides.map((slide: any, index: number) => (
        <div
          key={slide.id || index}
          className={`absolute inset-0 transition-opacity duration-[1500ms] ease-in-out overflow-hidden ${
            index === currentIndex ? 'opacity-100 z-[1]' : 'opacity-0 z-0'
          }`}
        >
          <img
            src={slide.imageUrl}
            alt={slide.imageAlt || `슬라이드 ${index + 1}`}
            className={`w-full h-full object-cover ${
              index === currentIndex ? 'animate-kenburns' : ''
            }`}
            style={{
              animationName: index === currentIndex ? `kenburns-${(index % 3) + 1}` : 'none',
            }}
          />
          {/* Image edit button in edit mode */}
          {isEditing && onFieldEdit && index === currentIndex && (
            <div
              className="absolute top-4 right-4 z-20 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onFieldEdit(sectionId, `slides.${index}.imageUrl`, slide.imageUrl || "", "image");
              }}
            >
              <div className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg">
                <ImageIcon className="w-4 h-4" />
                <span className="text-sm font-medium">이미지 {index + 1} 변경</span>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Content Overlay - Buttons and Stats */}
      {(data.buttonText || (data.stats && data.stats.length > 0)) && (
        <div className="absolute bottom-[120px] left-0 right-0 z-10 px-4 md:px-8">
          <div className="container mx-auto">
            {/* CTA Buttons */}
            {data.buttonText && (
              <div className="flex flex-wrap gap-3 md:gap-4 mb-8 justify-center md:justify-start">
                <EditableButton
                  text={data.buttonText}
                  link={data.buttonLink || "#"}
                  openInNewTab={data.buttonNewTab}
                  sectionId={sectionId}
                  fieldPath="button"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  className="ts-btn ts-btn-primary text-sm md:text-base px-6 md:px-8 py-2.5 md:py-3"
                />
                {data.secondaryButtonText && (
                  <EditableButton
                    text={data.secondaryButtonText}
                    link={data.secondaryButtonLink || "#"}
                    openInNewTab={data.secondaryButtonNewTab}
                    sectionId={sectionId}
                    fieldPath="secondaryButton"
                    isEditing={isEditing}
                    onEdit={onFieldEdit}
                    className="ts-btn ts-btn-outline-white text-sm md:text-base px-6 md:px-8 py-2.5 md:py-3"
                  />
                )}
              </div>
            )}
            
            {/* Stats Counter */}
            {data.stats && data.stats.length > 0 && (
              <div className="flex justify-center md:justify-start">
                <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-md">
                  {data.stats.map((stat: any, index: number) => (
                    <SliderStatCounter key={index} stat={stat} sectionId={sectionId} index={index} isEditing={isEditing} onFieldEdit={onFieldEdit} slideIndex={currentIndex} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Line-style Indicators */}
      <div className="absolute bottom-[50px] left-1/2 -translate-x-1/2 flex gap-4 z-10">
        {slides.map((_: any, index: number) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className="w-[50px] h-[3px] bg-white/30 rounded-sm overflow-hidden cursor-pointer transition-colors hover:bg-white/50"
            data-testid={`slider-indicator-${index}`}
          >
            <div
              className={`h-full bg-white rounded-sm ${
                index === currentIndex ? 'animate-progress' : 'w-0'
              }`}
              style={{
                animationDuration: index === currentIndex ? `${slideDuration}ms` : '0ms',
              }}
            />
          </button>
        ))}
      </div>

      {/* Navigation Arrows - show on hover (desktop only) */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className={`absolute top-1/2 left-10 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center z-10 transition-all duration-300 hover:bg-white/20 hover:scale-105 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            } hidden md:flex`}
            aria-label="이전 슬라이드"
            data-testid="slider-prev"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={nextSlide}
            className={`absolute top-1/2 right-10 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center z-10 transition-all duration-300 hover:bg-white/20 hover:scale-105 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            } hidden md:flex`}
            aria-label="다음 슬라이드"
            data-testid="slider-next"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </>
      )}

      {/* Ken Burns & Progress Animations CSS */}
      <style>{`
        @keyframes kenburns-1 {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.08) translate(-1%, -0.5%); }
        }
        @keyframes kenburns-2 {
          0% { transform: scale(1.05) translate(-1%, 0); }
          100% { transform: scale(1) translate(0.5%, 0.5%); }
        }
        @keyframes kenburns-3 {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.06) translate(0.5%, -1%); }
        }
        .animate-kenburns {
          animation-duration: 6s;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
        }
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-progress {
          animation-name: progress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </section>
  );
}

// Announcement Marquee Section - Scrolling notification bar with latest announcements
function AnnouncementMarqueeSection({ data, sectionId, isEditing, onClick }: SectionProps) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [animationDuration, setAnimationDuration] = useState(20);
  
  useEffect(() => {
    fetch('/api/announcements/latest?limit=5')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAnnouncements(data);
        }
      })
      .catch(err => console.error('Failed to load announcements:', err));
  }, []);
  
  useEffect(() => {
    if (marqueeRef.current && announcements.length > 0) {
      const contentWidth = marqueeRef.current.scrollWidth / 2;
      const duration = Math.max(15, contentWidth / 50);
      setAnimationDuration(duration);
    }
  }, [announcements]);
  
  if (announcements.length === 0) {
    return null;
  }
  
  return (
    <section
      className={`scroll-marquee-wrapper ${isEditing ? "cursor-pointer" : ""}`}
      onClick={isEditing ? onClick : undefined}
      data-testid="section-announcement-marquee"
      style={{
        position: 'relative',
        width: '100%',
        paddingTop: '6px',
        paddingBottom: '6px',
      }}
    >
      {/* Top scroll roll effect - Navy theme */}
      <div 
        className="scroll-roll-top pointer-events-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '6px',
          background: 'linear-gradient(to bottom, #0D1321 0%, #1F2937 40%, #374151 70%, #E5E7EB 100%)',
          borderRadius: '0 0 50% 50% / 0 0 100% 100%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 -1px 1px rgba(255,255,255,0.15)',
          zIndex: 20,
        }}
      />
      
      {/* Main content area - Light gray matching site */}
      <div
        className="scroll-content-area"
        style={{
          position: 'relative',
          width: '100%',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          background: 'linear-gradient(to bottom, #F9FAFB 0%, #F3F4F6 50%, #F9FAFB 100%)',
          color: '#1F2937',
          fontSize: '14px',
          fontWeight: 500,
          letterSpacing: '0.02em',
          boxShadow: 'inset 0 1px 2px rgba(17,24,39,0.05), inset 0 -1px 2px rgba(17,24,39,0.05)',
        }}
      >
        {/* Fixed [알림] label */}
        <div 
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 15,
            fontWeight: 700,
            color: '#DC2626',
            fontSize: '15px',
            letterSpacing: '0.05em',
          }}
        >
          [알림]
        </div>
        
        {/* Left mask - solid cover behind label */}
        <div 
          className="pointer-events-none" 
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '70px',
            height: '100%',
            background: 'linear-gradient(to bottom, #F9FAFB 0%, #F3F4F6 50%, #F9FAFB 100%)',
            zIndex: 10,
          }}
        />
        {/* Left fade gradient */}
        <div 
          className="pointer-events-none" 
          style={{
            position: 'absolute',
            left: '70px',
            top: 0,
            width: '30px',
            height: '100%',
            background: 'linear-gradient(to right, #F3F4F6, transparent)',
            zIndex: 10,
          }}
        />
        {/* Right fade gradient */}
        <div 
          className="pointer-events-none" 
          style={{
            position: 'absolute',
            right: '10%',
            top: 0,
            width: '5%',
            height: '100%',
            background: 'linear-gradient(to left, #F3F4F6, transparent)',
            zIndex: 10,
          }}
        />
        {/* Right mask - solid cover for 90-100% */}
        <div 
          className="pointer-events-none" 
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '10%',
            height: '100%',
            background: 'linear-gradient(to bottom, #F9FAFB 0%, #F3F4F6 50%, #F9FAFB 100%)',
            zIndex: 10,
          }}
        />
        
        {/* Marquee container */}
        <div 
          className="relative w-full h-full flex items-center overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div 
            ref={marqueeRef}
            className="marquee-track flex whitespace-nowrap"
            style={{
              animation: `seamless-scroll ${animationDuration}s linear infinite`,
              animationPlayState: isPaused ? 'paused' : 'running',
            }}
          >
            {/* First set of announcements */}
            {announcements.map((announcement, index) => (
              <Link
                key={`first-${announcement.id}-${index}`}
                href={`/board/notice/${announcement.id}`}
                className="inline-flex items-center transition-colors hover:text-[#5D7AF2] flex-shrink-0"
                style={{ padding: '0 3rem' }}
                data-testid={`announcement-link-${index}`}
              >
                {announcement.isImportant === 'true' && (
                  <span className="inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ background: '#FF6B00' }} />
                )}
                <span className="whitespace-nowrap">{announcement.title}</span>
              </Link>
            ))}
            {/* Duplicate set for seamless loop */}
            {announcements.map((announcement, index) => (
              <Link
                key={`second-${announcement.id}-${index}`}
                href={`/board/notice/${announcement.id}`}
                className="inline-flex items-center transition-colors hover:text-[#5D7AF2] flex-shrink-0"
                style={{ padding: '0 3rem' }}
                data-testid={`announcement-link-dup-${index}`}
              >
                {announcement.isImportant === 'true' && (
                  <span className="inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ background: '#FF6B00' }} />
                )}
                <span className="whitespace-nowrap">{announcement.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      
      {/* Bottom scroll roll effect - Navy theme */}
      <div 
        className="scroll-roll-bottom pointer-events-none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '6px',
          background: 'linear-gradient(to top, #0D1321 0%, #1F2937 40%, #374151 70%, #E5E7EB 100%)',
          borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
          boxShadow: '0 -1px 3px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.15)',
          zIndex: 20,
        }}
      />
      
      <style>{`
        @keyframes seamless-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @media (max-width: 768px) {
          .scroll-content-area {
            height: 28px !important;
            font-size: 14px !important;
          }
          .scroll-roll-top, .scroll-roll-bottom {
            height: 5px !important;
          }
          .scroll-marquee-wrapper {
            padding-top: 5px !important;
            padding-bottom: 5px !important;
          }
        }
      `}</style>
    </section>
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
              <EditableField
                value={data.sectionSubtitle}
                sectionId={sectionId}
                fieldPath="sectionSubtitle"
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="span"
                className="subtitle-label mb-3 inline-block"
                style={{ color: isLight ? 'var(--ts-primary)' : 'var(--ts-accent-cyan)' }}
              />
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
                className={`body-text mb-4 text-base leading-relaxed ${i === ((data.paragraphs?.length || 0) - 1) ? 'font-medium' : ''}`}
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
            <EditableField
              value={data.subtitle}
              sectionId={sectionId}
              fieldPath="subtitle"
              fieldType="text"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              as="span"
              className="subtitle-label mb-3 inline-block"
              style={{ color: 'var(--ts-accent-cyan)' }}
            />
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
              className={`${index >= 3 ? 'hidden lg:block' : ''} ${index >= 2 && index < 3 ? 'hidden sm:block' : ''} relative`}
            >
              {/* Edit button for video */}
              {isEditing && onFieldEdit && (
                <div
                  className="absolute top-2 right-2 z-10 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFieldEdit(sectionId, `videos.${index}.id`, video.id || "", "text");
                  }}
                  data-testid={`editable-video-${sectionId}-${index}`}
                >
                  <div className="flex items-center gap-1 bg-primary text-primary-foreground px-2 py-1 rounded shadow-lg">
                    <Video className="w-3 h-3" />
                    <span className="text-xs font-medium">편집</span>
                  </div>
                </div>
              )}
              <div 
                className="relative rounded-xl overflow-hidden cursor-pointer group aspect-video"
                onClick={() => !isEditing && setActiveVideoId(video.id)}
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
            <EditableField
              value={data.subtitle}
              sectionId={sectionId}
              fieldPath="subtitle"
              fieldType="text"
              isEditing={isEditing}
              onEdit={onFieldEdit}
              as="span"
              className="subtitle-label mb-3 inline-block"
              style={{ color: isLight ? 'var(--ts-primary)' : 'var(--ts-accent-cyan)' }}
            />
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
              <EditableField
                value={data.subtitle}
                sectionId={sectionId}
                fieldPath="subtitle"
                fieldType="text"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                as="span"
                className="subtitle-label mb-3 inline-block"
                style={{ color: isLight ? 'var(--ts-primary)' : 'var(--ts-accent-cyan)' }}
              />
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              <PartyPopper className="w-4 h-4" />
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
            {data.buttonText && (
              <EditableButton
                text={data.buttonText}
                link={data.buttonLink || "#"}
                openInNewTab={data.buttonNewTab}
                sectionId={sectionId}
                fieldPath="button"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                className="w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-base bg-white text-primary"
              />
            )}
            {data.secondaryButtonText && (
              <EditableButton
                text={data.secondaryButtonText}
                link={data.secondaryButtonLink || "#"}
                openInNewTab={data.secondaryButtonNewTab}
                sectionId={sectionId}
                fieldPath="secondaryButton"
                isEditing={isEditing}
                onEdit={onFieldEdit}
                className="w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-base bg-transparent text-white border-2 border-white"
              />
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
                  <EditableField
                    value={benefit}
                    sectionId={sectionId}
                    fieldPath={`benefits.${index}`}
                    fieldType="text"
                    isEditing={isEditing}
                    onEdit={onFieldEdit}
                    as="span"
                    className="text-sm font-medium text-white"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Content Two Blocks Section - 60% width, centered, two paragraphs with alternating backgrounds
function ContentTwoBlocksSection({ data, sectionId, isEditing, onClick, onFieldEdit }: SectionProps) {
  const anim1 = useScrollAnimation();
  const anim2 = useScrollAnimation();
  if (!data) return null;
  
  // Block 1 data (white background - text left, image right)
  const block1 = data.block1 || {};
  const block1Items = block1.items || [];
  
  // Block 2 data (gray/navy background - image left, text right)  
  const block2 = data.block2 || {};
  const block2Items = block2.items || [];
  
  return (
    <div data-testid="section-content-two-blocks">
      {/* Block 1: White background - Text Left, Image Right */}
      <section
        className="py-16 md:py-20"
        style={{ background: data.block1Bg || '#FFFFFF' }}
      >
        <div 
          ref={anim1.ref}
          className={`max-w-[90%] md:max-w-[60%] mx-auto transition-all duration-700 ${anim1.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Text Content - Left */}
            <div className="w-full md:w-1/2 order-2 md:order-1 flex flex-col justify-center">
              {/* Label */}
              {block1.label && (
                <EditableField
                  value={block1.label}
                  sectionId={sectionId}
                  fieldPath="block1.label"
                  fieldType="text"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  as="p"
                  className="text-xs md:text-sm font-semibold tracking-widest uppercase mb-3"
                  style={{ color: 'var(--ts-primary)' }}
                />
              )}
              
              {/* Title with highlight */}
              {block1.title && (
                <EditableField
                  value={block1.title}
                  sectionId={sectionId}
                  fieldPath="block1.title"
                  fieldType="text"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  as="h2"
                  className="text-lg md:text-xl lg:text-2xl font-bold mb-4 leading-tight"
                  style={{ color: '#111827' }}
                />
              )}
              
              {/* Description */}
              {block1.description && (
                <EditableField
                  value={block1.description}
                  sectionId={sectionId}
                  fieldPath="block1.description"
                  fieldType="text"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  as="p"
                  className="text-sm md:text-base text-gray-600 mb-6 leading-relaxed"
                />
              )}
              
              {/* Checklist Items */}
              {block1Items.length > 0 && (
                <ul className="space-y-3">
                  {block1Items.map((item: string, index: number) => (
                    <li key={index} className="flex items-start gap-3">
                      <span 
                        className="flex items-center justify-center flex-shrink-0 rounded"
                        style={{ 
                          width: '20px', 
                          height: '20px', 
                          background: 'var(--ts-primary)',
                          marginTop: '2px'
                        }}
                      >
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      </span>
                      <EditableField
                        value={item}
                        sectionId={sectionId}
                        fieldPath={`block1.items.${index}`}
                        fieldType="text"
                        isEditing={isEditing}
                        onEdit={onFieldEdit}
                        as="span"
                        className="text-sm md:text-base text-gray-700"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Image - Right */}
            <div className="w-full md:w-1/2 order-1 md:order-2">
              {block1.image && (
                <EditableImage
                  src={block1.image}
                  alt={block1.imageAlt || "Section image"}
                  sectionId={sectionId}
                  fieldPath="block1.image"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  className="w-full rounded-lg shadow-lg object-cover"
                  style={{ aspectRatio: '5/4' }}
                />
              )}
            </div>
          </div>
        </div>
      </section>
      
      {/* Block 2: Gray/Navy background - Image Left, Text Right */}
      <section
        className="py-16 md:py-20"
        style={{ background: data.block2Bg || '#F3F4F6' }}
      >
        <div 
          ref={anim2.ref}
          className={`max-w-[90%] md:max-w-[60%] mx-auto transition-all duration-700 ${anim2.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Image - Left */}
            <div className="w-full md:w-1/2">
              {block2.image && (
                <EditableImage
                  src={block2.image}
                  alt={block2.imageAlt || "Section image"}
                  sectionId={sectionId}
                  fieldPath="block2.image"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  className="w-full rounded-lg shadow-lg object-cover"
                  style={{ aspectRatio: '5/4' }}
                />
              )}
            </div>
            
            {/* Text Content - Right */}
            <div className="w-full md:w-1/2 flex flex-col justify-center">
              {/* Label */}
              {block2.label && (
                <EditableField
                  value={block2.label}
                  sectionId={sectionId}
                  fieldPath="block2.label"
                  fieldType="text"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  as="p"
                  className="text-xs md:text-sm font-semibold tracking-widest uppercase mb-3"
                  style={{ color: 'var(--ts-primary)' }}
                />
              )}
              
              {/* Title with highlight */}
              {block2.title && (
                <EditableField
                  value={block2.title}
                  sectionId={sectionId}
                  fieldPath="block2.title"
                  fieldType="text"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  as="h2"
                  className="text-lg md:text-xl lg:text-2xl font-bold mb-4 leading-tight"
                  style={{ color: '#111827' }}
                />
              )}
              
              {/* Description */}
              {block2.description && (
                <EditableField
                  value={block2.description}
                  sectionId={sectionId}
                  fieldPath="block2.description"
                  fieldType="text"
                  isEditing={isEditing}
                  onEdit={onFieldEdit}
                  as="p"
                  className="text-sm md:text-base text-gray-600 mb-6 leading-relaxed"
                />
              )}
              
              {/* Checklist Items */}
              {block2Items.length > 0 && (
                <ul className="space-y-3">
                  {block2Items.map((item: string, index: number) => (
                    <li key={index} className="flex items-start gap-3">
                      <span 
                        className="flex items-center justify-center flex-shrink-0 rounded"
                        style={{ 
                          width: '20px', 
                          height: '20px', 
                          background: 'var(--ts-primary)',
                          marginTop: '2px'
                        }}
                      >
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      </span>
                      <EditableField
                        value={item}
                        sectionId={sectionId}
                        fieldPath={`block2.items.${index}`}
                        fieldType="text"
                        isEditing={isEditing}
                        onEdit={onFieldEdit}
                        as="span"
                        className="text-sm md:text-base text-gray-700"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function DynamicPageRenderer({ content, isEditing, onSectionClick, onFieldEdit, onPositionChange }: DynamicPageRendererProps) {
  const [selectedElement, setSelectedElement] = useState<{ sectionId: string; fieldPath: string } | null>(null);
  
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
        const commonProps = { 
          data: sectionData, 
          sectionId, 
          isEditing, 
          onClick: handleClick, 
          onFieldEdit, 
          onPositionChange,
          selectedElement,
          onElementSelect: setSelectedElement
        };
        
        switch (section.type) {
          case "hero":
            return <HeroSection key={sectionId} {...commonProps} />;
          case "hero_advanced":
            return <HeroAdvancedSection key={sectionId} {...commonProps} />;
          case "hero_slider":
            return <HeroSliderSection key={sectionId} {...commonProps} />;
          case "announcement_marquee":
            return <AnnouncementMarqueeSection key={sectionId} {...commonProps} />;
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
          case "content_two_blocks":
            return <ContentTwoBlocksSection key={sectionId} {...commonProps} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
