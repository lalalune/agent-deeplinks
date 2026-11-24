import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { twMerge } from "tailwind-merge";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground hover:bg-accent-hover",
        outline: "border border-line bg-surface text-foreground hover:bg-raised",
        ghost: "text-muted hover:bg-raised hover:text-foreground",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { asChild, variant, size, className, ...props },
  ref,
) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      {...props}
      ref={ref}
      data-slot="button"
      className={twMerge(clsx(buttonVariants({ variant, size }), className))}
    />
  );
});
