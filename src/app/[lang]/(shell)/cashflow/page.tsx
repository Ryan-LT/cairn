import type { Metadata } from "next";
import { Suspense } from "react";

import { messagesFor } from "@/shared/i18n/active";
import { isLocale } from "@/shared/i18n/locale";
import { CashflowMonthPage } from "@/views/cashflow";

export async function generateMetadata({ params }: PageProps<"/[lang]/cashflow">): Promise<Metadata> {
  const { lang } = await params;
  const t = messagesFor(isLocale(lang) ? lang : "en");
  return { title: `${t.nav.tabs.cashflowMonth.label} · ${t.nav.hubs.cashflow.label}` };
}

export default function Page() {
  return (
    <Suspense>
      <CashflowMonthPage />
    </Suspense>
  );
}
