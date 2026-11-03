import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export type ErrorCode = 401 | 403 | 404 | 422 | 500 | 503;

interface ErrorIllustration {
  scene: string;
  drawingId: string;
}

const unsuccessfulAuthIllustration: ErrorIllustration = {
  scene: 'tnt/UnsuccessfulAuth',
  drawingId: 'tnt-Scene-UnsuccessfulAuth',
};

const unableToLoadIllustration: ErrorIllustration = {
  scene: 'UnableToLoad',
  drawingId: 'sapIllus-Scene-UnableToLoad',
};

export class ErrorPage {
  static readonly viewName = 'error-component';
  static readonly titles: Record<ErrorCode, string> = {
    401: 'Your session has expired.',
    403: 'You are not authorized to access this content.',
    404: "The content you specified can't be found",
    422: 'The resource is pending deletion.',
    500: 'Could not load resource',
    503: 'Organization is not ready yet',
  };
  static readonly illustrations: Record<ErrorCode, ErrorIllustration> = {
    401: unsuccessfulAuthIllustration,
    403: unsuccessfulAuthIllustration,
    404: { scene: 'NoEntries', drawingId: 'sapIllus-Scene-NoEntries' },
    422: {
      scene: 'tnt/NoApplications',
      drawingId: 'tnt-Scene-NoApplications',
    },
    500: unableToLoadIllustration,
    503: unableToLoadIllustration,
  };

  readonly title: Locator;
  readonly subtitle: Locator;
  readonly retryButton: Locator;
  readonly signInButton: Locator;
  private readonly illustratedMessage: Locator;

  constructor(page: Page) {
    this.title = page.getByTestId('error-view-title');
    this.subtitle = page.getByTestId('error-view-subtitle');
    this.retryButton = page.getByTestId('error-view-retry');
    this.signInButton = page.getByTestId('error-view-sign-in');
    this.illustratedMessage = page.getByTestId('error-view-illustration');
  }

  illustration(code: ErrorCode): Locator {
    return this.illustratedMessage.getByRole('img', {
      name: ErrorPage.illustrations[code].scene,
      exact: true,
    });
  }

  illustrationDrawing(code: ErrorCode): Locator {
    return this.illustration(code).locator(
      `svg#${ErrorPage.illustrations[code].drawingId}`,
    );
  }

  async expectRecoveryAction(code: ErrorCode): Promise<void> {
    const [expected, unexpected] =
      code === 401
        ? [this.signInButton, this.retryButton]
        : [this.retryButton, this.signInButton];
    await expect(expected).toBeVisible();
    await expect(unexpected).toHaveCount(0);
  }

  async expectShown(code: ErrorCode): Promise<void> {
    await expect(this.title).toHaveText(ErrorPage.titles[code]);
    await expect(this.illustration(code)).toBeVisible();
    await expect(this.illustrationDrawing(code)).toBeVisible();
  }
}
