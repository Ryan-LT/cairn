import type { Metadata } from "next";

import { messagesFor } from "@/shared/i18n/active";
import { isLocale } from "@/shared/i18n/locale";
import { ConnectPage } from "@/views/connect";

export async function generateMetadata({ params }: PageProps<"/[lang]/settings/connect">): Promise<Metadata> {
  const { lang } = await params;
  const t = messagesFor(isLocale(lang) ? lang : "en");
  return { title: `${t.nav.tabs.settingsConnect.label} · ${t.nav.hubs.settings.label}` };
}

export default function Page() {
  return <ConnectPage />;
}
