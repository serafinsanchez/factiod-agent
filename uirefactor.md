I need you to refactor and redesign my Next.js application (`src/app/page.tsx` and related components) to achieve a professional, high-end interface similar to OpenAI's internal tools or ChatGPT.

**Current State:**
- `src/app/page.tsx` is a 1700+ line monolithic file containing all state, logic, and UI.
- The UI is cluttered with too many buttons and vertical scrolling, making it hard to track the generation flow.
- "Projects" are in a sidebar, but the flow within a project (Plan -> Script -> Publish) is disjointed.

**Goals:**
1. **Refactor Architecture:** Break `page.tsx` into smaller, focused components.
2. **Redesign UI/UX:** Implement a "Clean, Minimalist, Professional" aesthetic (refined typography, subtle borders, better whitespace).
3. **Improve Workflow:** Create a logical progression for the user, moving from one stage to the next without overwhelming them.
4. **Content Organization:** Make generated content (Scripts, Audio, Images) easy to find and distinct from the configuration/prompts.

**Specific Requirements & Plan:**

### 1. New Component Structure
Create a new directory structure under `src/components/agent/` and move logic out of `page.tsx`:

- **`AgentShell.tsx`**: The main layout wrapper containing the Sidebar and Main Content Area.
- **`ProjectSidebar.tsx`**: A clean, organizing list of history/saved projects. Include a "New Project" button at the top.
- **`StageNavigator.tsx`**: A visual stepper or tab system (e.g., "1. Plan", "2. Script", "3. Publish") to clearly show progress.
- **`StageView.tsx`**: The container that renders the active stage's steps.
- **`StepEditor.tsx`**: A refined version of `StepCard`. Separates the "Prompt/Configuration" (Input) from the "Result/Preview" (Output). Consider a collapsible "Advanced" section for the prompt to reduce clutter.
- **`OutputPreview.tsx`**: A dedicated component for viewing final assets (Markdown rendered script, Audio player, Image viewer) cleanly.

### 2. Layout & Visual Design
- **Sidebar**: Fixed width (e.g., 260px), dark subtle background (`bg-zinc-950`), with list items that have subtle hover states (`hover:bg-zinc-900`).
- **Main Area**: centered content, max-width ~800px for readability.
- **Colors**: Use a refined dark theme. Replace harsh black/amber contrasts with softer zinc grays (`zinc-900` for bg, `zinc-800` for borders, `zinc-400` for secondary text). Use a primary accent color (e.g., a soft blue or white) sparingly for primary actions.
- **Typography**: Use `Geist Sans` (already installed). Ensure clear hierarchy between headings, labels, and body text.

### 3. Logic Refactoring
- Extract the `pipeline` state management into a custom hook `useAgentPipeline()` in a new file `src/hooks/use-agent-pipeline.ts`. This hook should handle loading, saving, and updating step state.
- Extract API calls (run step, save, etc.) into a separate service module if not already done, or keep them clean within the hook.

### 4. Implementation Steps for You:
1.  **Create the Hook**: Move the state logic from `page.tsx` to `src/hooks/use-agent-pipeline.ts`.
2.  **Create the Shell**: Build `AgentShell` and `ProjectSidebar` to handle the high-level layout.
3.  **Create the Stage Views**: Implement `StageNavigator` and the sub-components for each step.
4.  **Refactor Page**: Wipe `src/app/page.tsx` and replace it with the new `AgentShell` implementation that uses the hook.

**Technical constraints:**
- Use existing `shadcn/ui` components (`Card`, `Button`, `Input`, `Textarea`, etc.) from `@/components/ui`.
- Keep the existing data types (`PipelineState`, `StepConfig`) from `types/agent.ts`.
- Ensure all current functionality (Generate Text, Generate Audio, Generate Image, Save/Load Project) is preserved, just moved.

Please start by creating the `useAgentPipeline` hook to separate the logic, then build the UI components one by one.