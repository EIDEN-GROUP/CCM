import type { Metadata, Viewport } from "next";
import { Heebo, Noto_Sans_Arabic } from "next/font/google";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { directionFor } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

const heebo = Heebo({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-heebo-src",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-arabic-src",
});

export const metadata: Metadata = {
  title: {
    default: "CCM — Command Center Management",
    template: "%s · CCM",
  },
  description:
    "Marketing, growth and digital operations command center for Medical Bay, Agadir.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4bbdbd",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dir = directionFor(locale);

  return (
    <html lang={locale} dir={dir} className={`${heebo.variable} ${notoArabic.variable}`}>
      <body className="min-h-dvh bg-surface text-secondary antialiased">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
