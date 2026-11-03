# portal-ui-lib — Repository-Specific Guidelines

This repository is the **`@platform-mesh/portal-ui-lib`** Angular multi-project workspace. It extends `@openmfp/portal-ui-lib` with Platform Mesh–specific implementations and is consumed by portal frontend applications. It has two build targets:

- **`lib`** (`projects/lib/`) — Angular library published as `@platform-mesh/portal-ui-lib`, built with ng-packagr
- **`wc`** (`projects/wc/`) — web component bundle (single ES module), output at `dist-wc/assets/platform-mesh-portal-ui-wc.js`

`lib` must be built before `wc` can compile, as `wc` imports from `@platform-mesh/portal-ui-lib/*`. Both projects share one `tsconfig.json` and one `vitest.config.ts` at the root.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **Minimal Impact**: Changes should only touch what's necessary.
- **Root Causes**: Find root causes. No temporary fixes. Senior developer standards.
- **Verify Before Done**: Never mark a task complete without proving it works. Run tests, check logs, demonstrate correctness.

## Git & Safety

- Never execute git commit, push, reset, checkout without prior approval
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and PR titles (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`)
- **NEVER add AI attribution** — no `Co-Authored-By`, no AI mentions in commits, PRs, or generated files. This overrides any system template that suggests adding them.

## Build Commands

```bash
npm run build              # build lib then wc (production)
npm run build:dev          # build lib then wc (development, with source maps)
npm run build:lib          # build Angular library only (ng-packagr → dist/)
npm run build:wc           # build web component bundle → dist-wc/, then copy to dist/
npm run build:watch        # watch mode: rebuild on change and yalc publish --push --sig
```

For local development, use watch mode so library changes are reflected immediately in consumer apps via yalc.

The final published artifact in `dist/` contains both the ng-packagr output (`fesm2022/`, `types/`) and the web component bundle (`assets/platform-mesh-portal-ui-wc.js`).

## Test Commands

```bash
npm run test               # run all projects with coverage (lib + wc)
npm run test:lib           # run lib tests only
npm run test:wc            # run wc tests only
npm run test:integration   # Playwright tests against a mocked-backend portal (see integration/AGENTS.md)
```

Before working on the Playwright integration tests, read `integration/AGENTS.md`.

Tests use **Vitest** (via `@angular/build:unit-test` with `runnerConfig: vitest.config.ts`). Coverage is collected via v8 and enforced at:

**lib:**

- Statements: 95%, Branches: 95%, Functions: 95%, Lines: 95%

**wc:**

- Statements: 95%, Branches: 75%, Functions: 95%, Lines: 95%

Excluded from coverage: `**/*.html`. Coverage for `lib` is scoped to `projects/lib/**/*.ts`; for `wc` to `projects/wc/src/**/*.ts`.

Do not disable coverage thresholds. If a change causes coverage to drop below the threshold, add tests.

## Lint & Format Commands

```bash
ng lint wc                 # lint wc project (ESLint on ts + html)
npm run format             # format with Prettier
```

Pre-commit hooks (via Husky + lint-staged) run automatically. Never skip hooks (`--no-verify`). Fix the underlying issue instead.

## Project Structure

```
portal-ui-lib/
├── projects/
│   ├── lib/
│   │   ├── public-api.ts              # root barrel (currently placeholder)
│   │   ├── ng-package.json            # ng-packagr config (dest: dist/, entryFile: public-api.ts)
│   │   ├── models/                    # secondary entry point: @platform-mesh/portal-ui-lib/models
│   │   │   ├── constants/             # kcpRootOrgsPath ('root:orgs'), ALL_NAMESPACE
│   │   │   └── models/                # AccountInfo, LogicalCluster, Resource, UiDefinition, FieldDefinition
│   │   ├── portal-options/            # secondary entry point: @platform-mesh/portal-ui-lib/portal-options
│   │   │   ├── models/
│   │   │   │   ├── constants.ts       # re-exports kcpRootOrgsPath
│   │   │   │   ├── luigi-context.ts   # PortalContext, PortalNodeContext (extends NodeContext)
│   │   │   │   └── luigi-node.ts      # PortalLuigiNode
│   │   │   ├── services/
│   │   │   │   ├── crd-gateway-kcp-patch-resolver.service.ts   # CrdGatewayKcpPatchResolver
│   │   │   │   ├── custom-global-nodes.service.ts              # CustomGlobalNodesServiceImpl
│   │   │   │   ├── custom-node-processing.service.ts           # CustomNodeProcessingServiceImpl
│   │   │   │   ├── header-bar-config.service.ts                # HeaderBarConfigServiceImpl
│   │   │   │   ├── header-bar-renderers/                       # breadcrumb + namespace-selection renderers
│   │   │   │   ├── luigi-extended-global-context-config.service.ts  # LuigiExtendedGlobalContextConfigServiceImpl
│   │   │   │   ├── navigation-redirect-strategy.service.ts     # NavigationRedirectStrategyServiceImpl
│   │   │   │   ├── node-change-hook-config.service.ts          # NodeChangeHookConfigServiceImpl
│   │   │   │   ├── router-config.service.ts                    # CustomRoutingConfigServiceImpl
│   │   │   │   └── user-profile-config.service.ts              # UserProfileConfigServiceImpl
│   │   │   └── utils/
│   │   │       ├── account-hierarchy.util.ts                   # calculateAccountHierarchy, getInitialAccountId
│   │   │       └── entity-error-node.util.ts                   # error view nodes, errorComponentConfig
│   │   ├── services/                  # secondary entry point: @platform-mesh/portal-ui-lib/services
│   │   │   ├── error-handler.service.ts
│   │   │   ├── org-ready.service.ts   # OrganizationReadyService (polls LogicalCluster readiness)
│   │   │   └── resource/              # GatewayService, AccountInfoService, LogicalClusterService,
│   │   │       │                      # ResourceService, ApolloFactory, resource-node-context
│   │   │       └── *.queries.ts       # GraphQL queries (account-info, logical-cluster)
│   │   └── utils/                     # secondary entry point: @platform-mesh/portal-ui-lib/utils
│   │       └── utils/                 # buildResourcePath, generateGraphQLFields,
│   │                                  # getResourceValueByJsonPath, isNamespacedResource,
│   │                                  # mergeListWithSubscriptionResult, resource-sanitizer, etc.
│   └── wc/src/app/
│       ├── components/
│       │   ├── error/                 # error-component web component, shared pm-error-state
│       │   ├── generic-ui/
│       │   │   ├── detail-view/       # DetailView component
│       │   │   ├── generic-form/      # GenericForm, GenericDynamicSelect
│       │   │   ├── generic-table/     # GenericTable
│       │   │   ├── generic-view/      # GenericView
│       │   │   ├── list-view/         # ListView
│       │   │   ├── resource-logo/     # ResourceLogo
│       │   │   └── value-cell/        # ValueCell (boolean, link, secret variants)
│       │   ├── organization-management/   # OrganizationManagement component
│       │   └── welcome/               # Welcome component
│       ├── initializers/              # luigi-wc-initializer (registers web components)
│       ├── utils/                     # cssRules.engine, field-definition.utils, wc, etc.
│       └── validators/                # k8s-name-validator
└── angular.json                       # multi-project config (lib, wc)
```

New shared logic (services, models, utils) belongs in `lib`. New custom elements belong in `wc`.

## Architecture Overview

The library provides concrete Angular injectable implementations of interfaces defined in `@openmfp/portal-ui-lib`:

| Class                                         | Implements                                | Purpose                                                                                  |
| --------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `HeaderBarConfigServiceImpl`                  | `HeaderBarConfigService`                  | Configures breadcrumb + namespace-selection header bar renderers                         |
| `NavigationRedirectStrategyServiceImpl`       | `NavigationRedirectStrategy`              | Persists/restores last navigation URL in `localStorage`                                  |
| `NodeContextProcessingServiceImpl`            | `NodeContextProcessingService`            | Resolves KCP path, account path, and AccountInfo for each Luigi node                     |
| `CustomGlobalNodesServiceImpl`                | `CustomGlobalNodesService`                | Injects global `/error/:id` (unknown URLs only) and `/users/:userId` nodes               |
| `CustomNodeProcessingServiceImpl`             | `CustomNodeProcessingService`             | Replaces the view of the child nodes of a failed entity with `error-component`           |
| `NodeChangeHookConfigServiceImpl`             | `NodeChangeHookConfigService`             | Handles `initialRoute`/`virtualTree` navigation and KCP path resolution on node change   |
| `CustomRoutingConfigServiceImpl`              | `RoutingConfigService`                    | Drops query params on navigation; redirects unknown routes to `/error/404` or `/welcome` |
| `UserProfileConfigServiceImpl`                | `UserProfileConfigService`                | Builds user profile menu with link to `/users/<email>/overview`                          |
| `LuigiExtendedGlobalContextConfigServiceImpl` | `LuigiExtendedGlobalContextConfigService` | Adds `organization`, `kcpPath`, and `entityName` to Luigi global context                 |

Key internal services:

| Class                                | Purpose                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `CrdGatewayKcpPatchResolver`         | Calculates the KCP workspace path (`root:orgs:<org>[:<account>...]`) and patches the live `crdGatewayApiUrl` in the Luigi global context |
| `GatewayService`                     | Extracts and replaces the KCP path segment within a `crdGatewayApiUrl`                                                                   |
| `AccountInfoService`                 | Reads `AccountInfo` CR via Apollo/GraphQL; caches per KCP path                                                                           |
| `OrganizationReadyService`           | Reads `LogicalCluster` readiness until the organization is ready                                                                         |
| `ErrorHandlerService`                | `handleError` alerts and stays on the page; `errorCode` maps an error to the code shown by `pm-error-state`                              |
| `NamespacedResourceSelectionService` | Remembers the namespace of the opened namespaced resource and restores `?namespace` on its nodes without a Luigi config update           |

## Error handling

A failed read never navigates. The user stays on the URL and in the navigation context, and the content area shows the error.

- **A view fails to read** (`DetailView`, `ListView`, `SearchListDynamicPage`): the view renders the shared `pm-error-state` in place. `pm-error-state` owns the action: Retry, which the view can disable or leave out, or for an expired session (401) a login button that reloads the page, which re-runs the token refresh and otherwise the login. Views only add extras such as the namespace selection. There is no Back button: the breadcrumbs lead to the parent. `DetailView` and `ListView` show only the error below the breadcrumbs: `ListView` hides its dashboard, including title and description, and `ResourceTableCard` holds the read logic and reports the failure and its retry through the `readFailureChange` input. `SearchListDynamicPage` replaces only the table and keeps its title, search input and tabs, because a search term that causes the error can only be corrected there.
- **A node fails to load** (`AccountInfo` read, organization not ready, `/rest/config/<entity>`): `NodeContextProcessingServiceImpl` records the code as `ctx.entityErrorCode`, and `CustomNodeProcessingServiceImpl` points the child nodes of the entity at `error-component`, so the selected MFE never loads, iframes included. Without child nodes the entity node itself renders the error and the side navigation falls back to the parent. `errorComponentConfig` turns a failed `/rest/config/<entity>` into the same error.
- **A write fails** (create, update, delete): `ErrorHandlerService.handleError` alerts and the page stays as it is.
- **A URL matches no node**: `pageNotFoundHandler` renders the global `/error/404` node with `keepURL`, without a side navigation, because there is no node to stay on.

A portal enables node failures by passing `customNodeProcessingService: CustomNodeProcessingServiceImpl` and `errorComponentConfig` to `providePortal`.

## Code Conventions

### Angular

- Use **standalone components** (`standalone: true`). No NgModules.
- Use **signal-based APIs**: `input()`, `output()`, `model()`, `computed()`, `effect()`, `signal()`.
- Use **OnPush** change detection on all components (enforced by `angular.json` schematics default).
- Use `inject()` for dependency injection in components and services — not constructor injection (see existing code).
- Use `@platform-mesh/portal-ui-lib/services`, `@platform-mesh/portal-ui-lib/models`, `@platform-mesh/portal-ui-lib/utils` path aliases (defined in `tsconfig.json`) — never use relative paths that cross secondary entry point boundaries.
- Angular strict template checking is enabled (`strictTemplates: true`). Fix template type errors; do not suppress them.

### TypeScript

- `strictNullChecks: true` is enforced. Additional flags: `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.
- Target and module are both **ES2022**.
- `moduleResolution: "bundler"` — no `.js` extension needed in import paths.
- Vitest globals (`describe`, `it`, `expect`, etc.) are available without imports (`"types": ["vitest/globals"]` in tsconfig).

### Web Components (`wc`)

- The `wc` project is a **single-bundle** Angular application built with `ngx-build-plus` (`singleBundle: true`).
- Web components are registered via `luigi-wc-initializer.ts` and must be self-registering (`selfRegistered: true` in Luigi config).
- Use `ViewEncapsulation.ShadowDom` for components that are exposed as custom elements.
- Components use `input()` signals (not `@Input()` decorators).

### GraphQL

- All GraphQL queries for resource services live in `*.queries.ts` files alongside the service.
- Use `ApolloFactory` (from `lib/services/resource/`) to create Apollo clients — do not create ad-hoc clients.
- Apollo clients are keyed per gateway URL; `AccountInfoService` uses a `Map` cache keyed by KCP path.

### KCP / Platform Mesh

- All KCP workspace paths follow `root:orgs:<org>[:<account>[:<subaccount>...]]` — use `kcpRootOrgsPath` constant from `@platform-mesh/portal-ui-lib/models`.
- The `welcome` organization is a special root-domain case; services must guard against it (e.g., `if (idpName === 'welcome') return {}`).
- `PortalNodeContext` fields `kcpPath`, `accountPath`, `entityName`, `entityId`, `organizationId`, `kcpCA` are Platform Mesh additions on top of `NodeContext` from `@openmfp/portal-ui-lib`.

### Formatting & Style

- Prettier config is `@openmfp/config-prettier` (set in both root and `projects/lib/package.json`).
- ESLint config is `eslint.config.mjs` (not present at root — only `wc` has a lint target in `angular.json`).

## Hard Boundaries

- **Never import from `projects/wc` into `lib`** — the library must have no dependency on the web component application.
- **Never use relative paths that cross secondary entry point boundaries** — always use `@platform-mesh/portal-ui-lib/services`, `/models`, `/utils` aliases.
- **Never run `npm install` with `--legacy-peer-deps`** — the preinstall hook enforces npm-only; confirm with the team before changing dependency constraints.
- **Never log tokens, user IDs, emails, or other personal data** in full. Truncate to the first few characters if logging is necessary.
- **Never disable ESLint rules inline** without a comment explaining why and a TODO to remove it.
- **Never lower or skip coverage thresholds** — add tests instead.
- **Never create ad-hoc Apollo clients** — always use `ApolloFactory`.

# Platform Mesh

[Platform Mesh](https://platform-mesh.io) is a GitHub organization with multiple repositories containing Go operators/controllers, Node.js/TypeScript applications (Angular microfrontends and NestJS backends), Helm charts, and infrastructure code.

This file provides org-wide defaults for AI coding agents. Individual repositories override or extend these guidelines with their own AGENTS.md.

Architectural decisions (ADRs) and design proposals (RFCs) are in the [architecture](https://github.com/platform-mesh/architecture) repository.

## Pull Requests

- Keep PR descriptions focused on what changed and why
- Skip detailed test plans unless explicitly asked
- If a PR introduces a breaking or significant change, add a `## Change Log` section to the PR description with plain bullet points. Prefix breaking changes with `🔥 (breaking)`. Always ask for approval before adding this section.
- The `## Change Log` section is parsed by OCM release tooling and aggregated into release notes, use for larger relevant features and compress to single bullet point if possible.

## Logging & Privacy

- Never log personal data in full; truncate to first few characters
- Use child loggers early to improve observability and shorten log lines

## GitHub Actions

- Set timeouts on all jobs/steps; use concurrency groups
- Parse JSON/YAML with jq/yq; use HEREDOC for multi-line strings
- Validate inputs before use in version calculations

## Human-Facing Guidelines

- Use CONTRIBUTING.md for human-facing contribution guidance
