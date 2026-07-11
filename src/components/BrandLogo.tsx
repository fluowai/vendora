import { Bot, PhoneCall } from "lucide-react";
import { cn } from "@/src/lib/utils";

type BrandLogoProps = {
  compact?: boolean
  className?: string
  markClassName?: string
  textClassName?: string
  variant?: "default" | "voice"
};

export const BRAND_NAME = "Woo Tech IA";
export const ENGINE_ONE_NAME = "WooTech IA 1";
export const ENGINE_TWO_NAME = "WooTech IA 2";

export function BrandLogo({
  compact = false,
  className,
  markClassName,
  textClassName,
  variant = "default",
}: BrandLogoProps) {
  const Icon = variant === "voice" ? PhoneCall : Bot;

  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      <div
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm",
          markClassName,
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-secondary" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <span className={cn("block truncate font-display text-lg font-bold tracking-normal text-text", textClassName)}>
            {BRAND_NAME}
          </span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            atendimento e voz
          </span>
        </div>
      )}
    </div>
  );
}
