import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../globals.css";

import { notFound } from "next/navigation";

import { ServiceWorkerRegistrar } from "@/app/_providers/sw-register";
import { ThemeProvider } from "@/app/_providers/theme-provider";
import { BRAND } from "@/shared/config";
import { I18nProvider, isLocale, LOCALES, messagesFor } from "@/shared/i18n";
import { PRIVACY_BOOT_SCRIPT } from "@/shared/lib/privacy-boot";
import { Toaster } from "@/shared/ui/kit/sonner";
import { TooltipProvider } from "@/shared/ui/kit/tooltip";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Both languages are prerendered; the proxy rewrites `/goals` to `/vi/goals` or `/en/goals`. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const t = messagesFor(isLocale(lang) ? lang : "en");
  return {
    title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
    description: t.common.description,
    applicationName: BRAND.name,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: BRAND.name,
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1e1c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Privacy mode is per device: blur amounts before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: PRIVACY_BOOT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider locale={lang}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
            <Toaster
              richColors
              closeButton
              position="bottom-right"
              mobileOffset={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
            />
          </ThemeProvider>
        </I18nProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
