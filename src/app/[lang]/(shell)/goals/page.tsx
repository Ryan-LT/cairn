import type { Metadata } from "next";
import { Suspense } from "react";

import { messagesFor } from "@/shared/i18n/active";
import { isLocale } from "@/shared/i18n/locale";
import { GoalsPage } from "@/views/goals";

export async function generateMetadata({ params }: PageProps<"/[lang]/goals">): Promise<Metadata> {
  const { lang } = await params;
  const t = messagesFor(isLocale(lang) ? lang : "en");
  return { title: `${t.nav.tabs.goalsPlans.label} · ${t.nav.hubs.goals.label}` };
}

export default function Page() {
  return (
    <Suspense>
      <GoalsPage />
    </Suspense>
  );
}
