import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
  priority?: boolean;
};

/** Official Trackbook CRM mark — use everywhere (marketing, login, CRM shell). */
export function BrandLogo({
  className,
  size = 40,
  showText = false,
  textClassName,
  priority = false,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/trackbook-crm.png"
        alt="Trackbook CRM"
        width={size}
        height={size}
        priority={priority}
        className="rounded-xl shadow-sm"
      />
      {showText && (
        <span
          className={cn(
            "font-[family-name:var(--font-syne)] text-lg font-extrabold tracking-tight text-[#0B3D4A]",
            textClassName,
          )}
        >
          Trackbook <span className="text-[#E85D4C]">CRM</span>
        </span>
      )}
    </span>
  );
}
