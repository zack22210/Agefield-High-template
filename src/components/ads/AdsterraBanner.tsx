import { type BannerFormat, getBannerConfig } from "@/lib/ad-config";

type BannerType = `banner-${BannerFormat}`;

export interface AdBannerProps {
  format?: BannerFormat;
  type?: BannerType;
  adKey?: string;
  eager?: boolean;
  title?: string;
  className?: string;
}

type AdsterraBannerProps = {
  adKey?: string;
  size: BannerFormat;
  title?: string;
};

function resolveFormat(format?: BannerFormat, type?: BannerType): BannerFormat | null {
  if (format) return format;
  if (type?.startsWith("banner-")) return type.slice("banner-".length) as BannerFormat;
  return null;
}

export function AdBanner({ format, type, eager = true, title = "Advertisement", className = "" }: AdBannerProps) {
  const resolvedFormat = resolveFormat(format, type);
  if (!resolvedFormat) return null;

  const config = getBannerConfig(resolvedFormat);
  if (!config) return null;

  return (
    <div className={`flex w-full justify-center overflow-hidden ${className}`}>
      <iframe
        src={config.htmlPath}
        title={`${title} ${resolvedFormat}`}
        width={config.width}
        height={config.height}
        scrolling="no"
        loading={eager ? "eager" : "lazy"}
        referrerPolicy="no-referrer-when-downgrade"
        style={{ border: "none" }}
      />
    </div>
  );
}

export function AdsterraBanner({ size, title }: AdsterraBannerProps) {
  return (
    <div className="mt-[42px]">
      <AdBanner format={size} title={title} />
    </div>
  );
}
