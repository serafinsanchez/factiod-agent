# AI Video Workflow Generator — "Factoids Video Builder"

Build a modern, dark-themed Next.js workflow application for generating AI-powered educational videos. The app guides users through a 5-stage pipeline where each stage's outputs become inputs for the next. It uses a sophisticated LLM-driven agent system with editable prompts, real-time token/cost tracking, and multiple AI service integrations.

## Tech Stack
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS with dark theme
- shadcn/ui components (Card, Button, Input, RadioGroup, etc.)
- React hooks for state management

---

## Application Layout

### Header Navigation Bar (Fixed Top)
A dark header bar spanning full width with:
- **Left**: "Exit" button (muted green/olive accent, links back to project list or home)
- **Center**: 5 stage tabs in a horizontal row, separated by subtle vertical dividers
  - "Script + Audio" (active state: white text)
  - "Timing + Storyboard"
  - "Imagery"
  - "Video Gen"
  - "Publishing"
- Active tab is highlighted (white/bright text), inactive tabs are muted (gray text)
- Background: dark maroon/brown gradient or solid dark color (#2d1f1f or similar warm dark)

### Main Content Area
- Full-width below header
- White/light background
- Content centered with max-width ~600px
- Generous vertical spacing between form fields
- Clean, minimal aesthetic

---

## Stage 1: Script + Audio

A vertical form layout with each step as a row:

### Layout Pattern for Each Step Row:
```
Label (left)     |  Input Field (center)     |  [Run] button  |  Expand link
```

### Steps in Order:

1. **Topic**
   - Text input field with placeholder "Genre" or similar
   - No run button (this is the starting input)

2. **Model Selector**
   - Radio group with options:
     - GPT 5.1 Thinking ○
     - Claude 4.5 ● (selected)
   - [Run] button | Expand link

3. **Key Concepts**
   - Textarea labeled "Prompt"
   - [Run] button (blue) | Expand link

4. **Hook**
   - Textarea labeled "Prompt"
   - [Run] button (blue) | Expand link

5. **Quiz Generation**
   - Textarea labeled "Prompt"
   - [Run] button (blue) | Expand link

### Stage 2 Section Header
Simple text divider: "Stage 2"

6. **Script Generation**
   - Textarea labeled "Prompt"
   - [Run] button (blue) | Expand link

7. **Script QA**
   - Textarea labeled "Prompt"
   - [Run] button (blue) | Expand link

8. **ElevenLabs Audio Tags**
   - Textarea labeled "Prompt"
   - [Run] button (blue) | Expand link

9. **Audio Model**
    - Radio group with options:
      - Jane (v3) ○
      - Peter (v2) ● (selected)
    - [Run] button (blue) | Expand link

10. **Download Audio**
    - Text link "Download Audio" (underlined)

---

## Stage 2: Timing + Storyboard (TO BUILD)

Same form layout pattern. Steps:

1. **Script Sectioning**
   - Input: Full script
   - Output: Script split into 6 sections with headers
   - Textarea for prompt | [Run] | Expand

2. **Section Headers**
   - Display/edit the 6 section titles
   - Editable list or 6 text inputs

3. **Storyboard Descriptions**
   - For each of the 6 sections, generate visual descriptions
   - Could be 6 textareas or an expandable accordion
   - [Run All] button or individual run buttons per section

---

## Stage 3: Imagery (TO BUILD)

1. **Scene Breakdown**
   - Input: Storyboard descriptions
   - Output: ~15 image prompts per section (90 total)
   - Textarea for master prompt | [Run] | Expand

2. **Image Generation**
   - Progress indicator: "Generating 0/90"
   - Grid of image thumbnails as they generate
   - Each image card: thumbnail + regenerate button

3. **Download Images**
   - Link: "Download All Images (ZIP)"

---

## Stage 4: Video Gen (TO BUILD)

1. **Motion Prompts**
   - For each image, generate a video motion prompt
   - Textarea for master prompt | [Run All] | Expand

2. **Video Generation**
   - Progress: "Generating 0/90 clips"
   - Grid of video clip thumbnails with play buttons
   - Each clip: 6 seconds, preview player

3. **Download Videos**
   - Link: "Download All Clips (ZIP)"

---

## Stage 5: Publishing

1. **Title Generation**
   - Textarea for prompt | [Run] | Expand
   - Output: Generated title displayed below

2. **Description Generation**
   - Textarea for prompt | [Run] | Expand
   - Output: Generated description displayed below

3. **Thumbnail Prompt**
   - Textarea for prompt | [Run] | Expand
   - Output: Generated image prompt

4. **Thumbnail Image**
   - [Generate Thumbnail] button
   - Display generated 16:9 thumbnail
   - Download link

---

## Component Patterns

### Step Row (Collapsed State)
```
┌────────────────────────────────────────────────────────────────┐
│  Step Label          │  [Prompt textarea]  │  [Run]  │ Expand  │
│  (2 lines max)       │  (placeholder text) │  (blue) │ (link)  │
└────────────────────────────────────────────────────────────────┘
```

### Step Row (Expanded State)
```
┌────────────────────────────────────────────────────────────────┐
│  Step Label          │  [Prompt textarea]  │  [Run]  │ Collapse│
│                      │  (full height)      │  (blue) │ (link)  │
├────────────────────────────────────────────────────────────────┤
│  Output:                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Generated text output...                                │  │
│  └──────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────┤
│  Tokens: 234 in / 567 out  •  Cost: $0.002  •  Time: 2.3s     │
└────────────────────────────────────────────────────────────────┘
```

### Radio Group Pattern
```
┌─────────────────────────────────────┐
│  Option A                        ○  │
│  Option B                        ●  │
└─────────────────────────────────────┘
```

---

## Visual Design

### Header
- Background: Dark warm tone (#2d1f1f, #3d2525, or dark maroon/brown)
- Exit button: Muted olive/sage green background (#a8b87a), dark text
- Tab text: White for active, muted gray for inactive
- Subtle vertical dividers between tabs (1px, semi-transparent white)

### Main Content
- Background: White or very light gray (#fafafa)
- Text: Dark gray/black
- Borders: Light gray (#e5e5e5)
- Buttons: Solid blue (#2563eb) with white text
- Links: Underlined, dark text
- Input fields: White background, light border, rounded corners

### Typography
- Clean sans-serif (system font or Inter)
- Step labels: Medium weight, slightly smaller
- Section headers: "Stage 2" in muted gray, small caps optional

---

## Interaction States

1. **Run Button**
   - Default: Blue background, white text
   - Hover: Darker blue
   - Loading: "Running..." with spinner
   - Disabled: Grayed out when prerequisites missing

2. **Expand/Collapse**
   - Text link that toggles step expansion
   - Shows output panel, metrics, and full prompt when expanded

3. **Tab Navigation**
   - Clicking a tab switches to that stage's content
   - Smooth transition between stages
   - URL updates to reflect active stage (e.g., /stage/script-audio)

---

## Data Flow

```
Topic → Key Concepts → Hook → Quiz → Script → Script QA → Narration → Audio Tags → Audio
                                         ↓
                              Script Sections → Storyboard
                                         ↓
                                   Scene Images (×90)
                                         ↓
                                   Video Clips (×90)
                                         ↓
                              Title + Description + Thumbnail
```

---

## Key Features

1. **Sequential Pipeline**: Each step's output feeds into the next
2. **Editable Prompts**: Every prompt textarea is user-editable
3. **Expand/Collapse**: Steps collapsed by default, expand to see full output and metrics
4. **Model Selection**: Choose LLM model (GPT 5.1, Claude 4.5) and audio model (Jane v3, Peter v2)
5. **Stage Navigation**: Tabbed header to jump between the 5 main stages
6. **Download Links**: Export audio, images, videos at relevant stages
7. **Cost Tracking**: Show token counts and USD cost per step when expanded

Build this as a clean, minimal interface with clear visual hierarchy. The layout should feel like a professional form-based workflow tool, not a complex dashboard.

