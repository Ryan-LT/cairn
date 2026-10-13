import { HubLayout } from "@/widgets/app-shell";

export default function Layout({ children }: LayoutProps<"/[lang]/goals">) {
  return <HubLayout hub="goals">{children}</HubLayout>;
}
