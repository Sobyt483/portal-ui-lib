import type { PortalBackendMock } from '../../backend/portal-backend-mock.ts';
import { expect, test } from '../../fixtures/portal-test.ts';
import {
  gatewayErrorMocks,
  gatewayMocks,
  restMocks,
} from '../../mocks/mock-catalog.ts';
import { AccountDashboardPage } from '../../pages/account-dashboard.page.ts';
import { AccountsListPage } from '../../pages/accounts-list.page.ts';
import { HttpBinPage } from '../../pages/httpbin.page.ts';
import { HttpBinsListPage } from '../../pages/httpbins-list.page.ts';
import { OverviewPage } from '../../pages/overview.page.ts';
import { PortalShell } from '../../pages/portal-shell.ts';
import type { NavigationNode } from '../../pages/portal-shell.ts';
import type { Page } from '@playwright/test';

const selectedAccount = 'account-gamma';
const listedHttpBins = ['httpbin-alpha', 'httpbin-beta'];
const selectedHttpBin = 'httpbin-beta';
const selectedHttpBinNamespace = 'team-b';
const namespaceSearchParam = 'namespace';

test.describe('httpbin navigation within an account', () => {
  let accountsList: AccountsListPage;
  let accountDashboard: AccountDashboardPage;
  let httpBinsList: HttpBinsListPage;
  let httpBin: HttpBinPage;
  let portalShell: PortalShell;

  test.beforeEach(async ({ page, portalBackend }) => {
    accountsList = new AccountsListPage(page);
    accountDashboard = new AccountDashboardPage(page);
    httpBinsList = new HttpBinsListPage(page);
    httpBin = new HttpBinPage(page);
    portalShell = new PortalShell(page);
    portalBackend.respondToAccountEntityConfig(
      selectedAccount,
      restMocks.accountEntityConfigWithDashboardAndHttpBins,
    );

    await portalShell.open();
    await expect(page).toHaveURL(OverviewPage.path);
    await portalShell.navigationItem(AccountsListPage.navigation).click();
    await expect(page).toHaveURL(AccountsListPage.path);
    await accountsList.openAccount(selectedAccount);
    await expect(page).toHaveURL(AccountDashboardPage.path(selectedAccount));
    await expect(accountDashboard.field('spec.displayName')).toContainText(
      `Display name of ${selectedAccount}`,
    );
    await expect
      .poll(() => portalShell.renderedViews())
      .toEqual([AccountDashboardPage.viewName]);

    await portalShell.navigationItem(HttpBinsListPage.navigation).click();

    await expect(page).toHaveURL(
      (url) =>
        url.pathname === HttpBinsListPage.path(selectedAccount) &&
        url.searchParams.has(namespaceSearchParam),
    );
    for (const httpBinName of listedHttpBins) {
      await expect(httpBinsList.httpBinRow(httpBinName)).toBeVisible();
    }
    await expect
      .poll(() => portalShell.renderedViews())
      .toEqual([HttpBinsListPage.viewName]);
  });

  test('keeps the namespace of the opened httpbin in the URL of every httpbin node', async ({
    page,
    portalBackend,
  }) => {
    let httpBinReadsBefore = httpBinReads(portalBackend).length;

    await httpBinsList.openHttpBin(selectedHttpBin);

    await expectHttpBinNodeShown(page, HttpBinPage.dashboard);
    await expectHttpBinReadInSelectedNamespace(
      portalBackend,
      httpBinReadsBefore,
    );
    for (const node of HttpBinPage.navigation) {
      await expect(portalShell.navigationItem(node)).toBeVisible();
    }

    for (const node of [
      HttpBinPage.details,
      HttpBinPage.status,
      HttpBinPage.dashboard,
    ]) {
      httpBinReadsBefore = httpBinReads(portalBackend).length;

      await portalShell.navigationItem(node).click();

      await expectHttpBinNodeShown(page, node);
      await expectHttpBinReadInSelectedNamespace(
        portalBackend,
        httpBinReadsBefore,
      );
    }
  });

  test('removes the namespace from the URL when navigating via the breadcrumbs out of the httpbin', async ({
    page,
  }) => {
    await httpBinsList.openHttpBin(selectedHttpBin);
    await expectHttpBinNodeShown(page, HttpBinPage.dashboard);

    await portalShell.breadcrumb(AccountsListPage.navigation.label).click();

    await expectShownWithoutNamespace(page, AccountsListPage.path);
    await expect(accountsList.accountRow(selectedAccount)).toBeVisible();

    await portalShell.breadcrumb(OverviewPage.homeBreadcrumbLabel).click();

    await expectShownWithoutNamespace(page, OverviewPage.path);
    await expect(
      portalShell.navigationItem(OverviewPage.navigation),
    ).toHaveClass(PortalShell.selectedNavigationItemClass);
  });

  async function expectShownWithoutNamespace(page: Page, path: string) {
    await expect(page).toHaveURL((url) => url.pathname === path);
    expect
      .soft(
        new URL(page.url()).searchParams.get(namespaceSearchParam),
        `the ${namespaceSearchParam} parameter must be removed on ${path}`,
      )
      .toBeNull();
  }

  async function expectHttpBinNodeShown(page: Page, node: NavigationNode) {
    await expect(page).toHaveURL(
      `${HttpBinPage.path(selectedAccount, selectedHttpBin, node)}?${namespaceSearchParam}=${selectedHttpBinNamespace}`,
    );
    await expect(portalShell.navigationItem(node)).toHaveClass(
      PortalShell.selectedNavigationItemClass,
    );
    await expect(httpBin.field('metadata.name')).toContainText(selectedHttpBin);
    await expect
      .poll(() => portalShell.renderedViews())
      .toEqual([HttpBinPage.viewName]);
  }

  async function expectHttpBinReadInSelectedNamespace(
    portalBackend: PortalBackendMock,
    readsBefore: number,
  ) {
    await expect
      .poll(() => [
        ...new Set(
          httpBinReads(portalBackend)
            .slice(readsBefore)
            .map((request) => request.namespace),
        ),
      ])
      .toEqual([selectedHttpBinNamespace]);
  }

  function httpBinReads(portalBackend: PortalBackendMock) {
    return portalBackend.requestsTo('httpBinRead', selectedAccount);
  }
});

