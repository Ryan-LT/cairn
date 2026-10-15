import type { Metadata } from "next";

import { messagesFor } from "@/shared/i18n/active";
import { isLocale } from "@/shared/i18n/locale";
import { SharedReportPage } from "@/views/shared-report";

export async function generateMetadata({ params }: PageProps<"/[lang]/share">): Promise<Metadata> {
  const { lang } = await params;
  const t = messagesFor(isLocale(lang) ? lang : "en");
  return { title: t.connect.view.title, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/** Public: the report id is in the URL hash and the password unlocks it (see /api/shares/view). */
export default function Page() {
  return <SharedReportPage />;
}
