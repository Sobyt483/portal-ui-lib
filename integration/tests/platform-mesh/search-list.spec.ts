import type { PortalBackendMock } from '../../backend/portal-backend-mock.ts';
import { expect, test } from '../../fixtures/portal-test.ts';
import {
  restMocks,
  searchErrorMocks,
  searchMocks,
} from '../../mocks/mock-catalog.ts';
import { AccountDashboardPage } from '../../pages/account-dashboard.page.ts';
import { ErrorPage } from '../../pages/error.page.ts';
import type { ErrorCode } from '../../pages/error.page.ts';
import { PortalShell } from '../../pages/portal-shell.ts';
import { SearchListPage } from '../../pages/search-list.page.ts';
import type { Page } from '@playwright/test';

const selectedAccount = 'account-gamma';
const listedWidgets = ['widget-alpha', 'widget-beta'];
const accountNavigation = [
  AccountDashboardPage.navigation,
  SearchListPage.navigation,
];
const invalidQueryDetail = 'The search query is invalid.';

const searchFailures: {
  description: string;
  mockFile: string;
  errorCode: ErrorCode;
}[] = [
  {
    description: 'HTTP 401 Unauthorized',
    mockFile: searchErrorMocks.http401Unauthorized,
    errorCode: 401,
  },
  {
    description: 'HTTP 403 Forbidden',
    mockFile: searchErrorMocks.http403Forbidden,
    errorCode: 403,
  },
  {
    description: 'HTTP 404 Not Found',
    mockFile: searchErrorMocks.http404NotFound,
    errorCode: 404,
  },
  {
    description: 'HTTP 500 Internal Server Error',
    mockFile: searchErrorMocks.http500InternalServerError,
    errorCode: 500,
  },
];