test.describe('when reading the httpbin fails', () => {
  const namespaces = ['team-a', 'team-b'];
  let httpBin: HttpBinPage;
  let portalShell: PortalShell;

  test.beforeEach(({ page, portalBackend }) => {
    httpBin = new HttpBinPage(page);
    portalShell = new PortalShell(page);
    portalBackend.respondToAccountEntityConfig(
      selectedAccount,
      restMocks.accountEntityConfigWithDashboardAndHttpBins,
    );
  });

  test('shows the read failure and retries in the known namespace for a GraphQL error', async ({
    page,
    portalBackend,
  }) => {
    portalBackend.respondToHttpBinRead(
      selectedAccount,
      gatewayErrorMocks.graphqlErrorServiceUnavailable,
    );
    const dashboardPath = `${HttpBinPage.path(selectedAccount, selectedHttpBin, HttpBinPage.dashboard)}?${namespaceSearchParam}=${selectedHttpBinNamespace}`;

    await page.goto(dashboardPath);

    await expectReadFailureShown(HttpBinPage.readFailedSubtitle);
    await expect(portalShell.alert).toHaveCount(0);
    await expect(httpBin.namespaceSelect).toHaveCount(0);
    await expect(httpBin.retryButton).not.toHaveAttribute('disabled');
    expect(httpBinReadNamespaces(portalBackend)).toEqual([
      selectedHttpBinNamespace,
    ]);
    expect(portalBackend.requestsTo('namespacesList', selectedAccount)).toEqual(
      [],
    );

    portalBackend.respondToHttpBinRead(
      selectedAccount,
      gatewayMocks.httpBinReadForHttpBinBetaInTeamB,
    );
    await httpBin.retryButton.click();

    await expectHttpBinShown(page, dashboardPath);
    expect(httpBinReadNamespaces(portalBackend)).toEqual([
      selectedHttpBinNamespace,
      selectedHttpBinNamespace,
    ]);
  });

  test('asks for a namespace before retrying when the namespace parameter is missing', async ({
    page,
    portalBackend,
  }) => {
    portalBackend.respondToHttpBinRead(
      selectedAccount,
      gatewayMocks.httpBinReadMissingNamespaceArgument,
    );
    const dashboardPath = HttpBinPage.path(
      selectedAccount,
      selectedHttpBin,
      HttpBinPage.dashboard,
    );

    await page.goto(dashboardPath);

    await expectReadFailureShown(HttpBinPage.namespaceMissingSubtitle);
    await expect(portalShell.alert).toHaveCount(0);
    await expect(page).toHaveURL(dashboardPath);
    expect(httpBinReadNamespaces(portalBackend)).toEqual([undefined]);
    expect(
      portalBackend.requestsTo('namespacesList', selectedAccount),
    ).toHaveLength(1);
    await expect(httpBin.namespaceSelect).toBeVisible();
    await expect(httpBin.namespaceRefreshButton).toBeVisible();
    await expect(httpBin.namespaceOptions()).toHaveText(namespaces);
    await expect(httpBin.retryButton).toHaveAttribute('disabled');

    await httpBin.namespaceSelect.click();
    await httpBin.namespaceOption(selectedHttpBinNamespace).click();

    await expect(page).toHaveURL(
      `${dashboardPath}?${namespaceSearchParam}=${selectedHttpBinNamespace}`,
    );
    await expect(httpBin.retryButton).not.toHaveAttribute('disabled');
    await expect(httpBin.readState).toBeVisible();
    expect(httpBinReadNamespaces(portalBackend)).toEqual([undefined]);

    portalBackend.respondToHttpBinRead(
      selectedAccount,
      gatewayMocks.httpBinReadForHttpBinBetaInTeamB,
    );
    await httpBin.retryButton.click();

    await expectHttpBinShown(
      page,
      `${dashboardPath}?${namespaceSearchParam}=${selectedHttpBinNamespace}`,
    );
    expect(httpBinReadNamespaces(portalBackend)).toEqual([
      undefined,
      selectedHttpBinNamespace,
    ]);
  });

  test('respects a read-only namespace permission when a namespace is selected', async ({
    page,
    portalBackend,
  }) => {
    portalBackend.respondToAccountEntityConfig(
      selectedAccount,
      restMocks.accountEntityConfigWithReadonlyNamespace,
    );
    portalBackend.respondToHttpBinRead(
      selectedAccount,
      gatewayMocks.httpBinReadMissingNamespaceArgument,
    );
    const dashboardPath = HttpBinPage.path(
      selectedAccount,
      selectedHttpBin,
      HttpBinPage.dashboard,
    );

    await page.goto(dashboardPath);
    await expectReadFailureShown(HttpBinPage.namespaceMissingSubtitle);
    await httpBin.namespaceSelect.click();
    await httpBin.namespaceOption(selectedHttpBinNamespace).click();

    await expect(httpBin.retryButton).not.toHaveAttribute('disabled');
    await expect(page).toHaveURL(dashboardPath);
    expect(httpBinReadNamespaces(portalBackend)).toEqual([undefined]);
  });

  test('alerts a failed namespace read and loads the namespaces with the refresh button', async ({
    page,
    portalBackend,
  }) => {
    portalBackend.respondToHttpBinRead(
      selectedAccount,
      gatewayMocks.httpBinReadMissingNamespaceArgument,
    );
    portalBackend.respondToNamespacesList(
      selectedAccount,
      gatewayErrorMocks.http500InternalServerError,
    );
    const dashboardPath = HttpBinPage.path(
      selectedAccount,
      selectedHttpBin,
      HttpBinPage.dashboard,
    );

    await page.goto(dashboardPath);

    await expectReadFailureShown(HttpBinPage.namespaceMissingSubtitle);
    await expectNamespaceReadFailureAlerted('Received status code 500');
    await expect(httpBin.namespaceSelect).toBeVisible();
    await expect(httpBin.namespaceOptions()).toHaveCount(0);
    await expect(httpBin.retryButton).toHaveAttribute('disabled');
    expect(
      portalBackend.requestsTo('namespacesList', selectedAccount),
    ).toHaveLength(1);

    portalBackend.respondToNamespacesList(
      selectedAccount,
      gatewayErrorMocks.graphqlErrorServiceUnavailable,
    );
    await httpBin.namespaceRefreshButton.click();

    await expectNamespaceReadFailureAlerted(
      'the server is currently unable to handle the request',
    );
    await expect(httpBin.namespaceOptions()).toHaveCount(0);
    expect(
      portalBackend.requestsTo('namespacesList', selectedAccount),
    ).toHaveLength(2);

    portalBackend.respondToNamespacesList(
      selectedAccount,
      gatewayMocks.namespacesListWithTeamAAndTeamB,
    );
    await httpBin.namespaceRefreshButton.click();

    await expect(httpBin.namespaceOptions()).toHaveText(namespaces);
    expect(
      portalBackend.requestsTo('namespacesList', selectedAccount),
    ).toHaveLength(3);
    await expect(httpBin.retryButton).toHaveAttribute('disabled');

    await httpBin.namespaceSelect.click();
    await httpBin.namespaceOption(selectedHttpBinNamespace).click();

    await expect(page).toHaveURL(
      `${dashboardPath}?${namespaceSearchParam}=${selectedHttpBinNamespace}`,
    );
    await expect(httpBin.retryButton).not.toHaveAttribute('disabled');

    portalBackend.respondToHttpBinRead(
      selectedAccount,
      gatewayMocks.httpBinReadForHttpBinBetaInTeamB,
    );
    await httpBin.retryButton.click();

    await expectHttpBinShown(
      page,
      `${dashboardPath}?${namespaceSearchParam}=${selectedHttpBinNamespace}`,
    );
    expect(httpBinReadNamespaces(portalBackend)).toEqual([
      undefined,
      selectedHttpBinNamespace,
    ]);
  });

  async function expectNamespaceReadFailureAlerted(errorDetail: string) {
    const alert = portalShell.alert.filter({ hasText: errorDetail });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(HttpBinPage.namespacesReadFailedAlert);
  }

  async function expectReadFailureShown(subtitle: string) {
    await expect(portalShell.navigationItem(HttpBinPage.dashboard)).toHaveClass(
      PortalShell.selectedNavigationItemClass,
    );
    await expect(httpBin.readState).toHaveAttribute(
      'title-text',
      HttpBinPage.readFailedTitle,
    );
    await expect(httpBin.readState).toHaveAttribute('subtitle-text', subtitle);
    await expect
      .poll(() => portalShell.renderedViews())
      .toEqual([HttpBinPage.viewName]);
  }

  async function expectHttpBinShown(page: Page, path: string) {
    await expect(httpBin.field('metadata.name')).toContainText(selectedHttpBin);
    await expect(httpBin.readState).toHaveCount(0);
    await expect(page).toHaveURL(path);
  }

  function httpBinReadNamespaces(portalBackend: PortalBackendMock) {
    return portalBackend
      .requestsTo('httpBinRead', selectedAccount)
      .map((request) => request.namespace);
  }
});
