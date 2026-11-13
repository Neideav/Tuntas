# 11 — Motion Animation System & Micro-Interactions

This document specifies the technical design, physics principles, design tokens, component library, and performance standards of the **Motion for React** (`motion`) animation system implemented in **Tuntas**.

---

## 1. Executive Summary & Design Vision

Tuntas is engineered to deliver a seamless, high-performance productivity and examination experience. Rather than behaving as a static CRUD web application, Tuntas leverages **Motion for React** (formerly Framer Motion) to establish an organic, responsive interface that provides purposeful visual feedback at every user interaction point.

### Core Philosophy
1. **Purposeful Feedback**: Every transition or micro-interaction communicates system state (e.g., button press compression, modal depth, list reorganization, metric progression).
2. **Zero Cognitive Friction**: Animations are fast, natural, and non-blocking. Critical user interactions (e.g., completing tasks, proctoring sync, question navigation) are never held hostage to artificial delays.
3. **Respect for Accessibility**: Respects OS-level accessibility preferences via `reducedMotion="user"`, automatically degrading spatial movement into instant state switches or subtle opacity transitions.
4. **Architectural Isolation**: Reusable animation tokens, physics curves, and wrappers reside in centralized modules (`src/lib/animations/` and `src/components/animations/`), preserving Server Component cleanliness across Next.js 15 App Router.

---

## 2. Package Architecture & Setup

### Official Package
- **Package**: `motion` (`v14.12.0`)
- **Modern Import Syntax**:
  ```tsx
  import { motion, AnimatePresence, MotionConfig } from "motion/react";
  ```
- **RSC Strategy**: Next.js App Router server components remain lightweight server-side components. Animation-rich widgets and interactive wrappers use `"use client"` at explicit leaf boundaries.

---

## 3. Centralized Animation Tokens & Physics

All timing, cubic-bezier curves, and spring constants are defined strictly in [`src/lib/animations/tokens.ts`](../src/lib/animations/tokens.ts):

### 3.1 Durations (`ANIMATION_DURATIONS`)
| Token | Duration (s) | Milliseconds | Intent |
| :--- | :--- | :--- | :--- |
| `button` | `0.15` | 150ms | Rapid tactile feedback for button presses |
| `hover` | `0.15` | 150ms | Micro-elevation and background shading |
| `tooltip` | `0.12` | 120ms | Snappy contextual help popovers |
| `dropdown` | `0.18` | 180ms | Menus, popovers, select popouts |
| `modal` | `0.24` | 240ms | Dialog popups and full overlay backdrops |
| `drawer` | `0.28` | 280ms | Slide-out sidebars and examination drawers |
| `page` | `0.20` | 200ms | Non-blocking page route transitions |
| `staggerDelay` | `0.04` | 40ms | Sequential list item cascade |
| `layout` | `0.22` | 220ms | Smooth DOM reflow and list reordering |

### 3.2 Spring Physics (`SPRING_TRANSITIONS`)
- **`tight`** (`stiffness: 450, damping: 30, mass: 0.8`): High-stiffness spring tuned for buttons, checkboxes, segmented tabs, and compact interactive controls. Prevents wobble while feeling physically grounded.
- **`snappy`** (`stiffness: 350, damping: 25, mass: 0.9`): Responsive spring for floating cards, dialogs, and slide panels.
- **`gentle`** (`stiffness: 200, damping: 20, mass: 1.0`): Soft spring for ambient metric counters and celebratory score badge reveals.

### 3.3 Reusable Variants (`src/lib/animations/variants.ts`)
- **`fadeIn` / `fadeUp` / `fadeDown`**: Directional entry/exit animations with decelerating curves.
- **`scaleIn`**: Centered zoom from 95% to 100% with `tight` spring.
- **`slideInRight`**: Horizontal panel entrance for sidebars and exam drawer drawers.
- **`staggerContainer` & `staggerItem`**: Staggered cascading parent/child orchestrator.
- **`modalBackdrop` & `modalDialog`**: Smooth backdrop fade and modal scale-in.
- **`listItemVariants`**: Enter, exit (`popLayout`), and spring reorder animation for dynamic item lists.

---

## 4. Reusable Component Library

Located in [`src/components/animations/`](../src/components/animations/):

### 4.1 `<MotionProvider>`
Root wrapper mounted in [`src/app/(dashboard)/layout.tsx`](../src/app/(dashboard)/layout.tsx):
```tsx
import { MotionConfig } from "motion/react";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  );
}
```
Enforces user OS accessibility preferences across all child animations automatically.

### 4.2 `<PageTransition>`
Wraps dashboard route contents to provide seamless, non-disruptive navigation without flash-of-unstyled-content:
```tsx
<PageTransition>
  {children}
</PageTransition>
```

### 4.3 `<AnimatedNumber>`
Smoothly interpolates numeric values using Motion's programmatic `animate()` function:
```tsx
<AnimatedNumber
  value={summary.taskStats.completionRate}
  duration={0.8}
  suffix="%"
  className="text-2xl font-bold"
/>
```

