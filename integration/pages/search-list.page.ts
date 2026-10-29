import type { NavigationNode } from './portal-shell.ts';
import type { Locator, Page } from '@playwright/test';

export class SearchListPage {
  static readonly viewName = 'search-list-dynamic-page';
  static readonly navigation: NavigationNode = {
    pathSegment: 'search-httpbins',
    label: 'Search Http Bins',
  };

  readonly searchInput: Locator;
  readonly clearSearch: Locator;
  readonly itemsPerPage: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByRole('textbox', {
      name: 'Search',
      exact: true,
    });
    this.clearSearch = page.getByTestId('search-list-clear-icon');
    this.itemsPerPage = page.getByRole('combobox', {
      name: 'Items per page',
      exact: true,
    });
  }

  static path(accountName: string): string {
    return `/home/accounts/${accountName}/search-httpbins`;
  }

  tab(label: string, count: number): Locator {
    return this.page.getByRole('tab', {
      name: `${label} (${count})`,
      exact: true,
    });
  }

  resourceRow(name: string, namespace: string): Locator {
    return this.page.getByRole('row', {
      name: `${name} ${namespace}`,
      exact: true,
    });
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
  }

  async selectLimit(limit: number): Promise<void> {
    await this.itemsPerPage.click();
    await this.page
      .getByRole('option', { name: String(limit), exact: true })
      .click();
  }

  async selectPage(page: number): Promise<void> {
    await this.page
      .getByRole('button', { name: String(page), exact: true })
      .click();
  }
}
