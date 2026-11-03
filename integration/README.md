# Integration tests

Playwright tests that run the portal built from this repository against a mocked backend. Setup, mocks and conventions are described in [AGENTS.md](AGENTS.md).

## Explore the portal with the mocks

The mocks exist only inside a Playwright test (the `portalBackend` fixture installs them on the test's page), so opening `http://localhost:4400` in your own browser gives a portal without a backend. To click through the real portal with the mocks active, run a spec in debug mode:

```bash
npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts --debug
```

This opens a visible Chromium window and the Playwright Inspector, paused before the first step. While the test is paused the page is live, and every request covered by the mocks is answered.

- Step through the test or resume it from the Inspector. To stay at a specific point, add a temporary `await page.pause()` to the test and remove it afterwards.
- Requests the mocks do not cover are answered with `501`.
- Http Bins are listed only for `account-gamma`, because this spec enables them for that account.
- `error-without-side-navigation.spec.ts` opens a node without a side navigation. Its specs answer `/rest/config` for that account with the extra `full-page` node.
- The portal is served from a build of the current sources. Stop a stale server first (`pkill -f serve-portal.ts`), and run `npm run build:wc` after changing `projects/wc`.

## Debug a single test

Every test can be run on its own in debug mode. The `-g` pattern is the test's innermost `describe` title followed by the test title, which selects exactly that test. `file:line` would not: tests generated in a loop share one source line.

### account-navigation.spec.ts

- account navigation from the accounts list › opens the account dashboard when account info and account are read

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'account navigation from the accounts list opens the account dashboard when account info and account are read' --debug
  ```

- when reading the account info fails › keeps the URL and the side navigation and shows the 401 error for HTTP 401 Unauthorized

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when reading the account info fails keeps the URL and the side navigation and shows the 401 error for HTTP 401 Unauthorized' --debug
  ```

- when reading the account info fails › keeps the URL and the side navigation and shows the 403 error for HTTP 403 Forbidden

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when reading the account info fails keeps the URL and the side navigation and shows the 403 error for HTTP 403 Forbidden' --debug
  ```

- when reading the account info fails › keeps the URL and the side navigation and shows the 403 error for a GraphQL "forbidden" error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when reading the account info fails keeps the URL and the side navigation and shows the 403 error for a GraphQL "forbidden" error' --debug
  ```

- when reading the account info fails › keeps the URL and the side navigation and shows the 404 error for HTTP 404 Not Found

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when reading the account info fails keeps the URL and the side navigation and shows the 404 error for HTTP 404 Not Found' --debug
  ```

- when reading the account info fails › keeps the URL and the side navigation and shows the 500 error for HTTP 500 Internal Server Error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when reading the account info fails keeps the URL and the side navigation and shows the 500 error for HTTP 500 Internal Server Error' --debug
  ```

- when reading the account info fails › keeps the URL and the side navigation and shows the 500 error for any other GraphQL error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when reading the account info fails keeps the URL and the side navigation and shows the 500 error for any other GraphQL error' --debug
  ```

- when reading the account info fails › shows the dashboard after a successful retry

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when reading the account info fails shows the dashboard after a successful retry' --debug
  ```

- when reading the account info fails › keeps showing the error when the retry fails again

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when reading the account info fails keeps showing the error when the retry fails again' --debug
  ```

- when reading the account info fails › shows the error instead of every node of the account and never loads an iframe node

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when reading the account info fails shows the error instead of every node of the account and never loads an iframe node' --debug
  ```

- when reading the account info fails › reads the account info again when the account is opened again

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when reading the account info fails reads the account info again when the account is opened again' --debug
  ```

- when the account is missing or forbidden and the server returns no nodes for it › stays on the account URL with the side navigation of the accounts list and shows the 404 error for HTTP 404 Not Found

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the account is missing or forbidden and the server returns no nodes for it stays on the account URL with the side navigation of the accounts list and shows the 404 error for HTTP 404 Not Found' --debug
  ```

- when the account is missing or forbidden and the server returns no nodes for it › stays on the account URL with the side navigation of the accounts list and shows the 403 error for a GraphQL "forbidden" error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the account is missing or forbidden and the server returns no nodes for it stays on the account URL with the side navigation of the accounts list and shows the 403 error for a GraphQL "forbidden" error' --debug
  ```

- when the account is missing or forbidden and the server returns no nodes for it › shows the dashboard and the navigation of the account after a successful retry

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the account is missing or forbidden and the server returns no nodes for it shows the dashboard and the navigation of the account after a successful retry' --debug
  ```

- when the account is missing or forbidden and the server returns no nodes for it › shows a healthy account with its own navigation afterwards

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the account is missing or forbidden and the server returns no nodes for it shows a healthy account with its own navigation afterwards' --debug
  ```

- when loading the nodes of the account fails › stays on the account URL with the side navigation of the accounts list and shows the 403 error for HTTP 403 Forbidden

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when loading the nodes of the account fails stays on the account URL with the side navigation of the accounts list and shows the 403 error for HTTP 403 Forbidden' --debug
  ```

- when loading the nodes of the account fails › stays on the account URL with the side navigation of the accounts list and shows the 500 error for HTTP 500 Internal Server Error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when loading the nodes of the account fails stays on the account URL with the side navigation of the accounts list and shows the 500 error for HTTP 500 Internal Server Error' --debug
  ```

- when loading the nodes of the account fails › loads the nodes again and shows the dashboard after a successful retry

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when loading the nodes of the account fails loads the nodes again and shows the dashboard after a successful retry' --debug
  ```

- when the organization is not ready › keeps the URL and the side navigation and shows the 503 error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the organization is not ready keeps the URL and the side navigation and shows the 503 error' --debug
  ```

- when the organization is not ready › shows the dashboard after a successful retry

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the organization is not ready shows the dashboard after a successful retry' --debug
  ```

- when the account info is read but reading the account fails › keeps the URL and the side navigation and shows the 401 error for HTTP 401 Unauthorized

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the account info is read but reading the account fails keeps the URL and the side navigation and shows the 401 error for HTTP 401 Unauthorized' --debug
  ```

- when the account info is read but reading the account fails › keeps the URL and the side navigation and shows the 403 error for HTTP 403 Forbidden

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the account info is read but reading the account fails keeps the URL and the side navigation and shows the 403 error for HTTP 403 Forbidden' --debug
  ```

- when the account info is read but reading the account fails › keeps the URL and the side navigation and shows the 403 error for a GraphQL "forbidden" error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the account info is read but reading the account fails keeps the URL and the side navigation and shows the 403 error for a GraphQL "forbidden" error' --debug
  ```

- when the account info is read but reading the account fails › keeps the URL and the side navigation and shows the 404 error for HTTP 404 Not Found

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the account info is read but reading the account fails keeps the URL and the side navigation and shows the 404 error for HTTP 404 Not Found' --debug
  ```

- when the account info is read but reading the account fails › keeps the URL and the side navigation and shows the 500 error for HTTP 500 Internal Server Error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the account info is read but reading the account fails keeps the URL and the side navigation and shows the 500 error for HTTP 500 Internal Server Error' --debug
  ```

- when the account info is read but reading the account fails › keeps the URL and the side navigation and shows the 500 error for any other GraphQL error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the account info is read but reading the account fails keeps the URL and the side navigation and shows the 500 error for any other GraphQL error' --debug
  ```

- when the account info is read but reading the account fails › shows the account after a successful retry

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the account info is read but reading the account fails shows the account after a successful retry' --debug
  ```

- when listing the accounts fails › keeps the URL and the side navigation and shows the 401 error for HTTP 401 Unauthorized

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when listing the accounts fails keeps the URL and the side navigation and shows the 401 error for HTTP 401 Unauthorized' --debug
  ```

- when listing the accounts fails › keeps the URL and the side navigation and shows the 403 error for HTTP 403 Forbidden

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when listing the accounts fails keeps the URL and the side navigation and shows the 403 error for HTTP 403 Forbidden' --debug
  ```

- when listing the accounts fails › keeps the URL and the side navigation and shows the 403 error for a GraphQL "forbidden" error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when listing the accounts fails keeps the URL and the side navigation and shows the 403 error for a GraphQL "forbidden" error' --debug
  ```

- when listing the accounts fails › keeps the URL and the side navigation and shows the 404 error for HTTP 404 Not Found

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when listing the accounts fails keeps the URL and the side navigation and shows the 404 error for HTTP 404 Not Found' --debug
  ```

- when listing the accounts fails › keeps the URL and the side navigation and shows the 500 error for HTTP 500 Internal Server Error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when listing the accounts fails keeps the URL and the side navigation and shows the 500 error for HTTP 500 Internal Server Error' --debug
  ```

- when listing the accounts fails › keeps the URL and the side navigation and shows the 500 error for any other GraphQL error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when listing the accounts fails keeps the URL and the side navigation and shows the 500 error for any other GraphQL error' --debug
  ```

- when listing the accounts fails › shows the accounts after a successful retry

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when listing the accounts fails shows the accounts after a successful retry' --debug
  ```

- when a failed account is opened directly › keeps the URL and the navigation of the account also after a reload

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when a failed account is opened directly keeps the URL and the navigation of the account also after a reload' --debug
  ```

- when a failed account is opened directly › keeps a deep URL of a virtual tree node with the navigation of the account

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when a failed account is opened directly keeps a deep URL of a virtual tree node with the navigation of the account' --debug
  ```

- when a failed account is opened directly › keeps /home/accounts/account-gamma/dashboard with the side navigation of the accounts list when the server returns no nodes

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when a failed account is opened directly keeps /home/accounts/account-gamma/dashboard with the side navigation of the accounts list when the server returns no nodes' --debug
  ```

- when a failed account is opened directly › keeps /home/accounts/account-gamma/orchestrate_platform-mesh_io_httpbins/httpbin-beta/dashboard with the side navigation of the accounts list when the server returns no nodes

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when a failed account is opened directly keeps /home/accounts/account-gamma/orchestrate_platform-mesh_io_httpbins/httpbin-beta/dashboard with the side navigation of the accounts list when the server returns no nodes' --debug
  ```

- when the URL matches no node › keeps /home/accounts/account-gamma/does-not-exist and shows the 404 error without side navigation

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the URL matches no node keeps /home/accounts/account-gamma/does-not-exist and shows the 404 error without side navigation' --debug
  ```

- when the URL matches no node › keeps /does/not/exist and shows the 404 error without side navigation

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the URL matches no node keeps /does/not/exist and shows the 404 error without side navigation' --debug
  ```

- when the session has expired › reloads the page with the login button when reading the account info fails

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the session has expired reloads the page with the login button when reading the account info fails' --debug
  ```

- when the session has expired › reloads the page with the login button when reading the account fails

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the session has expired reloads the page with the login button when reading the account fails' --debug
  ```

- when the session has expired › reloads the page with the login button when listing the accounts fails

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/account-navigation.spec.ts -g 'when the session has expired reloads the page with the login button when listing the accounts fails' --debug
  ```

### httpbin-navigation.spec.ts

- httpbin navigation within an account › keeps the namespace of the opened httpbin in the URL of every httpbin node

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'httpbin navigation within an account keeps the namespace of the opened httpbin in the URL of every httpbin node' --debug
  ```

- httpbin navigation within an account › removes the namespace from the URL when navigating via the breadcrumbs out of the httpbin

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'httpbin navigation within an account removes the namespace from the URL when navigating via the breadcrumbs out of the httpbin' --debug
  ```

- when reading the httpbin fails › keeps the URL and the navigation of the httpbin and shows the 401 error for HTTP 401 Unauthorized

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when reading the httpbin fails keeps the URL and the navigation of the httpbin and shows the 401 error for HTTP 401 Unauthorized' --debug
  ```

- when reading the httpbin fails › keeps the URL and the navigation of the httpbin and shows the 403 error for HTTP 403 Forbidden

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when reading the httpbin fails keeps the URL and the navigation of the httpbin and shows the 403 error for HTTP 403 Forbidden' --debug
  ```

- when reading the httpbin fails › keeps the URL and the navigation of the httpbin and shows the 403 error for a GraphQL "forbidden" error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when reading the httpbin fails keeps the URL and the navigation of the httpbin and shows the 403 error for a GraphQL "forbidden" error' --debug
  ```

- when reading the httpbin fails › keeps the URL and the navigation of the httpbin and shows the 404 error for HTTP 404 Not Found

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when reading the httpbin fails keeps the URL and the navigation of the httpbin and shows the 404 error for HTTP 404 Not Found' --debug
  ```

- when reading the httpbin fails › keeps the URL and the navigation of the httpbin and shows the 500 error for HTTP 500 Internal Server Error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when reading the httpbin fails keeps the URL and the navigation of the httpbin and shows the 500 error for HTTP 500 Internal Server Error' --debug
  ```

- when reading the httpbin fails › keeps the URL and the navigation of the httpbin and shows the 500 error for any other GraphQL error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when reading the httpbin fails keeps the URL and the navigation of the httpbin and shows the 500 error for any other GraphQL error' --debug
  ```

- when reading the httpbin fails › offers the login button instead of a namespace selection when the session has expired

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when reading the httpbin fails offers the login button instead of a namespace selection when the session has expired' --debug
  ```

- when reading the httpbin fails › shows the read failure and retries in the known namespace for a GraphQL error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when reading the httpbin fails shows the read failure and retries in the known namespace for a GraphQL error' --debug
  ```

- when reading the httpbin fails › asks for a namespace before retrying when the namespace parameter is missing

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when reading the httpbin fails asks for a namespace before retrying when the namespace parameter is missing' --debug
  ```

- when reading the httpbin fails › alerts a failed namespace read and loads the namespaces with the refresh button

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when reading the httpbin fails alerts a failed namespace read and loads the namespaces with the refresh button' --debug
  ```

- when reading the account info of an opened httpbin fails › keeps the URL and the navigation of the httpbin and replaces its view with the error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when reading the account info of an opened httpbin fails keeps the URL and the navigation of the httpbin and replaces its view with the error' --debug
  ```

- when listing the httpbins fails › keeps the URL and the navigation of the account and shows the 401 error for HTTP 401 Unauthorized

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when listing the httpbins fails keeps the URL and the navigation of the account and shows the 401 error for HTTP 401 Unauthorized' --debug
  ```

- when listing the httpbins fails › keeps the URL and the navigation of the account and shows the 403 error for HTTP 403 Forbidden

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when listing the httpbins fails keeps the URL and the navigation of the account and shows the 403 error for HTTP 403 Forbidden' --debug
  ```

- when listing the httpbins fails › keeps the URL and the navigation of the account and shows the 403 error for a GraphQL "forbidden" error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when listing the httpbins fails keeps the URL and the navigation of the account and shows the 403 error for a GraphQL "forbidden" error' --debug
  ```

- when listing the httpbins fails › keeps the URL and the navigation of the account and shows the 404 error for HTTP 404 Not Found

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when listing the httpbins fails keeps the URL and the navigation of the account and shows the 404 error for HTTP 404 Not Found' --debug
  ```

- when listing the httpbins fails › keeps the URL and the navigation of the account and shows the 500 error for HTTP 500 Internal Server Error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when listing the httpbins fails keeps the URL and the navigation of the account and shows the 500 error for HTTP 500 Internal Server Error' --debug
  ```

- when listing the httpbins fails › keeps the URL and the navigation of the account and shows the 500 error for any other GraphQL error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when listing the httpbins fails keeps the URL and the navigation of the account and shows the 500 error for any other GraphQL error' --debug
  ```

- when listing the httpbins fails › shows the httpbins after a successful retry

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/httpbin-navigation.spec.ts -g 'when listing the httpbins fails shows the httpbins after a successful retry' --debug
  ```

### error-without-side-navigation.spec.ts

- a node without side navigation › shows its resource without side navigation

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'a node without side navigation shows its resource without side navigation' --debug
  ```

- when reading its resource fails › keeps the URL, stays without side navigation and shows the 401 error for HTTP 401 Unauthorized

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading its resource fails keeps the URL, stays without side navigation and shows the 401 error for HTTP 401 Unauthorized' --debug
  ```

- when reading its resource fails › keeps the URL, stays without side navigation and shows the 403 error for HTTP 403 Forbidden

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading its resource fails keeps the URL, stays without side navigation and shows the 403 error for HTTP 403 Forbidden' --debug
  ```

- when reading its resource fails › keeps the URL, stays without side navigation and shows the 403 error for a GraphQL "forbidden" error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading its resource fails keeps the URL, stays without side navigation and shows the 403 error for a GraphQL "forbidden" error' --debug
  ```

- when reading its resource fails › keeps the URL, stays without side navigation and shows the 404 error for HTTP 404 Not Found

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading its resource fails keeps the URL, stays without side navigation and shows the 404 error for HTTP 404 Not Found' --debug
  ```

- when reading its resource fails › keeps the URL, stays without side navigation and shows the 500 error for HTTP 500 Internal Server Error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading its resource fails keeps the URL, stays without side navigation and shows the 500 error for HTTP 500 Internal Server Error' --debug
  ```

- when reading its resource fails › keeps the URL, stays without side navigation and shows the 500 error for any other GraphQL error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading its resource fails keeps the URL, stays without side navigation and shows the 500 error for any other GraphQL error' --debug
  ```

- when reading its resource fails › shows the resource after a successful retry

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading its resource fails shows the resource after a successful retry' --debug
  ```

- when reading its resource fails › shows the resource after a retry once access was granted

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading its resource fails shows the resource after a retry once access was granted' --debug
  ```

- when reading its resource fails › shows a resource pending deletion without a retry

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading its resource fails shows a resource pending deletion without a retry' --debug
  ```

- when reading the account info fails › keeps the URL, stays without side navigation and shows the 401 error for HTTP 401 Unauthorized

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading the account info fails keeps the URL, stays without side navigation and shows the 401 error for HTTP 401 Unauthorized' --debug
  ```

- when reading the account info fails › keeps the URL, stays without side navigation and shows the 403 error for HTTP 403 Forbidden

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading the account info fails keeps the URL, stays without side navigation and shows the 403 error for HTTP 403 Forbidden' --debug
  ```

- when reading the account info fails › keeps the URL, stays without side navigation and shows the 403 error for a GraphQL "forbidden" error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading the account info fails keeps the URL, stays without side navigation and shows the 403 error for a GraphQL "forbidden" error' --debug
  ```

- when reading the account info fails › keeps the URL, stays without side navigation and shows the 404 error for HTTP 404 Not Found

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading the account info fails keeps the URL, stays without side navigation and shows the 404 error for HTTP 404 Not Found' --debug
  ```

- when reading the account info fails › keeps the URL, stays without side navigation and shows the 500 error for HTTP 500 Internal Server Error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading the account info fails keeps the URL, stays without side navigation and shows the 500 error for HTTP 500 Internal Server Error' --debug
  ```

- when reading the account info fails › keeps the URL, stays without side navigation and shows the 500 error for any other GraphQL error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading the account info fails keeps the URL, stays without side navigation and shows the 500 error for any other GraphQL error' --debug
  ```

- when reading the account info fails › shows the resource after a successful retry

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/error-without-side-navigation.spec.ts -g 'when reading the account info fails shows the resource after a successful retry' --debug
  ```

### search-list.spec.ts

- search list page › shows the header and the found resources

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'search list page shows the header and the found resources' --debug
  ```

- when the search fails › keeps the header, the URL and the side navigation and shows the 401 error instead of the table for HTTP 401 Unauthorized

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'when the search fails keeps the header, the URL and the side navigation and shows the 401 error instead of the table for HTTP 401 Unauthorized' --debug
  ```

- when the search fails › keeps the header, the URL and the side navigation and shows the 403 error instead of the table for HTTP 403 Forbidden

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'when the search fails keeps the header, the URL and the side navigation and shows the 403 error instead of the table for HTTP 403 Forbidden' --debug
  ```

- when the search fails › keeps the header, the URL and the side navigation and shows the 404 error instead of the table for HTTP 404 Not Found

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'when the search fails keeps the header, the URL and the side navigation and shows the 404 error instead of the table for HTTP 404 Not Found' --debug
  ```

- when the search fails › keeps the header, the URL and the side navigation and shows the 500 error instead of the table for HTTP 500 Internal Server Error

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'when the search fails keeps the header, the URL and the side navigation and shows the 500 error instead of the table for HTTP 500 Internal Server Error' --debug
  ```

- when the search fails › does not show the technical message of the request as the subtitle

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'when the search fails does not show the technical message of the request as the subtitle' --debug
  ```

- when the search fails › shows the resources after a successful retry

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'when the search fails shows the resources after a successful retry' --debug
  ```

- when a search term causes the failure › shows the detail of the response and keeps the term in the search input and the URL

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'when a search term causes the failure shows the detail of the response and keeps the term in the search input and the URL' --debug
  ```

- when a search term causes the failure › recovers when the user searches for another term

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'when a search term causes the failure recovers when the user searches for another term' --debug
  ```

- when a search term causes the failure › recovers when the user clears the search

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'when a search term causes the failure recovers when the user clears the search' --debug
  ```

- when a search term causes the failure › recovers from a failing term opened from the URL

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'when a search term causes the failure recovers from a failing term opened from the URL' --debug
  ```

- when the user may not list the resources › shows the 403 error without a retry and without a search request

  ```bash
  npx playwright test --config integration/playwright.config.ts integration/tests/platform-mesh/search-list.spec.ts -g 'when the user may not list the resources shows the 403 error without a retry and without a search request' --debug
  ```