### 4.4 `<StaggerContainer>` and `<StaggerItem>`
Enables structured, elegant entrance animations for grids and lists:
```tsx
<StaggerContainer className="grid grid-cols-1 md:grid-cols-4 gap-4">
  {cards.map((card) => (
    <StaggerItem key={card.id}>
      <MetricCard card={card} />
    </StaggerItem>
  ))}
</StaggerContainer>
```

### 4.5 `<AnimatedList>` and `<AnimatedItem>`
Leverages `AnimatePresence mode="popLayout"` and `motion.div layout` to ensure that adding, filtering, or deleting list elements smoothly repositions surrounding items:
```tsx
<AnimatedList className="space-y-2">
  {tasks.map((task) => (
    <AnimatedItem key={task.id}>
      <TaskRow task={task} />
    </AnimatedItem>
  ))}
</AnimatedList>
```

---

## 5. UI Primitives Upgrades

### 5.1 Button (`src/components/ui/Button.tsx`)
Enhanced with tactile spring physics:
- **Hover**: Subtle `scale: 1.015`
- **Active / Tap**: Direct `scale: 0.97`
- **Spring**: `stiffness: 500, damping: 25`
- Preserves full accessibility focus rings, loading spinner states, and button variants (`primary`, `secondary`, `destructive`, `outline`, `ghost`).

### 5.2 Modal (`src/components/ui/Modal.tsx`)
Upgraded with full `AnimatePresence` lifecycle:
- Backdrop blurs and fades in (`opacity: 0 -> 1`).
- Dialog container zooms smoothly (`scale: 0.96 -> 1.0, y: 8 -> 0`).
- Dismissing triggers an accelerated exit transition (`scale: 0.96, opacity: 0`) before unmounting from the DOM.

### 5.3 Tabs (`src/components/ui/Tabs.tsx`)
Implements shared layout physics using Motion's `layoutId="active-tab-indicator"`:
- Moving between tab options smoothly glides the pill indicator across active states without abrupt position jumping.

### 5.4 Card (`src/components/ui/Card.tsx`)
Supports optional `interactive` prop:
- Hovering raises card elevation (`y: -2px`) and intensifies border shading.

### 5.5 Sidebar & Navigation System (`src/components/layout/Sidebar.tsx`)
Enhanced with full Motion interactive choreography:
- **Sliding Active Indicator (`layoutId="active-sidebar-pill"`)**: Moving between navigation links smoothly translates the active pill background across menu items using `SPRING_TRANSITIONS.tight` instead of instant abrupt swaps.
- **Directional Hover & Tap**: Menu items subtly shift (`whileHover={{ x: 3 }}`) with tactile spring compression on tap (`whileTap={{ scale: 0.98 }}`).
- **Collapsible Spring Animation**: Toggling sidebar width animates seamlessly between 256px and 80px (`animate={{ width: isCollapsed ? 80 : 256 }}`) with `type: "spring", stiffness: 350, damping: 30`. Text labels smoothly fade/scale out via `<AnimatePresence>` while icons remain centered with contextual hovering tooltips.
- **Micro-Interactions**: Workspace selector card, category links, and logout button feature responsive scale and rotate micro-interactions.

---

## 6. Functional Module Integrations

### 6.1 Dashboard Experience
- **Summary Metrics**: All 5 primary KPI cards are orchestrated with `<StaggerContainer>` and `<AnimatedNumber>` for live metrics (Total Tasks, Completion Rate, Habit Streak, Study Minutes, Average Exam Score).
- **Weekly Velocity Chart**: Visual bars smoothly grow vertically using spring physics based on actual weekly completed tasks.
- **Priority Tasks & Habits**: Dynamic lists wrapped with `<AnimatedList>` so completing an item smoothly fades it out while collapsing its row.

### 6.2 Task Management & Kanban Board
- Kanban columns utilize `<AnimatePresence mode="popLayout">`.
- Task cards carry `motion.div layout layoutId={task.id}` with `cardLift` hover interactions, guaranteeing silky repositioning when filtering or moving between columns.

### 6.3 Dedicated Examination Platform
- **Question Viewer (`take/[id]`)**: Wrapped in `<AnimatePresence mode="wait">` with subtle horizontal directional slides (`x: 12 -> 0 -> -12`) on question transitions (140ms duration).
- **Option Selection**: MCQ options feature micro-scale tap feedback (`scale: 0.995`) with instant radio-button ring color transitions.
- **Timer & Proctoring Integrity**: Zero artificial delays. Proctoring ping intervals and server-authoritative countdown sync continue uninterrupted in the background.
- **Scorecard Hero & Review (`review/[id]`)**: Pass/Fail badge expands with a celebratory spring reveal; score numbers animate smoothly with `<AnimatedNumber />`; question review cards cascade using `<StaggerContainer>`.

---

## 7. Performance & Verification Standards

1. **Hardware Acceleration**: All transitions are strictly constrained to GPU-accelerated CSS properties (`transform: scale, translate3d`, and `opacity`). Layout thrashing is eliminated.
2. **Bundle Footprint**: Centralized tree-shakeable imports from `motion/react` prevent unused animation features from bloating bundle size.
3. **No Flashing / Zero Delay**: Fast durations (150ms-240ms) ensure interfaces feel instant, responsive, and ergonomic.

