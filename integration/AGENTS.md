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
│   ├── rest/                     # /rest/envconfig, /rest/config, /rest/config/<entity>
│   ├── gateway/                  # GraphQL gateway responses, gateway/errors/ for error responses
│   └── search/                   # OpenSearch-compatible search result fixtures
├── backend/                      # Playwright routing that plays the backend
│   ├── gateway-request.ts        # identifies the GraphQL operation and account of a request
│   └── portal-backend-mock.ts    # routes requests to mocks, per-account overrides, request log
├── fixtures/portal-test.ts       # `test` with the `portalBackend` fixture
├── pages/                        # page objects (shell, overview, accounts list, account dashboard, httpbins list, httpbin, error page)
└── tests/<setup-name>/           # specs, grouped by the portal setup they run against
```

Generated, git-ignored: `dist/` (portal builds), `test-results/` (also the `video.webm` per test when recording), `playwright-report/`, `.angular/`.

## How the portal is started

`portals/platform-mesh/src/main.ts` mirrors `pm/portal/frontend/src/main.ts`: `bootstrapApplication(PortalComponent, providePortal(portalOptions))` with the Platform Mesh implementations from `@platform-mesh/portal-ui-lib/portal-options`. Differences from `pm/portal`, on purpose:

- `customGlobalNodesService` is the library's `CustomGlobalNodesServiceImpl`; `pm/portal` wraps it to add a terminal node that is not part of the libraries.
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

`fixtures/portal-test.ts` installs `PortalBackendMock` on every page before the test starts and, after the test, **fails the test if any portal-origin backend request had no mock** (`unhandledRequests`). Cross-origin requests (UI5 loads theme fonts from `cdn.jsdelivr.net`) are aborted so the tests never depend on the network; fonts fall back to system fonts.

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
- Httpbin list/detail nodes grant `clientPermissions.urlParameters.namespace: { read: true, write: true }`; the read-only fixture sets `write: false` to verify Luigi rejects the MFE write.
- `rest/config.account-entity-with-dashboard-and-search.json` adds SearchList. `/api/search` serves `search/httpbins.twelve-search-results.json` with `q`, `filter.<field>`, `page`, and `limit`; requests are recorded as `resourceSearch`.
- GraphQL responses omit `__typename`; the real type names are unknown and Apollo does not need them here. Include every field the query selects (Apollo logs `Missing field` otherwise, e.g. `metadata.deletionTimestamp`).

### Gateway routing

`crdGatewayApiUrl` is `<origin>/api/kubernetes-graphql-gateway/root:orgs:test-org/graphql`; the library rewrites the workspace segment per account. `gateway-request.ts` identifies the operation by the query text and the account by the workspace path or the `name` variable, and records the `namespace` variable (`BackendRequest.namespace`):

| Operation            | Observed request                                                                                                                                               | Default mock                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `accountsList`       | `Accounts(limit: $limit)` on `root:orgs:test-org`                                                                                                              | four ready accounts (`account-alpha` … `account-delta`)     |
| `accountsWatch`      | SSE subscription `core_platform_mesh_io_v1alpha1_accounts`, `Accept: text/event-stream`                                                                        | `event: complete`, no changes                               |
| `accountInfoRead`    | `AccountInfo(name: "account")` on `root:orgs:test-org:<account>`                                                                                               | succeeds                                                    |
| `accountRead`        | `Account(name: $name)` on `root:orgs:test-org`, `variables.name = <account>`                                                                                   | succeeds                                                    |
| `logicalClusterRead` | `LogicalCluster(name: "cluster")` after a successful account info read                                                                                         | phase `Ready`                                               |
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
```

`gateway/httpbin-read.missing-namespace-argument.json` is the gateway's answer to a read of a namespaced resource without `namespace`: `GetItem` requires the argument for namespace-scoped resources and fails with `missing required argument: namespace`, and the item field is non-null, so `data` is `null` (`pm/platform-mesh/services/kubernetes-graphql-gateway/gateway/resolver/resolver.go`, `resolver/arguments.go`, `schema/fields/query.go`).

Assert which calls happened with `portalBackend.requestsTo(endpoint, accountName)` (endpoints: the gateway operations and `accountEntityConfig`).

To support a new call: add the mock file, reference it in `mock-catalog.ts`, add the operation signature in `gateway-request.ts` (or a REST branch in `portal-backend-mock.ts`) and a default.

### Discovering calls

