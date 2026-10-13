import { CashflowHubSummary } from "@/views/cashflow";
import { HubLayout } from "@/widgets/app-shell";

export default function Layout({ children }: LayoutProps<"/[lang]/cashflow">) {
  return (
    <HubLayout hub="cashflow" summary={<CashflowHubSummary />}>
      {children}
    </HubLayout>
  );
}
