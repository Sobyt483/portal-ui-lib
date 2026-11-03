import { expect, test } from '../../fixtures/portal-test.ts';
import { gatewayFailures } from '../../mocks/gateway-failures.ts';
import {
  gatewayErrorMocks,
  gatewayMocks,
  restErrorMocks,
  restMocks,
} from '../../mocks/mock-catalog.ts';
import { AccountDashboardPage } from '../../pages/account-dashboard.page.ts';
import { AccountsListPage } from '../../pages/accounts-list.page.ts';
import { ErrorPage } from '../../pages/error.page.ts';
import type { ErrorCode } from '../../pages/error.page.ts';
import { OverviewPage } from '../../pages/overview.page.ts';
import { PortalShell } from '../../pages/portal-shell.ts';
import type { NavigationNode } from '../../pages/portal-shell.ts';
import type { Page } from '@playwright/test';

const listedAccounts = [
  'account-alpha',
  'account-beta',
  'account-gamma',
  'account-delta',
];
const selectedAccount = 'account-gamma';
const healthyAccount = 'account-delta';
const accountPath = `${AccountsListPage.path}/${selectedAccount}`;
const accountsNavigation = [
  OverviewPage.navigation,
  AccountsListPage.navigation,
];
const accountNavigation = [AccountDashboardPage.navigation];
const virtualTreeNode: NavigationNode = {
  pathSegment: 'virtual-tree',
  label: 'Virtual Tree',
};
const accountNavigationWithIframeNode: NavigationNode[] = [
  AccountDashboardPage.navigation,
  { pathSegment: 'full-page', label: 'Full Page' },
  { pathSegment: 'members', label: 'Members' },
  virtualTreeNode,
];

const accountWithoutNodesFailures = [
  {
    description: 'HTTP 404 Not Found',
    mockFile: gatewayErrorMocks.http404NotFound,
    errorCode: 404 as ErrorCode,
  },
  {
    description: 'a GraphQL "forbidden" error',
    mockFile: gatewayMocks.accountInfoReadForbiddenGraphqlError,
    errorCode: 403 as ErrorCode,
  },
];

const accountNodesFailures = [
  {
    description: 'HTTP 403 Forbidden',
    mockFile: restErrorMocks.http403Forbidden,
    errorCode: 403 as ErrorCode,
  },
  {
    description: 'HTTP 500 Internal Server Error',
    mockFile: restErrorMocks.http500InternalServerError,
    errorCode: 500 as ErrorCode,
  },
];

