import { WealthHubSummary } from "@/views/wealth";
import { HubLayout } from "@/widgets/app-shell";

export default function Layout({ children }: LayoutProps<"/[lang]/wealth">) {
  return (
    <HubLayout hub="wealth" summary={<WealthHubSummary />}>
      {children}
    </HubLayout>
  );
}
