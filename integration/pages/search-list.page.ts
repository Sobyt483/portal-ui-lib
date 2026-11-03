import type { NavigationNode } from './portal-shell.ts';
import type { Locator, Page } from '@playwright/test';

export class SearchListPage {
  static readonly viewName = 'search-list-dynamic-page';
  static readonly navigation: NavigationNode = {
    pathSegment: 'widgets',
    label: 'Widgets',
  };

  readonly title: Locator;
  readonly description: Locator;
  readonly searchInput: Locator;
  readonly clearSearchIcon: Locator;
  readonly tabs: Locator;
  readonly table: Locator;
  readonly errorState: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByTestId('search-list-title');
    this.description = page.getByTestId('search-list-description');
    this.searchInput = page.getByTestId('search-list-search-input');
    this.clearSearchIcon = page.getByTestId('search-list-clear-icon');
    this.tabs = page.getByTestId('search-list-tab-container');
    this.table = page.getByTestId('search-list-table');
    this.errorState = page.getByTestId('search-list-error-state');
  }

  static path(accountName: string): string {
    return `/home/accounts/${accountName}/${SearchListPage.navigation.pathSegment}`;
  }

  row(name: string): Locator {
    return this.page.getByRole('row', { name });
  }

  async search(term: string): Promise<void> {
    const input = this.searchInput.locator('input');
    await input.fill(term);
    await input.press('Enter');
  }
}
