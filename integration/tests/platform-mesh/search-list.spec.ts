import { expect, test } from '../../fixtures/portal-test.ts';
import { restMocks } from '../../mocks/mock-catalog.ts';
import { AccountDashboardPage } from '../../pages/account-dashboard.page.ts';
import { AccountsListPage } from '../../pages/accounts-list.page.ts';
import { OverviewPage } from '../../pages/overview.page.ts';
import { PortalShell } from '../../pages/portal-shell.ts';
import { SearchListPage } from '../../pages/search-list.page.ts';
import type { Page } from '@playwright/test';

const selectedAccount = 'account-gamma';
const specialQuery = 'httpbin <demo> "quoted" / &';

test.describe('search list node parameters', () => {
  let searchList: SearchListPage;

  test.beforeEach(async ({ page, portalBackend }) => {
    searchList = new SearchListPage(page);
    const portalShell = new PortalShell(page);
    const accountsList = new AccountsListPage(page);
    const dashboard = new AccountDashboardPage(page);
    portalBackend.respondToAccountEntityConfig(
      selectedAccount,
      restMocks.accountEntityConfigWithDashboardAndSearch,
    );

    await portalShell.open();
    await expect(page).toHaveURL(OverviewPage.path);
    await portalShell.navigationItem(AccountsListPage.navigation).click();
    await accountsList.openAccount(selectedAccount);
    await expect(dashboard.field('spec.displayName')).toContainText(
      `Display name of ${selectedAccount}`,
    );
    await expect
      .poll(() => portalShell.renderedViews())
      .toEqual([AccountDashboardPage.viewName]);
    await portalShell.navigationItem(SearchListPage.navigation).click();
    await expect(searchList.resourceRow('httpbin-001', 'team-a')).toBeVisible();
  });

  test('restores search text, tab, page and limit from node parameters after reload', async ({
    page,
    portalBackend,
  }) => {
    const params = {
      namespace: 'team-b',
      '~q': specialQuery,
      '~page': '2',
      '~limit': '5',
      '~tab': 'team-b',
      '~other': 'preserved',
    };
    await page.goto(
      `${SearchListPage.path(selectedAccount)}?${new URLSearchParams(params)}`,
    );

    for (const reload of [false, true]) {
      if (reload) await page.reload();
      await expect(searchList.searchInput).toHaveValue(specialQuery);
      await expect(searchList.itemsPerPage).toHaveText('5');
      await expect(searchList.tab('Team B', 6)).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(
        searchList.resourceRow('httpbin-012', 'team-b'),
      ).toBeVisible();
      await expectParams(page, params);
      expect(
        portalBackend
          .requestsTo('resourceSearch')
          .filter((request) => request.search?.limit !== 1)
          .at(-1)?.search,
      ).toEqual({
        q: specialQuery,
        page: 2,
        limit: 5,
        resource: 'HttpBins',
        filters: { 'metadata.namespace': 'team-b' },
      });
    }
  });

  test('resets pagination on search, tab, limit and clear while preserving core and unrelated node parameters', async ({
    page,
    portalBackend,
  }) => {
    const retained = { namespace: 'team-a', '~other': 'preserved' };
    await page.goto(
      `${SearchListPage.path(selectedAccount)}?${new URLSearchParams({ ...retained, '~tab': 'all' })}`,
    );
    await expect(searchList.resourceRow('httpbin-001', 'team-a')).toBeVisible();
    await searchList.selectLimit(5);
    await searchList.selectPage(2);
    await expectParams(page, {
      ...retained,
      '~tab': 'all',
      '~limit': '5',
      '~page': '2',
    });

    await searchList.search('httpbin');
    await expectParams(page, {
      ...retained,
      '~tab': 'all',
      '~limit': '5',
      '~q': 'httpbin',
    });
    await searchList.selectPage(2);
    await searchList.tab('Team B', 6).click();
    await expectParams(page, {
      ...retained,
      '~tab': 'team-b',
      '~limit': '5',
      '~q': 'httpbin',
    });
    await expect(searchList.resourceRow('httpbin-002', 'team-b')).toBeVisible();

    await searchList.selectPage(2);
    await searchList.clearSearch.click();
    await expectParams(page, { ...retained, '~tab': 'team-b', '~limit': '5' });
    await expect(searchList.searchInput).toHaveValue('');
    await searchList.selectPage(2);
    await searchList.selectLimit(10);
    await expectParams(page, { ...retained, '~tab': 'team-b', '~limit': '10' });
    await expect(searchList.resourceRow('httpbin-012', 'team-b')).toBeVisible();
    expect(
      portalBackend
        .requestsTo('resourceSearch')
        .filter((request) => request.search?.limit !== 1)
        .at(-1)?.search,
    ).toEqual({
      q: '*',
      page: 1,
      limit: 10,
      resource: 'HttpBins',
      filters: { 'metadata.namespace': 'team-b' },
    });
  });

  test('uses defaults for invalid pagination and tab without rewriting canonical node parameters', async ({
    page,
    portalBackend,
  }) => {
    const retained = { namespace: 'team-b', '~other': 'preserved' };
    await page.goto(
      `${SearchListPage.path(selectedAccount)}?${new URLSearchParams({ ...retained, '~page': '0', '~limit': '3', '~tab': 'unknown' })}`,
    );
    await expectParams(page, { ...retained, '~tab': 'all' });
    await expect(searchList.resourceRow('httpbin-012', 'team-b')).toBeVisible();
    await expect(searchList.itemsPerPage).toHaveText('20');
    await expect(searchList.tab('All', 12)).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const beforeReload = portalBackend.requestsTo('resourceSearch').length;
    await page.reload();
    await expect(searchList.resourceRow('httpbin-012', 'team-b')).toBeVisible();
    await expect(searchList.tab('Team B', 6)).toBeVisible();
    await expectParams(page, { ...retained, '~tab': 'all' });
    expect(
      portalBackend.requestsTo('resourceSearch').slice(beforeReload),
    ).toHaveLength(4);
  });
});

async function expectParams(
  page: Page,
  params: Record<string, string>,
): Promise<void> {
  await expect(page).toHaveURL(
    (url) =>
      JSON.stringify(Object.fromEntries([...url.searchParams].sort())) ===
      JSON.stringify(Object.fromEntries(Object.entries(params).sort())),
  );
}
