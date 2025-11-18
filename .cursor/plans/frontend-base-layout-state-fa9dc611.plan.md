<!-- fa9dc611-a99e-4085-a395-872922a43345 e1bde767-c99f-4733-b2ab-edade8c3fa4f -->
# Phase 5 – Frontend: Base Layout & State

## Overview

Build a single-page application with global controls and 6 step cards. Use Tailwind CSS and shadcn/ui components. Color scheme: black and grey tones with tan highlights for a sleek, modern look.

## Implementation Steps

### 1. Set up shadcn/ui

- Initialize shadcn/ui configuration (`components.json`)
- Install required dependencies (`@radix-ui/react-*` packages)
- Set up component directory structure (`src/components/ui/`)
- Configure Tailwind to work with shadcn (update `tailwind.config` if needed)
- Install initial shadcn components: `Input`, `Select`, `Card`, `Button`, `Label`

### 2. Update global styles

- Modify `src/app/globals.css` to add tan color variables
- Set up dark theme with black/grey base and tan accents
- Ensure Tailwind v4 configuration supports the color scheme

### 3. Create StepCard component

- Create `src/components/StepCard.tsx` as a client component
- Props interface:
  - `stepConfig: StepConfig`
  - `stepState: StepRunState`
  - `sharedVars: Record<string, string>` (topic + outputs)
  - `onRunStep: (stepId: StepId) => void`
  - `onPromptChange: (stepId: StepId, newTemplate: string) => void`
  - `onResetPrompt: (stepId: StepId) => void`
- UI structure:
  - Step title (from `stepConfig.label`)
  - Read-only prompt template display (from `stepState.resolvedPrompt` or `stepConfig.promptTemplate`)
  - Empty output area (placeholder for `stepState.responseText`)
  - Status indicator (idle/running/success/error)
- Style with black/grey background, tan accents

### 4. Transform page.tsx to client component

- Convert `src/app/page.tsx` to `"use client"`
- Import types: `StepId`, `StepRunState`, `ModelId`, `StepConfig` from `types/agent.ts`
- Import `STEP_CONFIGS` from `lib/agent/steps.ts`
- State management:
  - `topic: string` (initial: empty string)
  - `model: ModelId` (initial: `'gpt5-thinking'`)
  - `steps: Record<StepId, StepRunState>` (initialize from `STEP_CONFIGS`)
  - `sharedOutputs: Record<string, string>` (keyConcepts, hookScript, etc.)
  - `totalTokens: number` (initial: 0)
  - `totalCostUsd: number` (initial: 0)
- Initialize `steps` state:
```typescript
const initialSteps: Record<StepId, StepRunState> = {
  keyConcepts: { id: 'keyConcepts', status: 'idle', resolvedPrompt: '', responseText: '' },
  hook: { id: 'hook', status: 'idle', resolvedPrompt: '', responseText: '' },
  quizzes: { id: 'quizzes', status: 'idle', resolvedPrompt: '', responseText: '' },
  script: { id: 'script', status: 'idle', resolvedPrompt: '', responseText: '' },
  titleDescription: { id: 'titleDescription', status: 'idle', resolvedPrompt: '', responseText: '' },
  thumbnail: { id: 'thumbnail', status: 'idle', resolvedPrompt: '', responseText: '' },
};
```


### 5. Build top bar UI

- Create top bar section with:
  - Topic text input (shadcn `Input` component)
  - Model selector (shadcn `Select` component with options: `'gpt5-thinking'`, `'kimik2-thinking'`)
  - Tokens/cost display (placeholder showing `totalTokens` and `totalCostUsd`)
- Style with dark background, tan accents

### 6. Render step cards

- Map over `STEP_CONFIGS` array
- For each step, render `<StepCard />` with:
  - `stepConfig={config}`
  - `stepState={steps[config.id]}`
  - `sharedVars` (combine topic + sharedOutputs)
  - Handler functions (stubs for now - will be implemented in next phase)
- Layout: Grid or flex layout for responsive step cards

### 7. Handler stubs

- `onRunStep(stepId: StepId)`: Empty function for now
- `onPromptChange(stepId: StepId, newTemplate: string)`: Empty function for now
- `onResetPrompt(stepId: StepId)`: Reset prompt to default from `stepConfig.promptTemplate`

## Files to Create/Modify

**New files:**

- `components.json` - shadcn/ui configuration
- `src/components/StepCard.tsx` - Step card component
- `src/components/ui/input.tsx` - shadcn Input component
- `src/components/ui/select.tsx` - shadcn Select component
- `src/components/ui/card.tsx` - shadcn Card component
- `src/components/ui/button.tsx` - shadcn Button component
- `src/components/ui/label.tsx` - shadcn Label component

**Modified files:**

- `src/app/page.tsx` - Convert to client component with state and layout
- `src/app/globals.css` - Add tan color variables and theme updates
- `package.json` - Add shadcn/ui dependencies

## Design Notes

- Color palette: Black (`#000000` or `#0a0a0a`), grey tones (`#1a1a1a`, `#2a2a2a`, `#404040`), tan highlights (`#d4a574`, `#c9a082`, or similar)
- Modern, sleek aesthetic with clean spacing
- Responsive layout for different screen sizes