test.describe('account navigation from the accounts list', () => {
  let accountsList: AccountsListPage;
  let accountDashboard: AccountDashboardPage;
  let errorPage: ErrorPage;
  let portalShell: PortalShell;

  test.beforeEach(async ({ page, portalBackend }) => {
    accountsList = new AccountsListPage(page);
    accountDashboard = new AccountDashboardPage(page);
    errorPage = new ErrorPage(page);
    portalShell = new PortalShell(page);

    await portalShell.open();
    await expectOverviewShown(page);

    await portalShell.navigationItem(AccountsListPage.navigation).click();

    await expectAccountsListShown(page);
    for (const accountName of listedAccounts) {
      await expect(accountsList.accountRow(accountName)).toBeVisible();
    }
    expect(portalBackend.requestsTo('accountsList')).toHaveLength(1);
  });

  test('opens the account dashboard when account info and account are read', async ({
    page,
    portalBackend,
  }) => {
    await accountsList.openAccount(selectedAccount);

    await expectAccountDashboardShown(page, selectedAccount);
    await expect(portalShell.alert).toHaveCount(0);
    expect(
      portalBackend.requestsTo('accountInfoRead', selectedAccount),
    ).toHaveLength(1);
    expect(
      portalBackend.requestsTo('accountRead', selectedAccount),
    ).toHaveLength(1);
  });

  test.describe('when reading the account info fails', () => {
    for (const failure of gatewayFailures(
      gatewayMocks.accountInfoReadForbiddenGraphqlError,
    )) {
      test(`keeps the URL and the side navigation and shows the ${failure.errorCode} error for ${failure.description}`, async ({
        page,
        portalBackend,
      }) => {
        portalBackend.respondToAccountInfoRead(
          selectedAccount,
          failure.mockFile,
        );

        await accountsList.openAccount(selectedAccount);

        await expectErrorNodeShown(
          page,
          failure.errorCode,
          AccountDashboardPage.path(selectedAccount),
        );
        await portalShell.expectSideNavigation(
          accountNavigation,
          AccountDashboardPage.navigation,
        );
        expect(
          portalBackend.requestsTo('accountEntityConfig', selectedAccount),
          'the account nodes must be loaded for the side navigation',
        ).toHaveLength(1);
        expect(
          portalBackend.requestsTo('accountRead', selectedAccount),
          'the account view must not be rendered',
        ).toEqual([]);
      });
    }

    test('shows the dashboard after a successful retry', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayErrorMocks.http500InternalServerError,
      );
      await accountsList.openAccount(selectedAccount);
      await errorPage.expectShown(500);

      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayMocks.accountInfoReadSucceeds,
      );
      await errorPage.retryButton.click();

      await expectAccountDashboardShown(page, selectedAccount);
      await expect(errorPage.title).toHaveCount(0);
    });

    test('keeps showing the error when the retry fails again', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayErrorMocks.http500InternalServerError,
      );
      await accountsList.openAccount(selectedAccount);
      await errorPage.expectShown(500);

      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayErrorMocks.http404NotFound,
      );
      await errorPage.retryButton.click();

      await expectErrorNodeShown(
        page,
        404,
        AccountDashboardPage.path(selectedAccount),
      );
      await portalShell.expectSideNavigation(
        accountNavigation,
        AccountDashboardPage.navigation,
      );
    });

    test('shows the error instead of every node of the account and never loads an iframe node', async ({
      page,
      portalBackend,
    }) => {
      const membersNode = accountNavigationWithIframeNode[2];
      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayErrorMocks.http404NotFound,
      );
      portalBackend.respondToAccountEntityConfig(
        selectedAccount,
        restMocks.accountEntityConfigWithFullPageAndIframeNodes,
      );
      await accountsList.openAccount(selectedAccount);
      await errorPage.expectShown(404);

      await portalShell.navigationItem(membersNode).click();

      await expectErrorNodeShown(page, 404, `${accountPath}/members`);
      await portalShell.expectSideNavigation(
        accountNavigationWithIframeNode,
        membersNode,
      );
      await expect(page.locator('iframe')).toHaveCount(0);
    });

    test('reads the account info again when the account is opened again', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayErrorMocks.http404NotFound,
      );
      await accountsList.openAccount(selectedAccount);
      await errorPage.expectShown(404);
      await page.goBack();
      await expectAccountsListShown(page);

      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayMocks.accountInfoReadSucceeds,
      );
      await accountsList.openAccount(selectedAccount);

      await expectAccountDashboardShown(page, selectedAccount);
    });
  });

  test.describe('when the account is missing or forbidden and the server returns no nodes for it', () => {
    test.beforeEach(({ portalBackend }) => {
      portalBackend.respondToAccountEntityConfig(
        selectedAccount,
        restMocks.accountEntityConfigWithoutNodes,
      );
    });

    for (const failure of accountWithoutNodesFailures) {
      test(`stays on the account URL with the side navigation of the accounts list and shows the ${failure.errorCode} error for ${failure.description}`, async ({
        page,
        portalBackend,
      }) => {
        portalBackend.respondToAccountInfoRead(
          selectedAccount,
          failure.mockFile,
        );

        await accountsList.openAccount(selectedAccount);

        await expectErrorNodeShown(page, failure.errorCode, accountPath);
        await portalShell.expectSideNavigation(
          accountsNavigation,
          AccountsListPage.navigation,
        );
      });
    }

    test('shows the dashboard and the navigation of the account after a successful retry', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayErrorMocks.http404NotFound,
      );
      await accountsList.openAccount(selectedAccount);
      await errorPage.expectShown(404);

      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayMocks.accountInfoReadSucceeds,
      );
      portalBackend.respondToAccountEntityConfig(
        selectedAccount,
        restMocks.accountEntityConfigWithDashboard,
      );
      await errorPage.retryButton.click();

      await expectAccountDashboardShown(page, selectedAccount);
    });

    test('shows a healthy account with its own navigation afterwards', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayErrorMocks.http404NotFound,
      );
      await accountsList.openAccount(selectedAccount);
      await errorPage.expectShown(404);

      await portalShell.navigationItem(AccountsListPage.navigation).click();
      await expectAccountsListShown(page);
      await accountsList.openAccount(healthyAccount);

      await expectAccountDashboardShown(page, healthyAccount);
    });
  });

  test.describe('when loading the nodes of the account fails', () => {
    for (const failure of accountNodesFailures) {
      test(`stays on the account URL with the side navigation of the accounts list and shows the ${failure.errorCode} error for ${failure.description}`, async ({
        page,
        portalBackend,
      }) => {
        portalBackend.respondToAccountEntityConfig(
          selectedAccount,
          failure.mockFile,
        );

        await accountsList.openAccount(selectedAccount);

        await expectErrorNodeShown(page, failure.errorCode, accountPath);
        await portalShell.expectSideNavigation(
          accountsNavigation,
          AccountsListPage.navigation,
        );
      });
    }

    test('loads the nodes again and shows the dashboard after a successful retry', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountEntityConfig(
        selectedAccount,
        restErrorMocks.http500InternalServerError,
      );
      await accountsList.openAccount(selectedAccount);
      await errorPage.expectShown(500);

      portalBackend.respondToAccountEntityConfig(
        selectedAccount,
        restMocks.accountEntityConfigWithDashboard,
      );
      await errorPage.retryButton.click();

      await expectAccountDashboardShown(page, selectedAccount);
    });
  });

  test.describe('when the organization is not ready', () => {
    test.beforeEach(({ portalBackend }) => {
      portalBackend.respondToLogicalClusterRead(
        selectedAccount,
        gatewayMocks.logicalClusterReadInitializing,
      );
    });

    test('keeps the URL and the side navigation and shows the 503 error', async ({
      page,
    }) => {
      await accountsList.openAccount(selectedAccount);

      await expectErrorNodeShown(
        page,
        503,
        AccountDashboardPage.path(selectedAccount),
      );
      await portalShell.expectSideNavigation(
        accountNavigation,
        AccountDashboardPage.navigation,
      );
    });

    test('shows the dashboard after a successful retry', async ({
      page,
      portalBackend,
    }) => {
      await accountsList.openAccount(selectedAccount);
      await errorPage.expectShown(503);

      portalBackend.respondToLogicalClusterRead(
        selectedAccount,
        gatewayMocks.logicalClusterReadReady,
      );
      await errorPage.retryButton.click();

      await expectAccountDashboardShown(page, selectedAccount);
    });
  });

  test.describe('when the account info is read but reading the account fails', () => {
    for (const failure of gatewayFailures(
      gatewayMocks.accountReadForbiddenGraphqlError,
    )) {
      test(`keeps the URL and the side navigation and shows the ${failure.errorCode} error for ${failure.description}`, async ({
        page,
        portalBackend,
      }) => {
        portalBackend.respondToAccountRead(selectedAccount, failure.mockFile);

        await accountsList.openAccount(selectedAccount);

        await errorPage.expectShown(failure.errorCode);
        await expect(page).toHaveURL(
          AccountDashboardPage.path(selectedAccount),
        );
        await portalShell.expectSideNavigation(
          accountNavigation,
          AccountDashboardPage.navigation,
        );
        await expect
          .poll(() => portalShell.renderedViews())
          .toEqual([AccountDashboardPage.viewName]);
        await errorPage.expectRecoveryAction(failure.errorCode);
        await expect(portalShell.alert).toHaveCount(0);
        expect(
          portalBackend.requestsTo('accountInfoRead', selectedAccount),
        ).toHaveLength(1);
      });
    }

    test('shows the account after a successful retry', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountRead(
        selectedAccount,
        gatewayErrorMocks.http404NotFound,
      );
      await accountsList.openAccount(selectedAccount);
      await errorPage.expectShown(404);

      portalBackend.respondToAccountRead(
        selectedAccount,
        gatewayMocks.accountReadSucceeds,
      );
      await errorPage.retryButton.click();

      await expectAccountDashboardShown(page, selectedAccount);
      await expect(accountDashboard.errorState).toHaveCount(0);
    });
  });

  async function expectErrorNodeShown(
    page: Page,
    code: ErrorCode,
    path: string,
  ) {
    await errorPage.expectShown(code);
    await expect(page).toHaveURL(path);
    await expect
      .poll(() => portalShell.renderedViews())
      .toEqual([ErrorPage.viewName]);
    await errorPage.expectRecoveryAction(code);
    await expect(portalShell.alert).toHaveCount(0);
  }

  async function expectAccountDashboardShown(page: Page, accountName: string) {
    await expect(page).toHaveURL(AccountDashboardPage.path(accountName));
    await expect(accountDashboard.workspacePath).toHaveText(
      `root:orgs:test-org:${accountName}`,
    );
    await expect(accountDashboard.field('spec.displayName')).toContainText(
      `Display name of ${accountName}`,
    );
    await portalShell.expectSideNavigation(
      accountNavigation,
      AccountDashboardPage.navigation,
    );
    await expect
      .poll(() => portalShell.renderedViews())
      .toEqual([AccountDashboardPage.viewName]);
  }

  async function expectOverviewShown(page: Page) {
    await expect(page).toHaveURL(OverviewPage.path);
    await expect(
      portalShell.navigationItem(OverviewPage.navigation),
    ).toHaveClass(PortalShell.selectedNavigationItemClass);
  }

  async function expectAccountsListShown(page: Page) {
    await expect(page).toHaveURL(AccountsListPage.path);
    await expect(
      portalShell.navigationItem(AccountsListPage.navigation),
    ).toHaveClass(PortalShell.selectedNavigationItemClass);
    await expect(accountsList.accountRow(selectedAccount)).toBeVisible();
    await expect
      .poll(() => portalShell.renderedViews())
      .toEqual([AccountsListPage.viewName]);
  }
});

