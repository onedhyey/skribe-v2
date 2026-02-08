import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-2xl cursor-pointer select-none";

    // Faux 3D button styles with gradients and inset shadows
    const variants = {
      // Dark primary button - similar to the image
      primary: [
        "bg-gradient-to-b from-[#2d2d2d] to-[#1a1a1a]",
        "text-white",
        "border border-[#3a3a3a] border-b-[#0d0d0d]",
        "shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]",
        "hover:from-[#363636] hover:to-[#1f1f1f]",
        "hover:shadow-[0_6px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]",
        "hover:-translate-y-0.5",
        "active:translate-y-0 active:shadow-[0_2px_6px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]",
        "active:from-[#252525] active:to-[#171717]",
      ].join(" "),
      // Light secondary button
      secondary: [
        "bg-gradient-to-b from-[#fafafa] to-[#ededed]",
        "text-[#1a1a1a]",
        "border border-[#d4d4d4] border-b-[#b8b8b8]",
        "shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]",
        "hover:from-[#ffffff] hover:to-[#f2f2f2]",
        "hover:shadow-[0_6px_16px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,1)]",
        "hover:-translate-y-0.5",
        "active:translate-y-0 active:shadow-[0_2px_6px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)]",
        "active:from-[#f0f0f0] active:to-[#e5e5e5]",
      ].join(" "),
      // Outline uses the light secondary style
      outline: [
        "bg-gradient-to-b from-[#fafafa] to-[#ededed]",
        "text-[#1a1a1a]",
        "border border-[#d4d4d4] border-b-[#b8b8b8]",
        "shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]",
        "hover:from-[#ffffff] hover:to-[#f2f2f2]",
        "hover:shadow-[0_6px_16px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,1)]",
        "hover:-translate-y-0.5",
        "active:translate-y-0 active:shadow-[0_2px_6px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)]",
        "active:from-[#f0f0f0] active:to-[#e5e5e5]",
      ].join(" "),
      // Ghost stays minimal
      ghost: [
        "text-primary",
        "hover:bg-primary-light",
        "active:bg-muted",
      ].join(" "),
      // Destructive with red 3D effect
      destructive: [
        "bg-gradient-to-b from-[#ef4444] to-[#dc2626]",
        "text-white",
        "border border-[#f87171] border-b-[#b91c1c]",
        "shadow-[0_4px_12px_rgba(220,38,38,0.35),inset_0_1px_0_rgba(255,255,255,0.15)]",
        "hover:from-[#f87171] hover:to-[#ef4444]",
        "hover:shadow-[0_6px_16px_rgba(220,38,38,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]",
        "hover:-translate-y-0.5",
        "active:translate-y-0 active:shadow-[0_2px_6px_rgba(220,38,38,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]",
        "active:from-[#dc2626] active:to-[#b91c1c]",
      ].join(" "),
    };

    const sizes = {
      sm: "h-8 px-3 text-sm",
      md: "h-9 px-4 text-sm",
      lg: "h-11 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
