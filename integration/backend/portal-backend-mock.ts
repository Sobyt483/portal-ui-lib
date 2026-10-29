import { gatewayMocks, restMocks, searchMocks } from '../mocks/mock-catalog.ts';
import { loadMockResponse } from '../mocks/mock-response.ts';
import type { MockVariables } from '../mocks/mock-response.ts';
import { isGatewayPath, parseGatewayRequest } from './gateway-request.ts';
import type { GatewayOperation } from './gateway-request.ts';
import type { Page, Route } from '@playwright/test';

export type BackendEndpoint =
  GatewayOperation | 'accountEntityConfig' | 'resourceSearch';

export interface SearchRequest {
  q: string;
  resource: string | undefined;
  page: number;
  limit: number;
  filters: Record<string, string>;
}

interface SearchResponse {
  results: {
    id: string;
    source: {
      default_fields: Record<string, string>;
      filterable_fields: Record<string, string>;
      semantic_fields: Record<string, string>;
    };
  }[];
  source: string;
  totalCount: number;
  nextCursor: string;
}

export interface BackendRequest {
  endpoint: BackendEndpoint;
  accountName: string | undefined;
  namespace?: string;
  search?: SearchRequest;
}

const accountEntityConfigPath = '/rest/config/core_platform-mesh_io_account';
const accountEntityConfigAccountParam = 'core_platform-mesh_io_account';

export class PortalBackendMock {
  readonly requests: BackendRequest[] = [];
  readonly unhandledRequests: string[] = [];

  private readonly gatewayDefaults: Record<GatewayOperation, string> = {
    accountsList: gatewayMocks.accountsListWithFourReadyAccounts,
    accountsWatch: gatewayMocks.accountsWatchClosingWithoutChanges,
    accountInfoRead: gatewayMocks.accountInfoReadSucceeds,
    accountRead: gatewayMocks.accountReadSucceeds,
    logicalClusterRead: gatewayMocks.logicalClusterReadReady,
    httpBinsList: gatewayMocks.httpBinsListWithTwoReadyHttpBins,
    httpBinsWatch: gatewayMocks.httpBinsWatchClosingWithoutChanges,
    httpBinRead: gatewayMocks.httpBinReadForHttpBinBetaInTeamB,
    namespacesList: gatewayMocks.namespacesListWithTeamAAndTeamB,
    namespacesWatch: gatewayMocks.namespacesWatchClosingWithoutChanges,
  };
  private readonly gatewayOverrides = new Map<string, string>();
  private readonly accountEntityConfigOverrides = new Map<string, string>();
  private readonly page: Page;
  private readonly portalOrigin: string;

  constructor(page: Page, portalOrigin: string) {
    this.page = page;
    this.portalOrigin = portalOrigin;
  }

  async install(): Promise<void> {
    await this.page.route('**/*', (route) => this.handle(route));
  }

  respondToAccountInfoRead(accountName: string, mockFile: string): void {
    this.gatewayOverrides.set(
      this.overrideKey('accountInfoRead', accountName),
      mockFile,
    );
  }

  respondToAccountRead(accountName: string, mockFile: string): void {
    this.gatewayOverrides.set(
      this.overrideKey('accountRead', accountName),
      mockFile,
    );
  }

  respondToHttpBinRead(accountName: string, mockFile: string): void {
    this.gatewayOverrides.set(
      this.overrideKey('httpBinRead', accountName),
      mockFile,
    );
  }

  respondToNamespacesList(accountName: string, mockFile: string): void {
    this.gatewayOverrides.set(
      this.overrideKey('namespacesList', accountName),
      mockFile,
    );
  }

  respondToAccountEntityConfig(accountName: string, mockFile: string): void {
    this.accountEntityConfigOverrides.set(accountName, mockFile);
  }

  requestsTo(
    endpoint: BackendEndpoint,
    accountName?: string,
  ): BackendRequest[] {
    return this.requests.filter(
      (request) =>
        request.endpoint === endpoint &&
        (accountName === undefined || request.accountName === accountName),
    );
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin !== this.portalOrigin) {
      return route.abort('blockedbyclient');
    }

