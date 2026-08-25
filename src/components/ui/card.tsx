import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-line bg-card shadow-[0_1px_2px_rgba(18,22,31,0.04)]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card };
