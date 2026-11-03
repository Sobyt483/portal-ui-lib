import { HttpBinsListPage } from './httpbins-list.page.ts';
import type { NavigationNode } from './portal-shell.ts';
import type { Locator, Page } from '@playwright/test';

export class HttpBinPage {
  static readonly viewName = 'generic-detail-view';
  static readonly readFailedSubtitle = 'Please try again.';
  static readonly namespacesReadFailedAlert = 'Failed to read namespaces.';
  static readonly namespaceMissingSubtitle =
    'Select a namespace and try again.';
  static readonly dashboard: NavigationNode = {
    pathSegment: 'dashboard',
    label: 'Dashboard',
  };
  static readonly details: NavigationNode = {
    pathSegment: 'details',
    label: 'Details',
  };
  static readonly status: NavigationNode = {
    pathSegment: 'status',
    label: 'Status',
  };
  static readonly navigation: NavigationNode[] = [
    HttpBinPage.dashboard,
    HttpBinPage.details,
    HttpBinPage.status,
  ];

  readonly errorState: Locator;
  readonly namespaceSelect: Locator;
  readonly namespaceRefreshButton: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.errorState = page.getByTestId('generic-detail-view-error-state');
    this.namespaceSelect = page.getByTestId(
      'generic-detail-view-namespace-select',
    );
    this.namespaceRefreshButton = page.getByTestId(
      'generic-detail-view-namespace-refresh',
    );
  }

  static path(
    accountName: string,
    httpBinName: string,
    node: NavigationNode,
  ): string {
    return `${HttpBinsListPage.path(accountName)}/${httpBinName}/${node.pathSegment}`;
  }

  namespaceOptions(): Locator {
    return this.page.locator(
      '[data-testid^="generic-detail-view-namespace-option-"]',
    );
  }

  namespaceOption(namespace: string): Locator {
    return this.page.getByTestId(
      `generic-detail-view-namespace-option-${namespace}`,
    );
  }

  field(property: string): Locator {
    return this.page.getByTestId(`generic-detail-view-field-${property}`);
  }
}