    if (request.method() === 'GET' && url.pathname === '/rest/envconfig') {
      return this.fulfill(route, restMocks.envConfigForTestOrgWithoutAuth);
    }

    if (request.method() === 'GET' && url.pathname === '/rest/config') {
      return this.fulfill(route, restMocks.portalConfigWithHomeAndAccounts, {
        portalOrigin: this.portalOrigin,
      });
    }

    if (
      request.method() === 'GET' &&
      url.pathname === accountEntityConfigPath
    ) {
      const accountName =
        url.searchParams.get(accountEntityConfigAccountParam) ?? '';
      this.requests.push({ endpoint: 'accountEntityConfig', accountName });
      return this.fulfill(
        route,
        this.accountEntityConfigOverrides.get(accountName) ??
          restMocks.accountEntityConfigWithDashboard,
        { accountName, portalOrigin: this.portalOrigin },
      );
    }

    if (request.method() === 'GET' && url.pathname === '/api/search') {
      return this.handleResourceSearch(route, url);
    }

    if (request.method() === 'POST' && isGatewayPath(url.pathname)) {
      return this.handleGatewayRequest(route);
    }

    if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/api/')) {
      return this.rejectUnhandled(route);
    }

    return route.fallback();
  }

  private async handleResourceSearch(route: Route, url: URL): Promise<void> {
    const search: SearchRequest = {
      q: url.searchParams.get('q') ?? '*',
      resource: url.searchParams.get('resource') ?? undefined,
      page: Number(url.searchParams.get('page')),
      limit: Number(url.searchParams.get('limit')),
      filters: Object.fromEntries(
        [...url.searchParams]
          .filter(([key]) => key.startsWith('filter.'))
          .map(([key, value]) => [key.slice('filter.'.length), value]),
      ),
    };
    this.requests.push({
      endpoint: 'resourceSearch',
      accountName: undefined,
      search,
    });

    const response = loadMockResponse(
      searchMocks.httpBinsWithTwelveSearchResults,
    );
    const body = response.body as SearchResponse;
    const matches = body.results.filter((resource) => {
      const fields = {
        ...resource.source.default_fields,
        ...resource.source.filterable_fields,
        ...resource.source.semantic_fields,
      };
      return (
        Object.entries(search.filters).every(
          ([key, value]) => fields[key] === value,
        ) &&
        (search.q === '*' ||
          Object.values(fields)
            .join(' ')
            .toLowerCase()
            .includes(search.q.toLowerCase()))
      );
    });
    const start = (search.page - 1) * search.limit;
    await route.fulfill({
      status: response.status,
      json: {
        ...body,
        results: matches.slice(start, start + search.limit),
        totalCount: matches.length,
        nextCursor:
          start + search.limit < matches.length
            ? String(start + search.limit)
            : '',
      },
    });
  }

  private async handleGatewayRequest(route: Route): Promise<void> {
    const { operation, accountName, namespace } = parseGatewayRequest(
      route.request(),
    );
    if (!operation) {
      return this.rejectUnhandled(route);
    }

    this.requests.push({ endpoint: operation, accountName, namespace });
    const mockFile =
      this.gatewayOverrides.get(this.overrideKey(operation, accountName)) ??
      this.gatewayDefaults[operation];

    return this.fulfill(route, mockFile, { accountName: accountName ?? '' });
  }

  private async fulfill(
    route: Route,
    mockFile: string,
    variables?: MockVariables,
  ): Promise<void> {
    const { status, contentType, body } = loadMockResponse(mockFile, variables);
    await route.fulfill({
      status,
      contentType: contentType ?? 'application/json',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  private async rejectUnhandled(route: Route): Promise<void> {
    const request = route.request();
    this.unhandledRequests.push(`${request.method()} ${request.url()}`);
    await route.fulfill({ status: 501, body: 'No mock for this request' });
  }

  private overrideKey(
    operation: GatewayOperation,
    accountName: string | undefined,
  ): string {
    return `${operation}/${accountName}`;
  }
}
