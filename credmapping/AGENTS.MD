# AGENTS.md — CredMapping+ Engineering Playbook

This document defines how autonomous and human agents should operate in this repository.
It is intended to keep CredMapping+ maintainable, predictable, and safe as the product grows.

## 1) Mission & Product Context
- **Product**: CredMapping+
- **Domain**: Credentialing workflow management for providers and facilities.
- **Primary goals**:
  - Reliability and correctness for credentialing workflows.
  - Fast, consistent UI for internal and external user experiences.
  - Maintainable code through reusable components and clear boundaries.

When making changes, optimize for long-term maintainability over short-term hacks.

## 2) Tech Stack Baseline (must be respected)
This repository is a **TypeScript-first Next.js app** with:
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **UI**: React, Tailwind CSS, shadcn-style component patterns
- **Server API**: tRPC
- **Validation**: Zod
- **DB/ORM**: Drizzle ORM
- **Auth/infra**: Supabase integration
- **Tooling**: ESLint, Prettier, pnpm

Agents must preserve this stack and avoid introducing alternative frameworks unless explicitly requested.

## 3) Non-Negotiable Operating Rules
1. **Read this file before any task.**
2. **Never run a dev server** (`pnpm dev`, `next dev`, etc.).
3. **Run lint checks for every task** and do not consider the task complete while lint errors remain.
4. Prefer minimal, high-signal diffs that keep behavior stable unless a behavior change is requested.
5. Do not add placeholder TODOs unless explicitly asked.
6. Keep code production-ready: no dead code, no commented-out blocks, no console debugging left behind.

## 4) Required Validation Workflow Per Task
From the project directory (`/workspace/CredMapping/credmapping`), run:

```bash
pnpm lint
```

If relevant or requested, additionally run:

```bash
pnpm typecheck
pnpm check
pnpm format:check
```

Validation expectations:
- Fix all lint errors introduced by the task.
- If pre-existing lint issues exist, clearly report them and avoid making them worse.
- Do not mark work complete without reporting the command outcomes.

## 5) Architecture & Code Organization Rules
Use existing folder structure and maintain clean separation of concerns:

- `src/app/` → route-level pages/layouts/loading and route handlers.
- `src/components/` → reusable UI/domain components.
  - `src/components/ui/` for generic, composable primitives.
  - feature subfolders (`providers`, `facilities`, etc.) for domain components.
- `src/server/` → server-only logic (tRPC routers, DB access, auth/domain rules).
- `src/lib/` and `src/utils/` → shared utilities.
- `src/hooks/` → reusable React hooks.

Rules:
- Keep business logic out of route/page files when it can be extracted.
- Prefer shared abstractions over copy-paste.
- Co-locate feature-specific components when reuse outside feature is unlikely.
- Promote to shared component only when reuse is proven.

## 6) Reusability & Component Design Standards
When building UI:
1. Check for an existing component before creating a new one.
2. Reuse `src/components/ui/*` primitives and extend compositionally.
3. Keep components focused and single-responsibility.
4. Prefer controlled APIs with explicit props over implicit behavior.
5. Extract repeated conditional/render logic into helper components/hooks.
6. Ensure components are accessible (labels, keyboard behavior, semantic elements).

Prop/API conventions:
- Use descriptive names (`isLoading`, `onSelectProvider`, `facilityId`).
- Avoid boolean-prop explosion; use enums/variants for complex states.
- Keep prop surfaces stable and backward compatible when possible.

## 7) Naming Conventions
- Files: kebab-case for most files (`provider-actions.tsx`, `route-access.ts`).
- React components: PascalCase.
- Variables/functions: camelCase.
- Constants: UPPER_SNAKE_CASE for true constants.
- Types/interfaces: PascalCase, descriptive (`ProviderWorkflowState`).
- Hooks: `useXxx` naming and must follow React hook rules.

Prefer explicit names over abbreviations unless they are domain-standard.

## 8) TypeScript Quality Bar
- No `any` unless unavoidable; prefer precise types and narrowing.
- Use Zod schemas at boundaries (inputs, external data, API contracts).
- Keep server and client types aligned through shared definitions where appropriate.
- Prefer `type` imports and type-safe utility helpers.
- Handle `null`/`undefined` intentionally; avoid non-null assertions unless justified.

## 9) tRPC / Server / DB Practices
- Keep routers thin and delegate substantial logic into focused functions/modules.
- When creating/editing any routes/logic, you should NEVER use raw SQL, only Drizzle syntax.
- You should always reference schema.ts as groundtruth database schema when dealing with any changes/fixes that have to touch anything as part of the database. 
- Validate procedure inputs/outputs with Zod.
- Enforce auth and role checks consistently (follow existing auth/domain patterns).
- For Drizzle mutations, always ensure safe query constraints (`WHERE` on updates/deletes).
- Prefer transaction boundaries for multi-step operations requiring atomicity.
- Never leak server-only utilities into client bundles.

## 10) Styling & UI Consistency
- Use Tailwind utility patterns already established in the codebase.
- Prefer design-token-like class reuse patterns when repeated.
- Keep spacing, typography, and interaction patterns consistent with existing screens.
- Avoid one-off styling if a shared variant/component can solve it.
- Ensure dark/light theme compatibility when touching themed UI.
- The site is mainly focused on being single page rendering, meaning that we shouldn't have to scroll on any of the site's pages, instead keeping things contained in scroll-able containers without scroll bars, using the scroll-indicator.tsx as the alternative. 
- All pages do not need a header, description or emojis, when tackling UI tasks, take advtange of completed pages referenced in the user prompt.  

## 11) Performance & Reliability Expectations
- Avoid unnecessary rerenders and oversized client components.
- Keep heavy computations off the render path; memoize where justified.
- Favor server-side data handling where it simplifies client complexity.
- Handle loading, empty, and error states explicitly.
- Preserve backward compatibility for critical workflows unless change is requested.

## 12) File Hygiene & PR Hygiene
For each change:
- Keep diffs focused.
- Update nearby docs/comments if behavior or contracts change.
- Use clear commit messages reflecting user-visible impact.
- Avoid broad refactors unless explicitly requested.

## 13) Anti-Patterns to Avoid
- Introducing duplicate components that differ only superficially.
- Mixing domain logic directly into presentational components.
- Creating giant components/files.
- Unstructured utility dumping in random files.
- Silent behavior changes without docs/tests/notes.

## 14) Suggested Agent Workflow (checklist)
1. Read task + this AGENTS.md.
2. Inspect existing patterns in neighboring files.
3. Implement minimal change with reusable abstractions.
4. If when reading existing code, and you happen to identify bad practices / a bug, you must fix and explain the finding(s) and solution(s) in the response. 
4. Run required lint checks.
5. Resolve linting issues.
6. Summarize changes and validation results clearly.

## 15) Scope Note
This AGENTS.md governs the repository root and all subdirectories unless a deeper AGENTS.md overrides it.