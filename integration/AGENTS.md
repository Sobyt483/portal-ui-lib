# Integration tests — agent instructions

Read this file completely before changing anything under `integration/`. It describes what this folder is, how it works, and how to work on it. Keep it up to date when you change the setup.

## Purpose

Playwright tests that start a **real portal frontend** built from this repository's sources (`@platform-mesh/portal-ui-lib`) together with `@openmfp/portal-ui-lib`, **without any backend**. Every backend call (`/rest/**`, the Kubernetes GraphQL gateway `/api/kubernetes-graphql-gateway/**`) is answered by a mock. The tests verify UI rendering and navigation behavior against requirements, not backend logic.

## Working rules

- **Never guess, verify.** Every value in the mocks and every expectation in the tests must come from the source code, the real content configurations, or an observed request. When something is unclear (expected behavior, response shape, scenario intent), ask the user before encoding it in a test.
- **Discover before you mock.** When a new scenario needs calls you have not seen yet, run the portal and record the real request sequence first (see "Discovering calls" below). Do not invent call shapes.
- **Tests assert requirements, annotated when they pin current behavior.** If a test documents behavior the user accepted as "current behavior" (not necessarily desired), add a `test.info().annotations` entry of type `current behavior` explaining it.
- **Prove a test can fail.** After adding a test, temporarily break the code under test (keep a backup copy, do not use git to restore) and check that the test fails for the right reason. Restore the file and confirm `git diff` is clean for it.
- **Check stability** with `--repeat-each=5` before declaring a test done.
- **Keep a debug command for every test in `README.md`.** Whenever you add, rename or remove a test, update the "Debug a single test" list in the same change: one entry per test under its spec file, the bullet `<innermost describe> › <test title>` and the command `npx playwright test --config integration/playwright.config.ts integration/tests/<setup>/<spec> -g '<innermost describe> <test title>' --debug`. Take the titles from `npx playwright test --config integration/playwright.config.ts --list`, wrap the pattern in single quotes and escape regex characters. Do not use `file:line`: tests generated in a loop share one line. Run every command with `--list` instead of `--debug` and confirm it prints `Total: 1 test in 1 file` for the intended test.
- **Keep everything test-related inside `integration/`.** The only files outside it are the `@playwright/test` devDependency and the `test:integration*` scripts in the root `package.json`, and the pointer in the root `AGENTS.md`.
- Follow the repository conventions from the root `AGENTS.md` (Prettier config, Conventional Commits, no AI attribution, never commit without approval).

## Running

```bash
npm run test:integration       # installs the Chromium headless shell if missing, builds the web component bundle (dist-wc), then runs all tests
npm run test:integration:ui    # Playwright UI mode (expects dist-wc to be built already)
npm run test:integration:v     # same as test:integration, records a video per test (PLAYWRIGHT_VIDEO=on)
npx playwright test --config integration/playwright.config.ts --repeat-each=5   # stability check
```

Playwright starts one web server per portal setup (`webServer` in `playwright.config.ts`): it builds the portal shell with the Angular CLI (`integration/angular.json`) and serves it with `server/serve-portal.ts`. Locally an already running server on the setup's port is reused; stop stale servers (`pkill -f serve-portal.ts`) after changing library code, otherwise you test an old build.

The web component bundle is **not** rebuilt by Playwright. After changing anything in `projects/wc`, run `npm run build:wc` (or use `npm run test:integration`).

Stop `npm run build:watch` before running the tests. It rebuilds on every change under `projects/`, writing the same `dist-wc/assets` the tests are served from (`bundle-wc.mjs` deletes the chunks of a concurrent build, which fails it with `Could not resolve "./chunk-*.js"`), and publishes every state of the sources to the consumers through `yalc publish --push`, including the temporary breakage of a mutation check.

## Layout

