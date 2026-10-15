"use client";

import { TabContent, useShell } from "@/widgets/app-shell";

import { SharesSection } from "./shares-section";
import { WebhookSection } from "./webhook-section";

/** Settings → Connect & share: bank webhook keys and password-protected report links. */
export function ConnectPage() {
  const { authEnabled } = useShell();
  return (
    <TabContent className="max-w-3xl">
      <WebhookSection enabled={authEnabled} />
      <SharesSection enabled={authEnabled} />
    </TabContent>
  );
}