test.describe('search list page', () => {
  let errorPage: ErrorPage;
  let portalShell: PortalShell;
  let searchList: SearchListPage;

  test.beforeEach(({ page, portalBackend }) => {
    errorPage = new ErrorPage(page);
    portalShell = new PortalShell(page);
    searchList = new SearchListPage(page);
    portalBackend.respondToAccountEntityConfig(
      selectedAccount,
      restMocks.accountEntityConfigWithSearchList,
    );
  });

  test('shows the header and the found resources', async ({ page }) => {
    await page.goto(SearchListPage.path(selectedAccount));

    await expectHeaderShown();
    await expectWidgetsShown();
    await expect(searchList.errorState).toHaveCount(0);
    await expectStaysOnSearchList(page);
    await expect(portalShell.alert).toHaveCount(0);
  });

  test.describe('when the search fails', () => {
    for (const failure of searchFailures) {
      test(`keeps the header, the URL and the side navigation and shows the ${failure.errorCode} error instead of the table for ${failure.description}`, async ({
        page,
        portalBackend,
      }) => {
        portalBackend.respondToSearch(failure.mockFile);

        await page.goto(SearchListPage.path(selectedAccount));

        await errorPage.expectShown(failure.errorCode);
        await expectHeaderShown();
        await expect(searchList.table).toHaveCount(0);
        await errorPage.expectRecoveryAction(failure.errorCode);
        await expectStaysOnSearchList(page);
        await expect(portalShell.alert).toHaveCount(0);
      });
    }

    test('does not show the technical message of the request as the subtitle', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToSearch(
        searchErrorMocks.http500InternalServerError,
      );

      await page.goto(SearchListPage.path(selectedAccount));

      await errorPage.expectShown(500);
      await expect(errorPage.subtitle).toHaveText('Please try again.');
    });

    test('shows the resources after a successful retry', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToSearch(
        searchErrorMocks.http500InternalServerError,
      );
      await page.goto(SearchListPage.path(selectedAccount));
      await errorPage.expectShown(500);

      portalBackend.respondToSearch(searchMocks.resultsWithTwoWidgets);
      await errorPage.retryButton.click();

      await expectWidgetsShown();
      await expect(searchList.errorState).toHaveCount(0);
    });
  });

  test.describe('when a search term causes the failure', () => {
    test('shows the detail of the response and keeps the term in the search input and the URL', async ({
      page,
      portalBackend,
    }) => {
      await page.goto(SearchListPage.path(selectedAccount));
      await expectWidgetsShown();

      portalBackend.respondToSearch(searchErrorMocks.http400InvalidQuery);
      await searchList.search('bad:query');

      await errorPage.expectShown(500);
      await expect(errorPage.subtitle).toHaveText(invalidQueryDetail);
      await expectHeaderShown();
      await expect(searchList.searchInput.locator('input')).toHaveValue(
        'bad:query',
      );
      await expect(page).toHaveURL(
        (url) => url.searchParams.get('q') === 'bad:query',
      );
      expect(searchTerms(portalBackend)).toContain('bad:query');
    });

    test('recovers when the user searches for another term', async ({
      page,
      portalBackend,
    }) => {
      await page.goto(SearchListPage.path(selectedAccount));
      await expectWidgetsShown();
      portalBackend.respondToSearch(searchErrorMocks.http400InvalidQuery);
      await searchList.search('bad:query');
      await expect(errorPage.subtitle).toHaveText(invalidQueryDetail);

      portalBackend.respondToSearch(searchMocks.resultsWithTwoWidgets);
      await searchList.search('widget');

      await expectWidgetsShown();
      await expect(searchList.errorState).toHaveCount(0);
      await expect(page).toHaveURL(
        (url) => url.searchParams.get('q') === 'widget',
      );
    });

    test('recovers when the user clears the search', async ({
      page,
      portalBackend,
    }) => {
      await page.goto(SearchListPage.path(selectedAccount));
      await expectWidgetsShown();
      portalBackend.respondToSearch(searchErrorMocks.http400InvalidQuery);
      await searchList.search('bad:query');
      await expect(errorPage.subtitle).toHaveText(invalidQueryDetail);

      portalBackend.respondToSearch(searchMocks.resultsWithTwoWidgets);
      await searchList.clearSearchIcon.click();

      await expectWidgetsShown();
      await expect(searchList.searchInput.locator('input')).toHaveValue('');
      await expect(page).toHaveURL((url) => !url.searchParams.has('q'));
    });

    test('recovers from a failing term opened from the URL', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToSearch(searchErrorMocks.http400InvalidQuery);
      await page.goto(`${SearchListPage.path(selectedAccount)}?q=bad:query`);
      await expect(errorPage.subtitle).toHaveText(invalidQueryDetail);
      await expect(searchList.searchInput.locator('input')).toHaveValue(
        'bad:query',
      );

      portalBackend.respondToSearch(searchMocks.resultsWithTwoWidgets);
      await searchList.search('widget');

      await expectWidgetsShown();
    });
  });

  test.describe('when the user may not list the resources', () => {
    test('shows the 403 error without a retry and without a search request', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountEntityConfig(
        selectedAccount,
        restMocks.accountEntityConfigWithSearchListWithoutListPermission,
      );

      await page.goto(SearchListPage.path(selectedAccount));

      await errorPage.expectShown(403);
      await expect(searchList.title).toBeVisible();
      await expect(searchList.table).toHaveCount(0);
      await expect(errorPage.retryButton).toHaveCount(0);
      await expect(errorPage.subtitle).toHaveText('');
      expect(portalBackend.requestsTo('searchResources')).toEqual([]);
    });
  });

  async function expectHeaderShown() {
    await expect(searchList.title).toHaveText('widgets');
    await expect(searchList.description).toContainText(
      'This page displays the created widgets',
    );
    await expect(searchList.searchInput).toBeVisible();
    await expect(searchList.tabs).toBeVisible();
  }

  async function expectWidgetsShown() {
    await expect(searchList.table).toBeVisible();
    for (const widget of listedWidgets) {
      await expect(searchList.row(widget)).toBeVisible();
    }
  }

  async function expectStaysOnSearchList(page: Page) {
    await expect(page).toHaveURL(
      (url) => url.pathname === SearchListPage.path(selectedAccount),
    );
    await expect(portalShell.sideNavigationItems).toHaveText(
      accountNavigation.map((node) => node.label),
    );
    await expect
      .poll(() => portalShell.renderedViews())
      .toEqual([SearchListPage.viewName]);
  }

  function searchTerms(portalBackend: PortalBackendMock) {
    return portalBackend
      .requestsTo('searchResources')
      .map((request) => request.searchTerm);
  }
});
