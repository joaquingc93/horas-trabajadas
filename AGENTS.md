# AGENTS Guide
This is the agent operating guide for `horas-trabajadas`.
Stack: Angular 21 (standalone), Ionic 8, Tailwind 4, strict TypeScript.

## 1) Repository facts
- Package manager: npm (`packageManager: npm@11.7.0`).
- Source root: `src/`; app code: `src/app/`.
- Tests run via Angular unit test builder (`@angular/build:unit-test`).
- Default test runner is Vitest.
- Project prefix is `app`.

## 2) Build / Lint / Test commands
Run from repo root:
`D:\2-Joaquin\estudio-trabajo\app-leiny\horas-trabajadas`

### Install
```bash
npm install
```

### Dev
```bash
npm start
# equivalent: npx ng serve
```

### Build
```bash
npm run build
```

### Build in watch mode (development)
```bash
npm run watch
```

### Run all unit tests
```bash
npm test
# equivalent: npx ng test
```

### Run one test file (important)
Use `--include` with workspace-relative path:
```bash
npx ng test --watch=false --include src/app/app.spec.ts
```

### Run tests for one folder
```bash
npx ng test --watch=false --include src/app/pages/history
```

### Run one test/suite by name (important)
Use `--filter` (regex):
```bash
npx ng test --watch=false --filter "should create the app"
npx ng test --watch=false --filter "^App"
```

### Useful test flags
```bash
npx ng test --watch=false --coverage
npx ng test --list-tests
npx ng test --watch=false --reporters=verbose
```

### Lint
- No lint target is configured in `angular.json`.
- `npx ng lint` currently fails with: `Cannot find "lint" target for the specified project.`
- If linting is needed, install Angular ESLint first:
```bash
npx ng add angular-eslint
npx ng lint
```

## 3) Cursor and Copilot rule files
Checked and not found:
- `.cursorrules`
- `.cursor/rules/`
- `.github/copilot-instructions.md`
Therefore, this `AGENTS.md` is the primary rule source for agents.

## 4) Code style guide

### TypeScript rules
- Keep code strict-mode compatible (`strict: true`).
- Avoid `any`; prefer specific types or `unknown` with narrowing.
- Prefer inference for obvious locals; explicit types at public boundaries.
- Use typed forms and typed domain models.
- Use `readonly` for non-reassigned class fields.
- Return explicit promise types (`Promise<void>`, `Promise<WorkSession>`, etc.).
- Keep helpers pure when possible.

### Angular rules
- Use standalone APIs; do not introduce NgModules.
- Do not add `standalone: true` in decorators (Angular 20+ default).
- Use `ChangeDetectionStrategy.OnPush` on components.
- Prefer `inject()` over constructor injection where practical.
- Use signals (`signal`, `computed`) for local state.
- Do not use signal `mutate`; use `set`/`update`.
- Prefer lazy routes with `loadComponent`.
- Prefer reactive forms over template-driven forms.

### Template rules
- Use built-in control flow: `@if`, `@for`, `@switch`.
- Do not add `*ngIf`, `*ngFor`, or `*ngSwitch` in new code.
- Keep template expressions simple; move logic to TS/computed values.
- Do not use arrow functions in templates.
- Do not use `ngClass`; use class bindings.
- Do not use `ngStyle`; use style bindings.
- Use `track` in `@for` loops (pattern: `trackById`).

### Imports and file organization
- Import groups in order:
  1. Angular imports
  2. Third-party imports (Ionic, Capacitor, RxJS, etc.)
  3. Local imports
- Separate groups with one blank line.
- Keep local imports relative and stable.
- Naming conventions in this codebase:
  - files: kebab-case
  - services: `*.service.ts`
  - pages/components: `*.page.ts`
  - models: `src/app/models/*.ts`
  - selectors use `app-` prefix.

### Formatting
- Follow Prettier config from `package.json`:
  - `printWidth: 100`
  - `singleQuote: true`
  - Angular parser for `*.html`
- Keep formatting tool-driven; avoid unrelated style churn.
- Add comments only for non-obvious intent.

### Naming
- Classes/interfaces/types: PascalCase.
- Variables/methods/properties: camelCase.
- Constants: UPPER_SNAKE_CASE for true constants only.
- Prefer descriptive names; short aliases only when conventional (`fb`, etc.).

### Error handling
- Use guard clauses for invalid input.
- Wrap async IO/device/plugin calls in `try/catch`.
- Provide user-safe fallback error messages.
- Do not silently swallow errors; log diagnostic context when useful.
- Use `finally` to reset loading/saving/deleting flags.
- Validate external data (storage data, parsed dates, plugin responses).

### Accessibility baseline
- Must meet WCAG AA and pass AXE checks.
- Ensure labels and ARIA attributes on controls and dynamic regions.
- Preserve keyboard navigation and visible focus states.
- Maintain sufficient color contrast.
- Use `aria-live` for async status and toast updates when applicable.

## 5) Project-specific patterns
- Keep components focused on one responsibility.
- Keep business logic in services/stores, not templates.
- Use computed signals for derived values (`totalHours`, `hasSessions`, previews).
- Keep side effects explicit in action methods (`saveSession`, `exportSummary`, etc.).
- Keep end-user text consistent with current Spanish UI copy unless requirements change.

## 6) Agent done checklist
- Run targeted tests first (`--include` and/or `--filter`) for touched areas.
- Run full tests for broad changes.
- Run production build for substantial runtime/UI updates.
- If lint is added later, run lint before finalizing.