test.describe('when listing the accounts fails', () => {
  let accountsList: AccountsListPage;
  let errorPage: ErrorPage;
  let portalShell: PortalShell;

  test.beforeEach(async ({ page }) => {
    accountsList = new AccountsListPage(page);
    errorPage = new ErrorPage(page);
    portalShell = new PortalShell(page);

    await portalShell.open();
    await expect(page).toHaveURL(OverviewPage.path);
  });

  for (const failure of gatewayFailures()) {
    test(`keeps the URL and the side navigation and shows the ${failure.errorCode} error for ${failure.description}`, async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountsList(failure.mockFile);

      await portalShell.navigationItem(AccountsListPage.navigation).click();

      await errorPage.expectShown(failure.errorCode);
      await expect(page).toHaveURL(AccountsListPage.path);
      await portalShell.expectSideNavigation(
        accountsNavigation,
        AccountsListPage.navigation,
      );
      await expect
        .poll(() => portalShell.renderedViews())
        .toEqual([AccountsListPage.viewName]);
      await errorPage.expectRecoveryAction(failure.errorCode);
      await expect(accountsList.table).toBeHidden();
      await expect(accountsList.description).toBeHidden();
      await expect(portalShell.alert).toHaveCount(0);
    });
  }

  test('shows the accounts after a successful retry', async ({
    portalBackend,
  }) => {
    portalBackend.respondToAccountsList(
      gatewayErrorMocks.http500InternalServerError,
    );
    await portalShell.navigationItem(AccountsListPage.navigation).click();
    await errorPage.expectShown(500);

    portalBackend.respondToAccountsList(
      gatewayMocks.accountsListWithFourReadyAccounts,
    );
    await errorPage.retryButton.click();

    await expect(accountsList.table).toBeVisible();
    await expect(accountsList.description).toBeVisible();
    await expect(accountsList.accountRow(selectedAccount)).toBeVisible();
    await expect(errorPage.title).toHaveCount(0);
  });
});