```
integration/
├── AGENTS.md                     # this file
├── README.md                     # running the portal with the mocks, one debug command per test
├── package.json                  # only marks the folder as ES modules ("type": "module")
├── tsconfig.json                 # type-check for tests, mocks, server (npx tsc -p integration/tsconfig.json)
├── angular.json                  # Angular workspace with one project per portal setup
├── playwright.config.ts          # one Playwright project + web server per portal setup
├── portals/                      # portal setups (the frontend apps under test)
│   ├── portal-setup.ts           # PortalSetup contract
│   ├── portal-setups.ts          # registry of all setups
│   ├── tsconfig.portal.json      # maps @platform-mesh/portal-ui-lib/* to the library sources
│   └── platform-mesh/            # setup mirroring pm/portal frontend
│       ├── portal-setup.ts       # port, test folder, static mounts
│       ├── assets/               # app-level assets the real portal ships itself
│       ├── src/                  # index.html, main.ts (portal options), app services
│       └── tsconfig.app.json
├── server/serve-portal.ts        # static server emulating the portal server's file serving
├── mocks/                        # mock response files + loader
│   ├── mock-catalog.ts           # named references to every mock file
│   ├── mock-response.ts          # loads a file and fills {{placeholders}}
│   ├── rest/                     # /rest/envconfig, /rest/config, /rest/config/<entity>, rest/errors/ for error responses
│   ├── search/                   # OpenSearch API responses, search/errors/ for error responses
│   ├── gateway/                  # GraphQL gateway responses, gateway/errors/ for error responses
│   └── gateway-failures.ts       # every gateway failure with the error code it must show, used in loops by the specs
├── backend/                      # Playwright routing that plays the backend
│   ├── gateway-request.ts        # identifies the GraphQL operation and account of a request
│   └── portal-backend-mock.ts    # routes requests to mocks, per-account overrides, request log
├── fixtures/portal-test.ts       # `test` with the `portalBackend` fixture
├── pages/                        # page objects (shell, overview, accounts list, account dashboard, httpbins list, httpbin, full page node, search list, error page)
└── tests/<setup-name>/           # specs, grouped by the portal setup they run against
```

Generated, git-ignored: `dist/` (portal builds), `test-results/` (also the `video.webm` per test when recording), `playwright-report/`, `.angular/`.

## How the portal is started

`portals/platform-mesh/src/main.ts` mirrors `pm/portal/frontend/src/main.ts`: `bootstrapApplication(PortalComponent, providePortal(portalOptions))` with the Platform Mesh implementations from `@platform-mesh/portal-ui-lib/portal-options`. Differences from `pm/portal`, on purpose:

- `customGlobalNodesService` is the library's `CustomGlobalNodesServiceImpl`; `pm/portal` wraps it to add a terminal node that is not part of the libraries.
- `customNodeProcessingService` and `errorComponentConfig` are registered here to render node failures in place. `pm/portal` must register them as well once it consumes a library version that exports them.
- The static settings use the `@openmfp/portal-ui-lib` logo instead of the portal's own asset.
- `@platform-mesh/portal-ui-lib` is compiled **from source** (`tsconfig.portal.json` paths), so library changes are tested without `npm run build:lib`.

The Angular CLI refuses asset inputs outside its workspace root (`integration/`), so assets are not part of the Angular build. `server/serve-portal.ts` serves them instead, like the real portal server does, using the setup's `staticMounts` (first match wins):

