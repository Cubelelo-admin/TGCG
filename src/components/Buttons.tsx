import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

const sizes = {
  md: "px-7 py-3 text-sm",
  lg: "px-9 py-4 text-base",
};

export function PrimaryButton({
  href,
  children,
  size = "md",
  className = "",
  ...rest
}: {
  href?: string;
  children: ReactNode;
  size?: keyof typeof sizes;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = `${base} ${sizes[size]} bg-gradient-to-br from-[#f97316] to-[#b91c1c] text-white shadow-[0_14px_32px_-10px_rgba(185,28,28,0.55)] hover:brightness-105 ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  href,
  children,
  size = "md",
  className = "",
  ...rest
}: {
  href?: string;
  children: ReactNode;
  size?: keyof typeof sizes;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = `${base} ${sizes[size]} border-[1.5px] border-[#17181a] text-[#17181a] hover:bg-[#17181a] hover:text-[#f6ede1] ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
