"use client";

import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";

interface Prompt {
  id: string;
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}

interface PromptAccordionProps {
  prompts: Prompt[];
}

export function PromptAccordion({ prompts }: PromptAccordionProps) {
  return (
    <Accordion>
      {prompts.map((prompt) => (
        <AccordionItem
          key={prompt.id}
          title={prompt.title}
          description={prompt.description}
        >
          <Textarea
            value={prompt.value}
            onChange={(e) => prompt.onChange(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            placeholder="Enter prompt template..."
          />
        </AccordionItem>
      ))}
    </Accordion>
  );
}
