import type { NavigationNode } from './portal-shell.ts';
import type { Locator, Page } from '@playwright/test';

export class AccountDashboardPage {
  static readonly viewName = 'generic-detail-view';
  static readonly navigation: NavigationNode = {
    pathSegment: 'dashboard',
    label: 'Dashboard',
  };

  readonly workspacePath: Locator;
  readonly errorState: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.workspacePath = page.getByTestId('generic-detail-view-workspace-path');
    this.errorState = page.getByTestId('generic-detail-view-error-state');
  }

  static path(accountName: string): string {
    return `/home/accounts/${accountName}/dashboard`;
  }

  field(property: string): Locator {
    return this.page.getByTestId(`generic-detail-view-field-${property}`);
  }
}
