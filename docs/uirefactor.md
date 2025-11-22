# Agent UI Refactor — Multi-Phase Plan

The goal is to deliver a professional, OpenAI-grade experience for the agent workflow in `src/app/page.tsx` by iteratively modernizing the architecture, layout, and UX while keeping feature parity.

## Phase Overview

| Phase | Focus | Status | Key Outcomes |
| --- | --- | --- | --- |
| 0 | Baseline + Vision | ✅ Complete | Current pain points & goals captured |
| 1 | Architecture Extraction | ✅ Complete | `useAgentPipeline`, lean `page.tsx`, dark theme baseline |
| 2 | Layout & Navigation | 🚧 In Progress | `AgentShell`, `ProjectSidebar`, stage navigation |
| 3 | Stage Experience | ⏳ Next | `StageView`, `StepEditor`, `OutputPreview` refinements |
| 4 | Workflow & Persistence | ⏳ Next | Smooth Plan → Script → Publish flow, save/load polish |
| 5 | Polish, A11y, Perf, Tests | ⏳ Next | Refer to `docs/ui-refactor-improvement-plan.md` |

---

## Phase 0 — Baseline & Vision (Complete)
- **Current State**: `src/app/page.tsx` held ~1,700 lines of intertwined UI + logic; UI cluttered with competing buttons and excessive scroll; project flow unclear.
- **Vision**: Clean, minimalist, professional interface with refined typography, softer zinc palette, and a clear Plan → Script → Publish progression.
- **Success Criteria**: Architecture modularized, visual hierarchy clarified, and generated assets easy to discover independently from configuration inputs.

## Phase 1 — Architecture Extraction (Complete)
- **Objective**: Establish a scalable foundation that isolates data flow from presentation.
- **Key Actions**
  - Extract pipeline state into `src/hooks/use-agent-pipeline.ts`, encapsulating load/save/run logic.
  - Strip `src/app/page.tsx` down to an orchestrator (~23 lines) that mounts the new shell.
  - Set up the `src/components/agent/` hierarchy for future decomposition.
  - Apply the refined dark theme tokens (zinc palette + Geist Sans defaults) to prove the visual direction.

## Phase 2 — Layout & Navigation (In Progress)
- **Objective**: Provide a stable layout skeleton that keeps context visible while focusing the working area.
- **Deliverables**
  - `AgentShell.tsx`: High-level frame with sidebar + main content, max-width ~800px center column.
  - `ProjectSidebar.tsx`: Fixed 260 px rail with “New Project” CTA, hoverable history list, and save-state indicators.
  - `StageNavigator.tsx`: Stepper/tabs for “1. Plan”, “2. Script”, “3. Publish” with visible active state, optional substatus (e.g., Draft/Done).
  - Responsive spacing rules (padding, section headers, typography scale) aligned to the professional aesthetic.
- **Notes**: Maintain shadcn primitives (`Card`, `Button`, etc.) to reduce bespoke styling.

## Phase 3 — Stage Experience (Queued)
- **Objective**: Make each stage self-contained, legible, and balanced between configuration (input) and output previews.
- **Deliverables**
  - `StageView.tsx`: Routes the active stage and hydrates its steps from the pipeline hook.
  - `StepEditor.tsx`: Successor to `StepCard` with clear Input vs. Output columns, collapsible “Advanced Prompt” block, and consistent CTAs.
  - `OutputPreview.tsx`: Dedicated surface for rendered markdown, audio playback, and image viewing with appropriate affordances.
- **Workflow Enhancements**
  - Emphasize primary actions (Generate, Save) with accent color; demote secondary actions.
  - Keep generated artifacts pinned as the user moves between stages so progress is obvious.

## Phase 4 — Workflow & Persistence (Queued)
- **Objective**: Ensure the Plan → Script → Publish journey feels linear, stateful, and resilient.
- **Tasks**
  - Wire StageNavigator events into `useAgentPipeline` so navigation respects prerequisites and handles in-flight runs.
  - Harden project persistence (save/load, rename, delete) and expose status cues in the sidebar.
  - Surface toast/inline feedback for API calls, errors, and auto-save checkpoints.
  - Confirm all legacy capabilities (text/audio/image generation) remain functional after the split.

## Phase 5 — Polish, Accessibility, Performance, Testing (Queued)
- **Scope**: Comprehensive refinement as outlined in `docs/ui-refactor-improvement-plan.md` (7 sub-phases, 20–27 hours).
- **Highlights**
  - Break the 1,300-line hook into focused hooks (data loading, mutations, derived selectors, effects, UI helpers).
  - Decompose dense components (AgentShell, StepEditor) into smaller pieces for readability and testing.
  - Add skeleton/loading states, optimistic interactions, subtle animations, keyboard shortcuts, and ARIA labeling.
  - Optimize memoization, lazy loading, and bundle footprint.
  - Add unit, integration, and E2E coverage plus final documentation/cleanup.

---

### Technical Guardrails
- Continue using shadcn components from `@/components/ui`.
- Preserve existing types such as `PipelineState` and `StepConfig` from `types/agent.ts`.
- Maintain all functional parity (text/audio/image generation + project persistence) through each phase.

### Next Immediate Step
Proceed with Phase 2 completion: finalize `AgentShell`, `ProjectSidebar`, and `StageNavigator`, then lock in spacing/typography tokens before deeper stage work.