test.describe('when a failed account is opened directly', () => {
  let errorPage: ErrorPage;
  let portalShell: PortalShell;

  test.beforeEach(({ page, portalBackend }) => {
    errorPage = new ErrorPage(page);
    portalShell = new PortalShell(page);
    portalBackend.respondToAccountInfoRead(
      selectedAccount,
      gatewayErrorMocks.http404NotFound,
    );
  });

  test('keeps the URL and the navigation of the account also after a reload', async ({
    page,
  }) => {
    const dashboardPath = AccountDashboardPage.path(selectedAccount);

    await page.goto(dashboardPath);

    await errorPage.expectShown(404);
    await expect(page).toHaveURL(dashboardPath);
    await portalShell.expectSideNavigation(
      accountNavigation,
      AccountDashboardPage.navigation,
    );

    await page.reload();

    await errorPage.expectShown(404);
    await expect(page).toHaveURL(dashboardPath);
    await portalShell.expectSideNavigation(
      accountNavigation,
      AccountDashboardPage.navigation,
    );
  });

  test('keeps a deep URL of a virtual tree node with the navigation of the account', async ({
    page,
    portalBackend,
  }) => {
    const deepPath = `${accountPath}/${virtualTreeNode.pathSegment}/some/deep/path`;
    portalBackend.respondToAccountEntityConfig(
      selectedAccount,
      restMocks.accountEntityConfigWithFullPageAndIframeNodes,
    );

    await page.goto(deepPath);

    await errorPage.expectShown(404);
    await expect(page).toHaveURL(deepPath);
    await portalShell.expectSideNavigation(
      accountNavigationWithIframeNode,
      virtualTreeNode,
    );
    await expect
      .poll(() => portalShell.renderedViews())
      .toEqual([ErrorPage.viewName]);
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  for (const path of [
    AccountDashboardPage.path(selectedAccount),
    `${accountPath}/orchestrate_platform-mesh_io_httpbins/httpbin-beta/dashboard`,
  ]) {
    test(`keeps ${path} with the side navigation of the accounts list when the server returns no nodes`, async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountEntityConfig(
        selectedAccount,
        restMocks.accountEntityConfigWithoutNodes,
      );

      await page.goto(path);

      await errorPage.expectShown(404);
      await expect(page).toHaveURL(path);
      await portalShell.expectSideNavigation(
        accountsNavigation,
        AccountsListPage.navigation,
      );
      await expect
        .poll(() => portalShell.renderedViews())
        .toEqual([ErrorPage.viewName]);
    });
  }
});

test.describe('when the URL matches no node', () => {
  for (const path of [`${accountPath}/does-not-exist`, '/does/not/exist']) {
    test(`keeps ${path} and shows the 404 error without side navigation`, async ({
      page,
    }) => {
      test.info().annotations.push({
        type: 'current behavior',
        description:
          'There is no node to stay on, so the global error node renders without a side navigation. Keeping the navigation of the deepest matching entity is a planned follow-up.',
      });
      const errorPage = new ErrorPage(page);
      const portalShell = new PortalShell(page);

      await page.goto(path);

      await errorPage.expectShown(404);
      await expect(page).toHaveURL(path);
      await portalShell.expectNoSideNavigation();
      await expect(errorPage.retryButton).toHaveCount(0);
      await expect(errorPage.subtitle).toHaveText(
        'Check if the URL is correct or search in the Portal. If this problem persists, create an issue.',
      );
    });
  }
});

test.describe('when the session has expired', () => {
  let accountDashboard: AccountDashboardPage;
  let errorPage: ErrorPage;

  test.beforeEach(({ page }) => {
    accountDashboard = new AccountDashboardPage(page);
    errorPage = new ErrorPage(page);
  });

  test('reloads the page with the login button when reading the account info fails', async ({
    page,
    portalBackend,
  }) => {
    const dashboardPath = AccountDashboardPage.path(selectedAccount);
    portalBackend.respondToAccountInfoRead(
      selectedAccount,
      gatewayErrorMocks.http401Unauthorized,
    );
    await page.goto(dashboardPath);
    await errorPage.expectShown(401);
    await expect(errorPage.signInButton).toHaveText('Login');

    portalBackend.respondToAccountInfoRead(
      selectedAccount,
      gatewayMocks.accountInfoReadSucceeds,
    );
    await Promise.all([
      page.waitForEvent('load'),
      errorPage.signInButton.click(),
    ]);

    await expect(accountDashboard.field('spec.displayName')).toContainText(
      `Display name of ${selectedAccount}`,
    );
    await expect(errorPage.title).toHaveCount(0);
    await expect(page).toHaveURL(dashboardPath);
  });

  test('reloads the page with the login button when reading the account fails', async ({
    page,
    portalBackend,
  }) => {
    const dashboardPath = AccountDashboardPage.path(selectedAccount);
    portalBackend.respondToAccountRead(
      selectedAccount,
      gatewayErrorMocks.http401Unauthorized,
    );
    await page.goto(dashboardPath);
    await errorPage.expectShown(401);

    portalBackend.respondToAccountRead(
      selectedAccount,
      gatewayMocks.accountReadSucceeds,
    );
    await Promise.all([
      page.waitForEvent('load'),
      errorPage.signInButton.click(),
    ]);

    await expect(accountDashboard.field('spec.displayName')).toContainText(
      `Display name of ${selectedAccount}`,
    );
    await expect(page).toHaveURL(dashboardPath);
  });

  test('reloads the page with the login button when listing the accounts fails', async ({
    page,
    portalBackend,
  }) => {
    const accountsList = new AccountsListPage(page);
    portalBackend.respondToAccountsList(gatewayErrorMocks.http401Unauthorized);
    await page.goto(AccountsListPage.path);
    await errorPage.expectShown(401);

    portalBackend.respondToAccountsList(
      gatewayMocks.accountsListWithFourReadyAccounts,
    );
    await Promise.all([
      page.waitForEvent('load'),
      errorPage.signInButton.click(),
    ]);

    await expect(accountsList.accountRow(selectedAccount)).toBeVisible();
    await expect(page).toHaveURL(AccountsListPage.path);
  });
});
