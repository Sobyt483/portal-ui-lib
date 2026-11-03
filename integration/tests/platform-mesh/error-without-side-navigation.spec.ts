import { expect, test } from '../../fixtures/portal-test.ts';
import { gatewayFailures } from '../../mocks/gateway-failures.ts';
import {
  gatewayErrorMocks,
  gatewayMocks,
  restMocks,
} from '../../mocks/mock-catalog.ts';
import { ErrorPage } from '../../pages/error.page.ts';
import { FullPagePage } from '../../pages/full-page.page.ts';
import { PortalShell } from '../../pages/portal-shell.ts';

const selectedAccount = 'account-gamma';
const fullPagePath = FullPagePage.path(selectedAccount);

test.describe('a node without side navigation', () => {
  let errorPage: ErrorPage;
  let fullPage: FullPagePage;
  let portalShell: PortalShell;

  test.beforeEach(({ page, portalBackend }) => {
    errorPage = new ErrorPage(page);
    fullPage = new FullPagePage(page);
    portalShell = new PortalShell(page);
    portalBackend.respondToAccountEntityConfig(
      selectedAccount,
      restMocks.accountEntityConfigWithFullPageAndIframeNodes,
    );
  });

  test('shows its resource without side navigation', async ({ page }) => {
    await page.goto(fullPagePath);

    await expect(fullPage.field('spec.displayName')).toContainText(
      `Display name of ${selectedAccount}`,
    );
    await expect(page).toHaveURL(fullPagePath);
    await portalShell.expectNoSideNavigation();
  });

  test.describe('when reading its resource fails', () => {
    for (const failure of gatewayFailures(
      gatewayMocks.accountReadForbiddenGraphqlError,
    )) {
      test(`keeps the URL, stays without side navigation and shows the ${failure.errorCode} error for ${failure.description}`, async ({
        page,
        portalBackend,
      }) => {
        portalBackend.respondToAccountRead(selectedAccount, failure.mockFile);

        await page.goto(fullPagePath);

        await errorPage.expectShown(failure.errorCode);
        await expect(page).toHaveURL(fullPagePath);
        await portalShell.expectNoSideNavigation();
        await expect
          .poll(() => portalShell.renderedViews())
          .toEqual([FullPagePage.viewName]);
        await errorPage.expectRecoveryAction(failure.errorCode);
        await expect(portalShell.alert).toHaveCount(0);
      });
    }

    test('shows the resource after a successful retry', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountRead(
        selectedAccount,
        gatewayErrorMocks.http404NotFound,
      );
      await page.goto(fullPagePath);
      await errorPage.expectShown(404);
      await expect(errorPage.subtitle).toHaveText(
        'If it was just created, try again. Otherwise, check if the URL is correct.',
      );

      portalBackend.respondToAccountRead(
        selectedAccount,
        gatewayMocks.accountReadSucceeds,
      );
      await errorPage.retryButton.click();

      await expect(fullPage.field('spec.displayName')).toContainText(
        `Display name of ${selectedAccount}`,
      );
      await expect(fullPage.errorState).toHaveCount(0);
      await portalShell.expectNoSideNavigation();
    });

    test('shows the resource after a retry once access was granted', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountRead(
        selectedAccount,
        gatewayErrorMocks.http403Forbidden,
      );
      await page.goto(fullPagePath);
      await errorPage.expectShown(403);
      await expect(errorPage.subtitle).toHaveText(
        'If access was just granted, try again.',
      );

      portalBackend.respondToAccountRead(
        selectedAccount,
        gatewayMocks.accountReadSucceeds,
      );
      await errorPage.retryButton.click();

      await expect(fullPage.field('spec.displayName')).toContainText(
        `Display name of ${selectedAccount}`,
      );
      await expect(fullPage.errorState).toHaveCount(0);
    });

    test('shows a resource pending deletion without a retry', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountRead(
        selectedAccount,
        gatewayMocks.accountReadPendingDeletion,
      );

      await page.goto(fullPagePath);

      await errorPage.expectShown(422);
      await expect(page).toHaveURL(fullPagePath);
      await portalShell.expectNoSideNavigation();
      await expect(errorPage.retryButton).toHaveCount(0);
    });
  });

  test.describe('when reading the account info fails', () => {
    for (const failure of gatewayFailures(
      gatewayMocks.accountInfoReadForbiddenGraphqlError,
    )) {
      test(`keeps the URL, stays without side navigation and shows the ${failure.errorCode} error for ${failure.description}`, async ({
        page,
        portalBackend,
      }) => {
        portalBackend.respondToAccountInfoRead(
          selectedAccount,
          failure.mockFile,
        );

        await page.goto(fullPagePath);

        await errorPage.expectShown(failure.errorCode);
        await expect(page).toHaveURL(fullPagePath);
        await portalShell.expectNoSideNavigation();
        await expect
          .poll(() => portalShell.renderedViews())
          .toEqual([ErrorPage.viewName]);
        await errorPage.expectRecoveryAction(failure.errorCode);
        await expect(portalShell.alert).toHaveCount(0);
        expect(
          portalBackend.requestsTo('accountRead', selectedAccount),
          'the view of the node must not be rendered',
        ).toEqual([]);
      });
    }

    test('shows the resource after a successful retry', async ({
      page,
      portalBackend,
    }) => {
      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayErrorMocks.http500InternalServerError,
      );
      await page.goto(fullPagePath);
      await errorPage.expectShown(500);

      portalBackend.respondToAccountInfoRead(
        selectedAccount,
        gatewayMocks.accountInfoReadSucceeds,
      );
      await errorPage.retryButton.click();

      await expect(fullPage.field('spec.displayName')).toContainText(
        `Display name of ${selectedAccount}`,
      );
      await expect(errorPage.title).toHaveCount(0);
      await portalShell.expectNoSideNavigation();
    });
  });
});
