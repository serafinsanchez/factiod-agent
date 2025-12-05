import * as React from "react";
import { cn } from "@/lib/utils";

interface AccordionItemProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ title, description, children, defaultOpen = false }, ref) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen);

    return (
      <div
        ref={ref}
        className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50"
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex-1">
            <div className="font-medium text-white">{title}</div>
            {description && (
              <div className="text-sm text-zinc-400 mt-0.5">{description}</div>
            )}
          </div>
          <svg
            className={cn(
              "w-5 h-5 text-zinc-400 transition-transform",
              isOpen && "rotate-180"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 pt-2 border-t border-zinc-800">
            {children}
          </div>
        )}
      </div>
    );
  }
);
AccordionItem.displayName = "AccordionItem";

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ children, className }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        {children}
      </div>
    );
  }
);
Accordion.displayName = "Accordion";

export { Accordion, AccordionItem };
