"use client";

import { type HTMLAttributes, useCallback, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

type SupportedTag = "span" | "div" | "p" | "h4";

interface TruncatedTooltipProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  text: string;
  as?: SupportedTag;
  tooltipClassName?: string;
}

export function TruncatedTooltip({
  text,
  as = "span",
  className,
  tooltipClassName,
  onMouseEnter,
  onFocus,
  ...props
}: TruncatedTooltipProps) {
  const [isOverflowed, setIsOverflowed] = useState(false);
  const textRef = useRef<HTMLElement | null>(null);
  const Component = as;

  const checkOverflow = useCallback(() => {
    const node = textRef.current;
    if (!node) return;

    const hasHorizontalOverflow = node.scrollWidth > node.clientWidth;
    const hasVerticalOverflow = node.scrollHeight > node.clientHeight;
    setIsOverflowed(hasHorizontalOverflow || hasVerticalOverflow);
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Component
          ref={textRef}
          className={cn("block truncate", className)}
          onMouseEnter={(event) => {
            checkOverflow();
            onMouseEnter?.(event);
          }}
          onFocus={(event) => {
            checkOverflow();
            onFocus?.(event);
          }}
          {...props}
        >
          {text}
        </Component>
      </TooltipTrigger>
      {isOverflowed ? <TooltipContent className={tooltipClassName}>{text}</TooltipContent> : null}
    </Tooltip>
  );
}

