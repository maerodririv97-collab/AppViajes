import {
  BedDouble,
  Bus,
  Plane,
  ShoppingBag,
  Ticket,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const CATEGORIES: { name: string; icon: LucideIcon; color: string }[] = [
  { name: "Vuelos", icon: Plane, color: "bg-sky-100 text-sky-700" },
  { name: "Hospedaje", icon: BedDouble, color: "bg-violet-100 text-violet-700" },
  { name: "Transporte", icon: Bus, color: "bg-amber-100 text-amber-700" },
  { name: "Comida", icon: Utensils, color: "bg-rose-100 text-rose-700" },
  { name: "Actividades", icon: Ticket, color: "bg-emerald-100 text-emerald-700" },
  { name: "Compras", icon: ShoppingBag, color: "bg-fuchsia-100 text-fuchsia-700" },
  { name: "Otros", icon: Wallet, color: "bg-slate-100 text-slate-700" },
];

export function categoryMeta(name: string) {
  return CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1];
}
