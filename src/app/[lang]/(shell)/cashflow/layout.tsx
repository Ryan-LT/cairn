import { HubLayout } from "@/widgets/app-shell";

export default function Layout({ children }: LayoutProps<"/[lang]/cashflow">) {
  return <HubLayout hub="cashflow">{children}</HubLayout>;
}
