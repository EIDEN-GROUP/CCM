import {
  Activity,
  BadgeDollarSign,
  Bell,
  Briefcase,
  Camera,
  ChartPie,
  Eye,
  FileText,
  Globe,
  LayoutDashboard,
  Mail,
  Plug,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  TrendingUp,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon registry.
 *
 * Navigation and provider tiles reference icons by name so that the mapping
 * stays serialisable (it is used in the provider registry, which is also
 * consumed by non-React code).
 *
 * Note: lucide v1 removed the brand marks (Instagram, LinkedIn, YouTube), so
 * each platform uses a neutral stand-in that reads correctly in a grid.
 */
export const ICONS: Record<string, LucideIcon> = {
  Activity,
  BadgeDollarSign,
  Bell,
  Briefcase,
  Camera,
  ChartPie,
  Eye,
  FileText,
  Globe,
  LayoutDashboard,
  Mail,
  Plug,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  TrendingUp,
  Users,
  Video,
};

/** Provider key to icon name. */
export const PROVIDER_ICONS: Record<string, string> = {
  google_ads: "BadgeDollarSign",
  ga4: "ChartPie",
  gsc: "Search",
  gtm: "Tags",
  youtube: "Video",
  gmail: "Mail",
  meta: "Users",
  instagram: "Camera",
  linkedin: "Briefcase",
  ahrefs: "TrendingUp",
  clarity: "Eye",
  pagespeed: "Activity",
  uptime: "Activity",
};

export function getIcon(name: string): LucideIcon {
  return ICONS[name] ?? Activity;
}
