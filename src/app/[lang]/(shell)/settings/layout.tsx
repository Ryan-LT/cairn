import { HubLayout } from "@/widgets/app-shell";

export default function Layout({ children }: LayoutProps<"/[lang]/settings">) {
  return <HubLayout hub="settings">{children}</HubLayout>;
}
