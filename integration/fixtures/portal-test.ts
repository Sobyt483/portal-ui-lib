import { PortalBackendMock } from '../backend/portal-backend-mock.ts';
import { test as base, expect } from '@playwright/test';

interface PortalFixtures {
  portalBackend: PortalBackendMock;
}

export const test = base.extend<PortalFixtures>({
  portalBackend: [
    async ({ page, baseURL }, use) => {
      if (!baseURL) {
        throw new Error('The Playwright project must define a baseURL');
      }

      const portalBackend = new PortalBackendMock(
        page,
        new URL(baseURL).origin,
      );
      await portalBackend.install();

      await use(portalBackend);

      expect(
        portalBackend.unhandledRequests,
        'every backend request must be answered by a mock',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
