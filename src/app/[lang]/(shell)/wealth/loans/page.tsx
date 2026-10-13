import type { Metadata } from "next";
import { Suspense } from "react";

import { messagesFor } from "@/shared/i18n/active";
import { isLocale } from "@/shared/i18n/locale";
import { LoansPage } from "@/views/loans";

export async function generateMetadata({ params }: PageProps<"/[lang]/wealth/loans">): Promise<Metadata> {
  const { lang } = await params;
  const t = messagesFor(isLocale(lang) ? lang : "en");
  return { title: `${t.nav.tabs.wealthLoans.label} · ${t.nav.hubs.wealth.label}` };
}

export default function Page() {
  return (
    <Suspense>
      <LoansPage />
    </Suspense>
  );
}
