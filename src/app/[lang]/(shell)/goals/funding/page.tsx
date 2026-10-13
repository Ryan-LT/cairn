import type { Metadata } from "next";

import { messagesFor } from "@/shared/i18n/active";
import { isLocale } from "@/shared/i18n/locale";
import { AllocationsPage } from "@/views/allocations";

export async function generateMetadata({ params }: PageProps<"/[lang]/goals/funding">): Promise<Metadata> {
  const { lang } = await params;
  const t = messagesFor(isLocale(lang) ? lang : "en");
  return { title: `${t.nav.tabs.goalsFunding.label} · ${t.nav.hubs.goals.label}` };
}

export default function Page() {
  return <AllocationsPage />;
}
