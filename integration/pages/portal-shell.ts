import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const luigiWebComponentTagPrefix = 'luigi-wc-';

export interface NavigationNode {
  pathSegment: string;
  label: string;
}

export class PortalShell {
  static readonly selectedNavigationItemClass = /\bis-selected\b/;

  readonly alert: Locator;
  readonly hiddenSideNavigation: Locator;
  readonly sideNavigationItems: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.alert = page.getByTestId('luigi-alert');
    this.hiddenSideNavigation = page.locator('.no-side-nav');
    this.sideNavigationItems = page.locator(
      '.fd-navigation__link[data-testid]',
    );
  }

  async open(): Promise<void> {
    await this.page.goto('/');
  }

  navigationItem({ pathSegment, label }: NavigationNode): Locator {
    return this.page.getByTestId(
      [pathSegment, label]
        .map((part) =>
          encodeURIComponent(part.toLowerCase().split(' ').join('')),
        )
        .join('_'),
    );
  }

  breadcrumb(label: string): Locator {
    return this.page
      .getByRole('navigation', { name: 'Breadcrumb Trail' })
      .getByRole('link', {
        name: new RegExp(`^${this.escapeForRegExp(label)} \\d+ of \\d+$`),
      });
  }

  async expectSideNavigation(
    nodes: NavigationNode[],
    selectedNode: NavigationNode,
  ): Promise<void> {
    await expect(this.sideNavigationItems).toHaveText(
      nodes.map((node) => node.label),
    );
    await expect(this.navigationItem(selectedNode)).toHaveClass(
      PortalShell.selectedNavigationItemClass,
    );
  }

  async expectNoSideNavigation(): Promise<void> {
    await expect(this.hiddenSideNavigation).toHaveCount(1);
    await expect(this.sideNavigationItems).toHaveCount(0);
  }

  async renderedViews(): Promise<string[]> {
    const tagNames = await this.page
      .locator('.wcContainer > *')
      .evaluateAll((elements) =>
        elements.map((element) => element.tagName.toLowerCase()),
      );

    return tagNames
      .filter((tagName) => tagName.startsWith(luigiWebComponentTagPrefix))
      .map((tagName) => this.viewNameOf(tagName));
  }

  private escapeForRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private viewNameOf(luigiWebComponentTagName: string): string {
    const viewUrl = Buffer.from(
      luigiWebComponentTagName.slice(luigiWebComponentTagPrefix.length),
      'hex',
    ).toString('utf8');
    return new URL(viewUrl).hash.slice(1);
  }
}
