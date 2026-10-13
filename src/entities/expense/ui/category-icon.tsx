import {
  Car,
  CreditCard,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  Package,
  Palmtree,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { IconTile } from "@/shared/ui/icon-tile";

import { EXPENSE_CATEGORY_META } from "../config/categories";
import type { ExpenseCategoryId } from "../model";

export const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategoryId, LucideIcon> = {
  housing: House,
  utilities: Zap,
  food: UtensilsCrossed,
  transport: Car,
  debt: CreditCard,
  insurance: ShieldCheck,
  health: HeartPulse,
  education: GraduationCap,
  family: HandHeart,
  giving: Gift,
  subscriptions: Repeat,
  shopping: ShoppingBag,
  leisure: Palmtree,
  other: Package,
};

/** The category's icon on its tinted tile (decoration: always shown next to a name). */
export function CategoryTile({ category, size = "md", className }: { category: ExpenseCategoryId; size?: "sm" | "md" | "lg"; className?: string }) {
  const meta = EXPENSE_CATEGORY_META[category] ?? EXPENSE_CATEGORY_META.other;
  return <IconTile icon={EXPENSE_CATEGORY_ICONS[category] ?? Package} color={meta.color} background={meta.soft} size={size} className={className} />;
}
