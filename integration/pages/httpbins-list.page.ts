import type { NavigationNode } from './portal-shell.ts';
import type { Locator, Page } from '@playwright/test';

export class HttpBinsListPage {
  static readonly viewName = 'generic-list-view';
  static readonly navigation: NavigationNode = {
    pathSegment: 'orchestrate_platform-mesh_io_httpbins',
    label: 'Http Bins',
  };

  readonly description: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.description = page.getByText('This page displays the created');
  }

  static path(accountName: string): string {
    return `/home/accounts/${accountName}/${HttpBinsListPage.navigation.pathSegment}`;
  }

  httpBinRow(httpBinName: string): Locator {
    return this.page.getByRole('row', { name: httpBinName });
  }

  async openHttpBin(httpBinName: string): Promise<void> {
    await this.httpBinRow(httpBinName).click();
  }
}