| URL           | Source                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `/`           | `integration/dist/portals/<setup>/browser` (SPA fallback to `index.html`)                                    |
| `/assets`     | setup `assets/`, then `dist-wc/assets` (this library's web components), then `@openmfp/portal-ui-lib/assets` |
| `/luigi-core` | `node_modules/@luigi-project/core`                                                                           |

The server answers `/rest/**`, `/api/**` and `/callback` with `501`; those must always be mocked in the browser.

### Adding a portal setup

1. Create `portals/<name>/` with `src/` (index.html, main.ts with its portal options), `tsconfig.app.json` extending `../tsconfig.portal.json`, and `portal-setup.ts` (unique port, `testDir: 'tests/<name>'`, static mounts).
2. Add an Angular project `<name>` to `integration/angular.json` (copy the existing one, change paths and `outputPath`).
3. Register the setup in `portals/portal-setups.ts`. Playwright then creates a project and a web server for it automatically.
4. Put its specs in `tests/<name>/`. If it needs different backend data, add new mock files and a matching default in a backend mock rather than editing files used by other setups.

## Backend mocking

`fixtures/portal-test.ts` installs `PortalBackendMock` on every page before the test starts (an `auto` fixture, so a test or `beforeEach` that does not mention `portalBackend` is still mocked) and, after the test, **fails the test if any portal-origin backend request had no mock** (`unhandledRequests`). Cross-origin requests (UI5 loads theme fonts from `cdn.jsdelivr.net`) are aborted so the tests never depend on the network; fonts fall back to system fonts.

### Auth

`/rest/envconfig` has no `oauthServerUrl`/`clientId`. `@openmfp/portal-ui-lib` then skips `/rest/auth/refresh` and Luigi auth entirely (`bootstrap()` returns early, `AuthConfigService.getAuthConfig()` returns `undefined`). Requests carry `Bearer undefined`; the mocks ignore it. If a test ever needs a logged-in user, mock `/rest/auth/refresh` and add the oauth fields — verify the Luigi oAuth2 plugin flow first.

### Mock files

Every mock file is one complete HTTP response:

```json
{
  "status": 200,
  "contentType": "optional, defaults to application/json",
  "body": {}
}
```

- File names say what is returned: `<operation>.<outcome>.json`, generic errors in `gateway/errors/<kind>.json`.
- `{{placeholders}}` are filled when loading: `{{portalOrigin}}` (the page origin, used in `crdGatewayApiUrl`) and `{{accountName}}` (the account the request is for). A placeholder without a value throws.
- Reference files only through `mock-catalog.ts`, never by path in tests.
- REST mocks are the **server output** of the real content configurations in `pm/platform-mesh/operators/platform-mesh-operator/manifests/kcp/01-platform-mesh-system/` (`contentconfiguration-main-home`, `-main-accounts`, `-account-home`), trimmed to what the tests need: the server adds `viewUrl` (= `url`) and `children: []`, wraps everything in one `platform-mesh-system` provider with `nodeContext.nodesPermissions`, and the account entity context is `{ id, policies }` (see `pm/portal-server-lib` `ContentConfigurationServiceProvidersService` and `AccountEntityContextProvider`). External `logoUrl` and kubeconfig download were left out.
- `rest/config.account-entity-with-dashboard-and-httpbins.json` adds the httpbin list node of `pm/helm-charts/local-setup/example-data/root/providers/httpbin-provider/contentconfiguration.yaml` (Link column, delete button, `createView` and `logoUrl` left out) and the detail view that helm-charts commit `efb2a4ec` removed from it (`detailView`, the `:httpbinId` entity, the `dashboard` node), plus the `details` and `status` detail views the user asked for. The entity context leaves out the historical `"accountId": ":accountId"`: Luigi cannot resolve it below `:core_platform-mesh_io_accountId`. The server sends no permission checks for it (no `permissionsDefinition`), and the list view treats missing permissions as allowed (`resourceActionAllowed`).
- `rest/config.account-entity-without-nodes.json` is what the server answers for a missing or forbidden account: `KubernetesServiceProvidersService` lists the content configurations in the workspace of the account, swallows the error and returns no providers, and `AccountEntityContextProvider` never fails (`pm/portal-server-lib`).
- `rest/config.account-entity-with-full-page-and-iframe-nodes.json` adds a `full-page` node with `hideSideNav`, the `members` iframe node and a `virtual-tree` iframe node. `members` is the real node of `contentconfiguration-account-iam-ui.yaml` (`category` and `context` left out, URL host replaced). No real content configuration uses `hideSideNav`, the `virtual-tree` node exists because Luigi rewrites the `viewUrl` of a virtual tree node for deeper segments, which the error node must not inherit, and no real content configuration uses `virtualTree` either; the `full-page` node exists because the user asked for a test of a node without side navigation; `/users/:userId/overview` has `hideSideNav` too, but it reads no account info and renders nothing without content configurations.
- `gateway/errors/http-401-unauthorized.json` is the gateway's `http.Error(w, "Unauthorized", http.StatusUnauthorized)` (`gateway/gateway/endpoint/endpoint.go`). `rest/errors/*` are the JSON bodies of NestJS HTTP exceptions (`ConfigController.getOrThrow`).
- `rest/config.account-entity-with-search-list.json` adds a `widgets` node with the minimal `search-list-dynamic-page` configuration of `docs/readme-generic-ui.md` plus two filter tabs; no real content configuration uses this view yet. `rest/config.account-entity-with-search-list-without-list-permission.json` also sets `permissionsDefinition` and `nodesPermissions` without `list`. `portalContext.openSearchApiUrl` is `{{portalOrigin}}/api/search`.
- `search/*` follows the contract of `OpenSearchService` and `.storybook/stories/showcase-presets.ts`, because the search API is not part of these repositories. The error bodies contain what `SearchListDynamicPage` reads (`status`, `title`, `detail`).
- GraphQL responses omit `__typename`; the real type names are unknown and Apollo does not need them here. Include every field the query selects (Apollo logs `Missing field` otherwise, e.g. `metadata.deletionTimestamp`).

### Gateway routing

`crdGatewayApiUrl` is `<origin>/api/kubernetes-graphql-gateway/root:orgs:test-org/graphql`; the library rewrites the workspace segment per account. `gateway-request.ts` identifies the operation by the query text and the account by the workspace path or the `name` variable, and records the `namespace` variable (`BackendRequest.namespace`):

| Operation            | Observed request                                                                                                                                               | Default mock                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `accountsList`       | `Accounts(limit: $limit)` on `root:orgs:test-org`                                                                                                              | four ready accounts (`account-alpha` … `account-delta`)     |
| `accountsWatch`      | SSE subscription `core_platform_mesh_io_v1alpha1_accounts`, `Accept: text/event-stream`                                                                        | `event: complete`, no changes                               |
| `accountInfoRead`    | `AccountInfo(name: "account")` on `root:orgs:test-org:<account>`                                                                                               | succeeds                                                    |
| `accountRead`        | `Account(name: $name)` on `root:orgs:test-org`, `variables.name = <account>`                                                                                   | succeeds                                                    |
| `logicalClusterRead` | `LogicalCluster(name: "cluster")` after a successful account info read, on `root:orgs:test-org:<account>`                                                      | phase `Ready`                                               |
| `httpBinsList`       | `HttpBins(namespace: $namespace, limit: $limit)` on `root:orgs:test-org:<account>`                                                                             | ready `httpbin-alpha` (`team-a`), `httpbin-beta` (`team-b`) |
| `httpBinsWatch`      | SSE subscription `orchestrate_platform_mesh_io_v1alpha1_httpbins`                                                                                              | `event: complete`, no changes                               |
| `httpBinRead`        | `HttpBin(name: $name, namespace: $namespace)` on `root:orgs:test-org:<account>`                                                                                | `httpbin-beta` in `team-b`                                  |
| `namespacesList`     | `v1 { Namespaces }` for the header namespace selection and for a namespaced entity without a namespace (`NamespaceService`), on `root:orgs:test-org:<account>` | `team-a`, `team-b`                                          |
| `namespacesWatch`    | SSE subscription `v1_namespaces`                                                                                                                               | `event: complete`, no changes                               |

Override per account inside a test, before navigating:

```ts
portalBackend.respondToAccountInfoRead(
  'account-gamma',
  gatewayErrorMocks.http404NotFound,
);
portalBackend.respondToAccountRead(
  'account-gamma',
  gatewayMocks.accountReadForbiddenGraphqlError,
);
portalBackend.respondToAccountEntityConfig(
  'account-gamma',
  restMocks.accountEntityConfigWithDashboardAndHttpBins,
);
portalBackend.respondToHttpBinRead(
  'account-gamma',
  gatewayMocks.httpBinReadMissingNamespaceArgument,
);
portalBackend.respondToHttpBinsList(
  'account-gamma',
  gatewayErrorMocks.http404NotFound,
);
portalBackend.respondToLogicalClusterRead(
  'account-gamma',
  gatewayMocks.logicalClusterReadInitializing,
);
portalBackend.respondToAccountsList(gatewayErrorMocks.http404NotFound);
portalBackend.respondToSearch(searchErrorMocks.http400InvalidQuery);
```

`gateway/httpbin-read.missing-namespace-argument.json` is the gateway's answer to a read of a namespaced resource without `namespace`: `GetItem` requires the argument for namespace-scoped resources and fails with `missing required argument: namespace`, and the item field is non-null, so `data` is `null` (`pm/platform-mesh/services/kubernetes-graphql-gateway/gateway/resolver/resolver.go`, `resolver/arguments.go`, `schema/fields/query.go`).

Assert which calls happened with `portalBackend.requestsTo(endpoint, accountName)` (endpoints: the gateway operations, `accountEntityConfig` and `searchResources`, which records the term as `searchTerm`).

To support a new call: add the mock file, reference it in `mock-catalog.ts`, add the operation signature in `gateway-request.ts` (or a REST branch in `portal-backend-mock.ts`) and a default.

### Discovering calls

To see what the portal really requests for a flow, write a temporary spec in `tests/<setup>/` that logs `page.on('request')` / `route.request().postDataJSON()` for `/rest/` and `/api/` URLs (an unmocked call is also listed in the fixture's failure message), run it, and delete it afterwards. Never commit discovery specs.

## Verified behavior covered by the tests

The requirement: a failed read never moves the user. The URL stays, the side navigation stays (or stays absent), there is no alert, and the content area shows the error with its image, title and a Retry button.

The account tests start like a user: they open `/`, which lands on `/home/overview` with the Overview nav item selected (no web component, no backend call), click the Accounts nav item, and open `account-gamma` by clicking its row. Sequence for an account: `AccountInfo` read → `LogicalCluster` read → `/rest/config/core_platform-mesh_io_account?...` → `Account` read in the dashboard (`generic-detail-view`).

`mocks/gateway-failures.ts` lists the gateway failures the loops run through and the error each must show: HTTP 401 → 401, HTTP 403 and a GraphQL "forbidden" error → 403, HTTP 404 → 404, HTTP 500 and any other GraphQL error → 500 (`ErrorHandlerService.errorCode`).

| What fails                                             | URL                                                 | Side navigation                            | Content                                                         |
| ------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| `Account` or `HttpBin` read, list of accounts/httpbins | unchanged                                           | unchanged                                  | the view renders `pm-error-state`, Retry heals                  |
| `AccountInfo` read, account has nodes                  | `.../dashboard`, reached through the default child  | the nodes of the account, current selected | only `error-component`, the view is never rendered, Retry heals |
| `AccountInfo` read, server returns no nodes            | `.../account-gamma`, or a deep link stays as opened | Overview and Accounts, Accounts selected   | only `error-component`, Retry heals content and side navigation |
| `/rest/config/<entity>` HTTP error                     | as above                                            | as above                                   | only `error-component`, Retry fetches the nodes again           |
| `LogicalCluster` phase not `Ready`                     | `.../dashboard`                                     | the nodes of the account                   | only `error-component` with 503, Retry heals                    |
| URL matches no node (`current behavior`)               | unchanged                                           | none                                       | global `/error/404` node with `keepURL`, no Retry               |

"Only the error view is rendered" is checked by decoding Luigi's web component tags (`luigi-wc-<hex of view URL>`) inside `.wcContainer` (`PortalShell.renderedViews()` must equal `['error-component']`) and the request log (`accountRead` must not be requested). `PortalShell.expectSideNavigation` compares the labels of all `.fd-navigation__link` items exactly and checks the selected one, `expectNoSideNavigation` checks Luigi's `.no-side-nav` class and that there are no items.

Every failure has one recovery action, from `pm-error-state` (`ErrorPage.expectRecoveryAction`): Retry, or for HTTP 401 the login button instead, because `ApolloFactory` has already retried with a fresh token by then. The login button reloads the page (`when the session has expired`): the token refresh runs again, otherwise Luigi's auto-login goes to the login provider. The mocks have no auth, so the tests prove the reload and the URL, not the login itself.

A failed list shows only the error below the breadcrumbs: the `ListView` dashboard with its title, description and table is hidden, and shown again after a successful retry.

The error is checked for its title **and** its illustration (`ErrorPage.expectShown`): the `ui5-illustrated-message` shadow DOM must contain the `img` labelled with the scene from `error-state.component.ts` and the visible SVG drawing of that scene. A visible SVG has a size, so this proves the image was drawn, not only configured.

Why a failed node does not show the side navigation of the failed entity when it has no nodes: Luigi computes the side navigation from the resolved path (`getLeftNavData`), and `:core_platform-mesh_io_accountId` sets `keepSelectedForChildren: false`. `CustomNodeProcessingServiceImpl` clears that flag while the entity is failed, so `getTruncatedChildren` stops at the Accounts node. Luigi reads the node `children` with `{}.toString.call(fn) === '[object Function]'`, so the wrapper must not be an `async` function, and openmfp reassigns `node.children` when a parent is evaluated again, so the wrapper is re-applied per function, not per node.

A failed watch is not tested here: `graphql-sse` retries network errors five times with exponential backoff, so a failed subscription surfaces only after about 40 seconds. The unit tests of `ResourceTableCard` cover it.

The Http Bins nav item is not asserted as selected on the list: it is not selected on a healthy list either (verified against a clean export of `main`).

### Node without side navigation (`error-without-side-navigation.spec.ts`)

Opens the `full-page` node (`hideSideNav`) of `account-gamma` directly. For every gateway failure, both for the `Account` read of its view and for the `AccountInfo` read of its entity: the URL stays, there is still no side navigation, the error is shown with a Retry button and no alert. Retry heals both. With a Retry button the 403 and 404 subtitles say when trying again helps (access just granted, content just created). A resource pending deletion (`gateway/account-read.pending-deletion.json`) shows the 422 error without a Retry button.

### Search list (`search-list.spec.ts`)

Opens the `widgets` node of `account-gamma` directly. The search list keeps its header on a failure: for HTTP 401, 403, 404 and 500 the title, description, search input and filter tabs, the URL and the side navigation stay, and the error with a Retry button replaces the table. Retry heals. A term that causes the failure stays in the search input and in `?q=`, the `detail` of the response is the subtitle, and searching for another term or clearing the search recovers, also when the failing term came from the URL. Without a `detail` the subtitle is the default text, never the technical `Http failure response for <url>` of `HttpErrorResponse`. Without the `list` permission the 403 error shows without Retry and without a search request. A failed filter count request is ignored (`loadFilterCounts`), so the tabs simply show no count.

### Error handling mutation checks

Run in a copy of the repository without `npm run build:watch` (see "Running"). Rebuild `dist-wc` for mutations in `projects/wc` and for `ErrorHandlerService`, which the web component bundle compiles in; the portal shell compiles the library from source on every run.

| Mutation                                                     | Fails on                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| `customNodeProcessingService` not registered in `main.ts`    | account info failure: the title of the error               |
| `errorComponentConfig` not registered in `main.ts`           | failed nodes: the title of the error                       |
| `keepSelectedForChildren` not cleared on the failed entity   | no nodes: the labels of the side navigation                |
| error view not put on the failed entity node                 | no nodes, click-through: the URL (`.../:errorPath`)        |
| `clearNodeCache()` removed                                   | no nodes and failed nodes, Retry: the URL                  |
| failed entity node not restored                              | next account and Retry: the URL                            |
| stale `entityErrorCode` not deleted                          | next account: the labels of the side navigation            |
| wrapper applied once per node instead of per function        | no nodes, Retry: the URL                                   |
| hidden error child added below a failed entity               | account info failure: the labels of the side navigation    |
| error node sets `hideSideNav: false`                         | node without side navigation: the count of `.no-side-nav`  |
| error node keeps the view of the node (`...errorView` first) | iframe node: the title of the error                        |
| `virtualTree` kept on the error node                         | deep URL of a virtual tree node: the title of the error    |
| `processNodeContext` hangs again on failure                  | account info failure: the title of the error               |
| organization readiness ignored                               | organization not ready: the title of the error             |
| `errorCode` always 500                                       | account read with HTTP 401: the title of the error         |
| detail view navigates to `/error/<code>`                     | account read: the URL                                      |
| list view navigates to `/error/404`                          | accounts list: the URL                                     |
| failed list leaves the dashboard visible                     | accounts list: table, title and description must be hidden |
| 404 scene changed to the unregistered `NoMail`               | account info failure: the illustration                     |
| list retry not wired to the card                             | accounts list, Retry: the table stays hidden               |
| list view not told about the failure                         | accounts list: the title of the error                      |
| search subtitle uses the message of `HttpErrorResponse`      | search list: the subtitle                                  |
| search error not cleared when listing again                  | search list, Retry and new term: the table stays hidden    |
| search header hidden on a failure                            | search list: the search input must be visible              |
| Retry shown without the `list` permission                    | search list: Retry must be absent                          |
| Retry instead of the login button on a 401                   | every 401 test: the login button                           |
| login button does nothing                                    | session expired: no page load                              |
| namespace selection shown on a 401                           | httpbin without namespace, 401: the select must be absent  |
| `retry()` of the error node does nothing                     | Retry: the title stays the error instead of the dashboard  |
| 403 and 404 suggest trying again without a Retry button      | unknown URL and search list without `list`: the subtitle   |
| 403 and 404 do not suggest trying again                      | node without side navigation, 403 and 404: the subtitle    |

### Httpbin navigation (`httpbin-navigation.spec.ts`)

Starts like the account tests with the httpbin account entity config for `account-gamma`, waits until the account dashboard is rendered, then clicks the Http Bins nav item. The header namespace selection writes `?namespace=-all-` to the list URL. Opening `httpbin-beta` lands on `/home/accounts/account-gamma/orchestrate_platform-mesh_io_httpbins/httpbin-beta/dashboard?namespace=team-b`. Details, Status and Dashboard again must each show exactly `?namespace=team-b`, be the selected nav item, render only `generic-detail-view` with the httpbin name, and read the `HttpBin` with namespace `team-b`. `CustomRoutingConfigServiceImpl` leaves Luigi's `preserveQueryParams` unset (off), so Luigi drops the query on every navigation; `NamespacedResourceSelectionService` remembers the namespace of the opened namespaced resource in `NodeContextProcessingServiceImpl` and the node change hook writes it back to the URL (`addSearchParams(..., false, true)`: `replaceState` without a Luigi config update) on every node inside that resource.

A second test opens the same httpbin dashboard, then clicks the Accounts breadcrumb (`/home/accounts`) and the Home breadcrumb (`/home/overview`) and requires the `namespace` parameter to be gone on both. The paths are hard assertions, the missing parameter is a soft assertion so both steps are always checked. With `preserveQueryParams: true` it failed on both steps (`namespace=team-b` kept). Breadcrumb links are found by accessible name, which ui5 builds as `<label> <n> of <total>` (their inner text is empty, the label is slotted).

Nav item test ids follow Luigi `NavigationHelpers.prepareForTests`: `pathSegment` and `label` are each lowercased, stripped of spaces and URI-encoded, then joined with `_` (`orchestrate_platform-mesh_io_httpbins_httpbins`). `PortalShell.navigationItem` builds them the same way.

Why the test waits for the account dashboard: Luigi renders `compound` nodes (both dashboards) asynchronously (`renderWebComponentCompound` → `createCompoundContainerAsync`) and appends the result even after navigating away. Clicking the next nav item before the dashboard is rendered leaves both views in `.wcContainer` (seen in 6 of 20 runs before the wait was added).

Mutation checks: without the namespace restore (`preserveQueryParams` off and no `restoreNamespaceSearchParam` call in `NodeChangeHookConfigServiceImpl`) both tests fail on the dashboard URL (`.../httpbin-beta/dashboard` without `?namespace=team-b`): the parameter is already lost when the httpbin is opened, before any sibling node. Restoring the namespace on every node, also outside the resource, fails only the breadcrumb test (`namespace=team-b` on `/home/accounts` and `/home/overview`).

### Httpbin read failures (`httpbin-navigation.spec.ts`, `when reading the httpbin fails`)

One test per gateway failure opens the httpbin dashboard directly and checks that the URL with `?namespace=team-b` and the Dashboard, Details and Status nav items stay and the error is shown in `generic-detail-view`.

The other three tests open the httpbin dashboard directly and check the read state of `generic-detail-view` (title `Could not load resource`, no alert, only that view rendered), then answer the next `HttpBin` read with the default success mock and click Retry.

- **Namespace known, other GraphQL error:** `.../httpbin-beta/dashboard?namespace=team-b` with `gateway/errors/graphql-error-service-unavailable.json`. Subtitle `Please try again.`, no namespace select, Retry enabled, no `namespacesList` request. Retry reads the httpbin again in `team-b` and the URL keeps `?namespace=team-b`.
- **Namespace parameter missing:** `.../httpbin-beta/dashboard` with `gateway/httpbin-read.missing-namespace-argument.json`. The read is sent without `namespace`. `NodeContextProcessingServiceImpl` lists the workspace namespaces through `NamespaceService` (`namespacesList`) for a namespaced entity without a namespace and puts them into the node context as `namespaces`, the detail view renders them in a select (`generic-detail-view-namespace-select`, options `team-a`, `team-b`), the subtitle is `Select a namespace and try again.` and Retry carries the `disabled` attribute until a namespace is selected. Selecting `team-b` writes `?namespace=team-b` at once (`LuigiCoreService.routing().addSearchParams(..., false, true)`: `replaceState` without a Luigi config update) and sends no read. Retry calls `LuigiCoreService.configChanged()`; the node context is processed again with the namespace and the view gets a context with `namespaceId`, which triggers exactly one new read in `team-b` (calling `readResource()` in addition sent a second, duplicate read).

- **Namespace read fails:** as above, but `namespacesList` answers HTTP 500. `NodeContextProcessingServiceImpl` alerts `Failed to read namespaces.` with the error detail through `ErrorHandlerService.handleError` and the select has no options. The icon-only refresh button next to the select (`generic-detail-view-namespace-refresh`) lists the namespaces again through `NamespaceService`: a GraphQL error is alerted the same way, a successful answer fills the select (`team-a`, `team-b`) and the flow continues as in the missing-namespace test. Each alert is found by its error detail (`portalShell.alert.filter({ hasText })`) because earlier alerts can still be open. `portalBackend.respondToNamespacesList(account, mock)` overrides the answer per account.

Disabled state is asserted with `toHaveAttribute('disabled')`: the button is a `ui5-button`, not a native button.

Mutation checks: not listing the namespaces in `NodeContextProcessingServiceImpl` fails the missing-namespace test on the options (`element(s) not found`); removing the `[disabled]` binding fails it on the disabled check; not writing the search param on selection fails it on the URL right after selecting (no `?namespace=team-b`). Logging instead of alerting the failed namespace read in `NodeContextProcessingServiceImpl` fails the namespace-read test on the first alert; logging instead of alerting a failed refresh fails it on the alert after the refresh; ignoring a successful refresh result fails it on the options.
