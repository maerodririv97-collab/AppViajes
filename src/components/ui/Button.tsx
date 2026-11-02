import type { ButtonHTMLAttributes } from "react";
import { useReadOnly } from "./ReadOnly";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-teal-600 text-white hover:bg-teal-700 disabled:bg-teal-300",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300",
  ghost: "text-slate-600 hover:bg-slate-100 disabled:text-slate-300",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

export function Button({ variant = "primary", size = "md", className = "", ...rest }: Props) {
  if (useReadOnly()) return null;
  const sizing = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${sizing} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "default" | "danger";
}

export function IconButton({ tone = "default", className = "", ...rest }: IconButtonProps) {
  if (useReadOnly()) return null;
  const toneClass =
    tone === "danger"
      ? "text-slate-500 hover:bg-rose-50 hover:text-rose-600"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800";
  return (
    <button type="button" className={`rounded-md p-1.5 transition-colors ${toneClass} ${className}`} {...rest} />
  );
}
