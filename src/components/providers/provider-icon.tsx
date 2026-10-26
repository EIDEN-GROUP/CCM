import Image from "next/image";
import { Activity, BadgeDollarSign, Camera, ChartPie, Eye, Mail, Plug, Search, Tags, TrendingUp, Users, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const SIMPLE_ICON_ASSETS = new Set([
  "google",
  "google_ads",
  "ga4",
  "gsc",
  "gtm",
  "youtube",
  "gmail",
  "meta",
  "instagram",
  "tiktok",
  "linkedin",
  "pagespeed",
]);

const FALLBACK_ICONS: Record<string, LucideIcon> = {
  google_ads: BadgeDollarSign,
  ga4: ChartPie,
  gsc: Search,
  gtm: Tags,
  youtube: Video,
  gmail: Mail,
  meta: Users,
  instagram: Camera,
  tiktok: Video,
  ahrefs: TrendingUp,
  clarity: Eye,
  pagespeed: Activity,
  uptime: Activity,
};

/** Local Simple Icons brand marks with neutral CCM icons where no mark exists. */
export function ProviderIcon({
  providerKey,
  className = "size-5",
}: {
  providerKey: string;
  className?: string;
}) {
  if (SIMPLE_ICON_ASSETS.has(providerKey)) {
    return (
      <Image
        src={`/provider-icons/${providerKey}.svg`}
        width={24}
        height={24}
        alt=""
        aria-hidden="true"
        className={className}
      />
    );
  }

  const Icon = FALLBACK_ICONS[providerKey] ?? Plug;
  return <Icon aria-hidden="true" className={className} />;
}