To see what the portal really requests for a flow, write a temporary spec in `tests/<setup>/` that logs `page.on('request')` / `route.request().postDataJSON()` for `/rest/` and `/api/` URLs (an unmocked call is also listed in the fixture's failure message), run it, and delete it afterwards. Never commit discovery specs.

## Verified behavior covered by the tests

Every test starts like a user: it opens `/`, which lands on `/home/overview` with the Overview nav item selected (no web component, no backend call), clicks the Accounts nav item, and opens `account-gamma` by clicking its row. Back navigation is checked twice: back to the accounts list, then back to the overview. Sequence for an account: `AccountInfo` read → `/rest/config/core_platform-mesh_io_account?...` → `Account` read in the dashboard (`generic-detail-view`).

| Failing call | Response                                       | Expected UI (current behavior)                                                                                                          | Back button         |
| ------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| AccountInfo  | HTTP 404                                       | `/error/404` with title and illustration, only the error view, no side nav, no alert; account children and Account read never requested | list, then overview |
| AccountInfo  | GraphQL error with "forbidden"                 | `/error/403`, same as above                                                                                                             | list, then overview |
| AccountInfo  | HTTP 403 status, HTTP 500, other GraphQL error | alert `Failed to read account info.` + error detail; dashboard still renders                                                            | list, then overview |
| Account      | HTTP 404 / GraphQL "forbidden"                 | `/error/404` / `/error/403`, only the error view, no alert (dashboard history entry replaced)                                           | list, then overview |
| Account      | HTTP 403 status, HTTP 500, other GraphQL error | dashboard shows read state "Could not load resource", no alert                                                                          | list, then overview |

Why: `ErrorHandlerService.redirectToErrorPage` redirects only for `statusCode === 404` or a message containing `forbidden` / `access denied`. A plain HTTP 403 becomes Apollo `ServerError: Response not successful: Received status code 403`, which matches neither. The user decided to test both 403 shapes and to pin the current behavior for 500 / other errors.

"Only the error page is rendered" is checked by decoding Luigi's web component tags (`luigi-wc-<hex of view URL>`) inside `.wcContainer` (`PortalShell.renderedViews()` must equal `['error-component']`), plus the account's `dashboard_dashboard` nav item being hidden and the request log.

The error page is checked for its title **and** its illustration: the `ui5-illustrated-message` shadow DOM must contain the `img` labelled with the scene from `error.component.ts` (404 `NoEntries`, 403 `tnt/UnsuccessfulAuth`) and the visible SVG drawing of that scene (`#sapIllus-Scene-NoEntries`, `#tnt-Scene-UnsuccessfulAuth`). A visible SVG has a size, so this proves the image was drawn, not only configured.

Mutation checks done when the tests were written (rebuild `dist-wc` for mutations in `projects/wc`): removing `abandonPendingNavigation()` in `NodeContextProcessingServiceImpl` fails both AccountInfo redirect tests (URL stays on the dashboard); forcing `replaceHistory = true` fails their back-button step (Back lands on the overview instead of the list). Changing the 404 scene in `error.component.ts` to an unregistered one (`NoMail`) fails both 404 tests on the illustration check while the title still matches. Removing an illustration import from `error.component.ts` is **not** a valid mutation: `NoEntries` is also imported by the detail view and `tnt/UnsuccessfulAuth` by `@openmfp/ngx`, so both stay in the bundle.

### Httpbin navigation (`httpbin-navigation.spec.ts`)

Starts like the account tests with the httpbin account entity config for `account-gamma`, waits until the account dashboard is rendered, then clicks the Http Bins nav item. The header namespace selection writes `?namespace=-all-` to the list URL. Opening `httpbin-beta` lands on `/home/accounts/account-gamma/orchestrate_platform-mesh_io_httpbins/httpbin-beta/dashboard?namespace=team-b`. Details, Status and Dashboard again must each show exactly `?namespace=team-b`, be the selected nav item, render only `generic-detail-view` with the httpbin name, and read the `HttpBin` with namespace `team-b`. `CustomRoutingConfigServiceImpl` leaves Luigi's `preserveQueryParams` unset (off), so Luigi drops the query on every navigation; `NamespacedResourceSelectionService` remembers the namespace of the opened namespaced resource in `NodeContextProcessingServiceImpl` and the node change hook writes it back to the URL (`addSearchParams(..., false, true)`: `replaceState` without a Luigi config update) on every node inside that resource.

A second test opens the same httpbin dashboard, then clicks the Accounts breadcrumb (`/home/accounts`) and the Home breadcrumb (`/home/overview`) and requires the `namespace` parameter to be gone on both. The paths are hard assertions, the missing parameter is a soft assertion so both steps are always checked. With `preserveQueryParams: true` it failed on both steps (`namespace=team-b` kept). Breadcrumb links are found by accessible name, which ui5 builds as `<label> <n> of <total>` (their inner text is empty, the label is slotted).

Nav item test ids follow Luigi `NavigationHelpers.prepareForTests`: `pathSegment` and `label` are each lowercased, stripped of spaces and URI-encoded, then joined with `_` (`orchestrate_platform-mesh_io_httpbins_httpbins`). `PortalShell.navigationItem` builds them the same way.

Why the test waits for the account dashboard: Luigi renders `compound` nodes (both dashboards) asynchronously (`renderWebComponentCompound` → `createCompoundContainerAsync`) and appends the result even after navigating away. Clicking the next nav item before the dashboard is rendered leaves both views in `.wcContainer` (seen in 6 of 20 runs before the wait was added).

Mutation checks: without the namespace restore (`preserveQueryParams` off and no `restoreNamespaceSearchParam` call in `NodeChangeHookConfigServiceImpl`) both tests fail on the dashboard URL (`.../httpbin-beta/dashboard` without `?namespace=team-b`): the parameter is already lost when the httpbin is opened, before any sibling node. Restoring the namespace on every node, also outside the resource, fails only the breadcrumb test (`namespace=team-b` on `/home/accounts` and `/home/overview`).

### Httpbin read failures (`httpbin-navigation.spec.ts`, `when reading the httpbin fails`)

Read-failure tests open the httpbin dashboard directly. Recovery cases replace the next `HttpBin` response with the success mock before Retry; the read-only-permission case checks that selecting a namespace cannot write it to the URL.

- **Namespace known, other GraphQL error:** `.../httpbin-beta/dashboard?namespace=team-b` with `gateway/errors/graphql-error-service-unavailable.json`. Subtitle `Please try again.`, no namespace select, Retry enabled, no `namespacesList` request. Retry reads the httpbin again in `team-b` and the URL keeps `?namespace=team-b`.
- **Namespace parameter missing:** `.../httpbin-beta/dashboard` with `gateway/httpbin-read.missing-namespace-argument.json`. The read is sent without `namespace`. `NodeContextProcessingServiceImpl` lists the workspace namespaces through `NamespaceService` (`namespacesList`) for a namespaced entity without a namespace and puts them into the node context as `namespaces`, the detail view renders them in a select (`generic-detail-view-namespace-select`, options `team-a`, `team-b`), the subtitle is `Select a namespace and try again.` and Retry carries the `disabled` attribute until a namespace is selected. Selecting `team-b` writes `?namespace=team-b` at once (`LuigiClient.addCoreSearchParams(..., false, true)` with the node's namespace write grant: `replaceState` without a Luigi config update) and sends no read. Retry calls `LuigiCoreService.configChanged()`; the node context is processed again with the namespace and the view gets a context with `namespaceId`, which triggers exactly one new read in `team-b` (calling `readResource()` in addition sent a second, duplicate read).

- **Namespace read fails:** as above, but `namespacesList` answers HTTP 500. `NodeContextProcessingServiceImpl` alerts `Failed to read namespaces.` with the error detail through `ErrorHandlerService.showError` (no 403/404 redirect: a failed namespace read must not move the user away from the resource) and the select has no options. The icon-only refresh button next to the select (`generic-detail-view-namespace-refresh`) lists the namespaces again through `NamespaceService`: a GraphQL error is alerted the same way, a successful answer fills the select (`team-a`, `team-b`) and the flow continues as in the missing-namespace test. Each alert is found by its error detail (`portalShell.alert.filter({ hasText })`) because earlier alerts can still be open. `portalBackend.respondToNamespacesList(account, mock)` overrides the answer per account.

Disabled state is asserted with `toHaveAttribute('disabled')`: the button is a `ui5-button`, not a native button.

Mutation checks: not listing the namespaces in `NodeContextProcessingServiceImpl` fails the missing-namespace test on the options (`element(s) not found`); removing the `[disabled]` binding fails it on the disabled check; not writing the search param on selection fails it on the URL right after selecting (no `?namespace=team-b`). Logging instead of alerting the failed namespace read in `NodeContextProcessingServiceImpl` fails the namespace-read test on the first alert; logging instead of alerting a failed refresh fails it on the alert after the refresh; ignoring a successful refresh result fails it on the options.
