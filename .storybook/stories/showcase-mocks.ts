/**
 * Hand-written fakes for Storybook stories.
 * Do NOT use vitest-mock-extended here — these are browser-runtime stubs.
 */
import { OpenSearchResult } from '../../projects/wc/src/app/components/generic-ui/search-list-dynamic-page/services/open-search.service';
import { LuigiClient } from '@luigi-project/client/luigi-element';
import {
  Resource,
  ResourceDefinition,
  ResourceListResult,
} from '@platform-mesh/portal-ui-lib/models';
import {
  AccountInfoService,
  ErrorHandlerService,
  GatewayService,
  InstancePermissionsService,
  KubeconfigSecretService,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import { EMPTY, Observable, of, throwError } from 'rxjs';

// ---------------------------------------------------------------------------
// Canned resource data
// ---------------------------------------------------------------------------

export const CANNED_CLUSTER_RESOURCE: Resource = {
  metadata: {
    name: 'my-cluster',
    namespace: undefined as any,
    resourceVersion: '42',
  },
  spec: {
    type: 'k3s',
    displayName: 'My Cluster',
    description: 'A demo cluster for Storybook',
    version: 'v1.30',
    region: 'eu-west-1',
  },
  status: {
    conditions: [],
  },
};

// ---------------------------------------------------------------------------
// Many cluster resources (~30) for pagination stories.
// Each item carries additional fields used by the rich-column definition:
//   spec.status   → 'tag' column (Active / Inactive)
//   spec.ready    → 'boolIcon' column (true / false)
//   spec.logoUrl  → 'img' column
//   spec.url      → 'link' column
//   spec.token    → 'secret' column
// ---------------------------------------------------------------------------

const REGIONS = [
  'eu-west-1',
  'us-east-1',
  'ap-southeast-1',
  'us-west-2',
  'eu-central-1',
];
const VERSIONS = ['v1.28', 'v1.29', 'v1.30', 'v1.31'];
const STATUSES = ['Active', 'Inactive', 'Pending'];
// 28×28 inline SVG data-URIs so the <img> renders at intrinsic size without
// needing CSS constraints that can't cross the shadow-DOM boundary.
const LOGO_URLS = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='14' cy='14' r='14' fill='%230068b5'/%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='14' cy='14' r='14' fill='%2300d2ac'/%3E%3C/svg%3E",
];

export const MANY_CLUSTER_RESOURCES: Resource[] = Array.from(
  { length: 30 },
  (_, i) => {
    const num = String(i + 1).padStart(2, '0');
    const isReady = i % 3 !== 2; // every 3rd is not ready
    return {
      // id is required for resource-table-card's load-more merge:
      // loadMore() calls list(isInitialLoad=false) which merges via
      //   new Map(values.map((i) => [i.id, i]))
      // Without id, all items share key=undefined and only one row survives.
      id: `cluster-${num}`,
      metadata: {
        name: `cluster-${num}`,
        namespace: undefined as any,
        resourceVersion: String(100 + i),
      },
      spec: {
        type: i % 2 === 0 ? 'k3s' : 'eks',
        displayName: `Cluster ${num}`,
        description: `Auto-generated cluster ${num} for pagination demo`,
        version: VERSIONS[i % VERSIONS.length],
        region: REGIONS[i % REGIONS.length],
        status: STATUSES[i % STATUSES.length],
        ready: isReady,
        // alertMessage: the displayAs:'alert' renderer shows the icon when !value().
        // So: healthy rows → truthy value ('ok') → no icon shown.
        // Unhealthy rows → falsy value (null) → alert icon shown.
        alertMessage: isReady ? 'ok' : null,
        logoUrl: LOGO_URLS[i % LOGO_URLS.length],
        url: `https://console.example.com/clusters/cluster-${num}`,
        token: `sk-demo-${num}-a1b2c3d4`,
      },
      status: {
        conditions: [
          {
            type: 'Ready',
            status: isReady ? 'True' : 'False',
            reason: isReady ? 'ClusterReady' : 'ClusterNotReady',
            lastTransitionTime: '2024-01-01T00:00:00Z',
            message: isReady ? 'Cluster is ready' : 'Cluster is not ready',
          },
        ],
      },
    };
  },
);

// ---------------------------------------------------------------------------
// LuigiClient fake
// ---------------------------------------------------------------------------

export function makeFakeLuigiClient(
  opts: { pathParams?: Record<string, string> } = {},
): LuigiClient {
  const navigate = (..._args: any[]) => {};
  return {
    linkManager: () => ({
      fromContext: (_ctx: string) => ({
        navigate,
        withParams: (_p: any) => ({ navigate }),
      }),
      navigate,
      withParams: (_p: any) => ({ navigate }),
      fromClosestContext: () => ({ navigate }),
      fromVirtualTreeRoot: () => ({ navigate }),
      fromAbsolutePath: () => ({ navigate }),
      openAsModal: (_path: string, _settings?: any) => {},
      openAsDrawer: (_path: string, _settings?: any) => {},
      openAsSplitView: (_path: string, _settings?: any) => ({
        close: () => {},
      }),
      pathExists: (_path: string) => Promise.resolve(false),
    }),
    uxManager: () => ({
      showAlert: (settings: any) => {
        console.debug('[FakeLuigiClient] showAlert', settings);
      },
      showLoadingIndicator: () => {},
      hideLoadingIndicator: () => {},
      setDirtyStatus: (_dirty: boolean) => {},
    }),
    getActiveFeatureToggles: (): string[] => [],
    getNodeParams: (_useUrlFragment?: boolean) => ({}),
    getPathParams: () => opts.pathParams ?? {},
    addNodeParams: (_params: any, _keepBrowserHistory?: boolean) => {},
    addCoreSearchParams: (_params: any, _keepBrowserHistory?: boolean) => {},
    getCoreSearchParams: () => ({}),
    getClientPermissions: () => ({}),
    getAncestors: () => [],
    getCurrentLocale: () => 'en',
    setCurrentLocale: (_locale: string) => {},
    getToken: () => undefined,
    publishEvent: (_evt: Event) => {},
    sendCustomMessage: (_msg: any) => {},
    addCustomMessageListener: (_id: string, _fn: any) => {},
    removeCustomMessageListener: (_id: string) => {},
  } as unknown as LuigiClient;
}

/**
 * A fake LuigiClient whose openAsModal resolves with a canned create result.
 * Use this for search-list stories that exercise the openInModal create flow.
 */
export function makeFakeLuigiClientWithModal(
  modalResource: Resource = CANNED_CLUSTER_RESOURCE,
): LuigiClient {
  const base = makeFakeLuigiClient();
  return {
    ...base,
    linkManager: () => ({
      ...(base.linkManager() as any),
      openAsModal: (path: string, _settings?: any) => {
        alert(`Modal would open with path: ${path}`);
        return Promise.resolve({
          data: {
            status: 'submit',
            action: 'create',
            resource: modalResource,
          },
        });
      },
    }),
  } as unknown as LuigiClient;
}

// ---------------------------------------------------------------------------
// Service stubs
// ---------------------------------------------------------------------------

/**
 * Returns a ResourceService stub with canned Default (non-empty) responses.
 * Override individual methods per story as needed.
 */
export function makeDefaultResourceServiceStub(
  items: Resource[] = [CANNED_CLUSTER_RESOURCE],
  readResult: Resource | null = CANNED_CLUSTER_RESOURCE,
): Partial<ResourceService> {
  const listResult: ResourceListResult = {
    items,
    resourceVersion: '1',
    continue: undefined,
    remainingItemCount: 0,
  };
  return {
    list: (_op: any, _fields: any, _ctx: any, _opts?: any): Observable<any> =>
      of(listResult),
    read: (_id: any, _params: any, _fields: any, _ctx: any): Observable<any> =>
      of(readResult),
    resourceChangeSubscription: (
      _op: any,
      _fields: any,
      _ctx: any,
    ): Observable<any> => of(undefined),
    create: (_res: any, _def: any, _ctx: any): Observable<any> => of({}) as any,
    update: (_res: any, _def: any, _ctx: any): Observable<any> => of({}) as any,
    delete: (_res: any, _def: any, _ctx: any): Observable<any> => of({}) as any,
    getNamespace: (ctx: any) => ctx?.namespaceId,
    isAvailable: (_item: any) => true,
  };
}

/**
 * Returns a ResourceService stub that emits an empty list (no items).
 */
export function makeEmptyResourceServiceStub(): Partial<ResourceService> {
  const emptyResult: ResourceListResult = {
    items: [],
    resourceVersion: '1',
    continue: undefined,
    remainingItemCount: 0,
  };
  return {
    list: (_op: any, _fields: any, _ctx: any, _opts?: any): Observable<any> =>
      of(emptyResult),
    read: (_id: any, _params: any, _fields: any, _ctx: any): Observable<any> =>
      of(null),
    resourceChangeSubscription: () => EMPTY,
    create: () => of({}) as any,
    update: () => of({}) as any,
    delete: () => of({}) as any,
    getNamespace: (ctx: any) => ctx?.namespaceId,
    isAvailable: (_item: any) => true,
  };
}

/**
 * Returns a ResourceService stub that errors on list/read.
 */
export function makeErrorResourceServiceStub(): Partial<ResourceService> {
  return {
    list: (_op: any, _fields: any, _ctx: any, _opts?: any): Observable<any> =>
      throwError(() => new Error('Something went wrong')),
    read: (_id: any, _params: any, _fields: any, _ctx: any): Observable<any> =>
      throwError(() => new Error('Something failed')),
    resourceChangeSubscription: () => EMPTY,
    create: () => of({}) as any,
    update: () => of({}) as any,
    delete: () => of({}) as any,
    getNamespace: (ctx: any) => ctx?.namespaceId,
    isAvailable: (_item: any) => true,
  };
}

/**
 * Returns a ResourceService stub that honours pagination opts
 * (`opts.pagination.limit` / `opts.pagination.continue`).
 * resource-table-card starts with no token (initial load), then passes the
 * `continue` value returned by the previous call as the next page's token.
 * We encode the next-page start index as a plain numeric string.
 *
 * Default paginationLimit in resource-table-card is 5, so 30 items → 6 pages.
 *
 * Mirrors the real ResourceService.list() behaviour: sets `isAvailable` on each
 * item based on spec.ready so not-ready rows render visually disabled.
 */
export function makePaginatedResourceServiceStub(
  items: Resource[] = MANY_CLUSTER_RESOURCES,
): Partial<ResourceService> {
  return {
    list: (_op: any, _fields: any, _ctx: any, opts?: any): Observable<any> => {
      const limit: number = opts?.pagination?.limit ?? 5;
      const start: number = opts?.pagination?.continue
        ? parseInt(opts.pagination.continue, 10)
        : 0;
      const page = items.slice(start, start + limit).map((item) => ({
        ...item,
        isAvailable: !!(item as any).spec?.ready,
      }));
      const nextStart = start + limit;
      const hasMore = nextStart < items.length;
      const result: ResourceListResult = {
        items: page,
        resourceVersion: '100',
        continue: hasMore ? String(nextStart) : undefined,
        remainingItemCount: hasMore ? items.length - nextStart : 0,
      };
      return of(result);
    },
    read: (_id: any, _params: any, _fields: any, _ctx: any): Observable<any> =>
      of(items[0] ?? null),
    resourceChangeSubscription: (): Observable<any> => of(undefined),
    create: (_res: any, _def: any, _ctx: any): Observable<any> => of({}) as any,
    update: (_res: any, _def: any, _ctx: any): Observable<any> => of({}) as any,
    delete: (_res: any, _def: any, _ctx: any): Observable<any> => of({}) as any,
    getNamespace: (ctx: any) => ctx?.namespaceId,
    isAvailable: (_item: any) => true,
  };
}

/**
 * Returns a ResourceService stub with all items in one response.
 * Use for RichColumns where the goal is to show column types, not pagination.
 *
 * Mirrors the real ResourceService.list() behaviour: sets `isAvailable` on each
 * item based on spec.ready so not-ready rows render visually disabled.
 */
export function makeManyResourceServiceStub(
  items: Resource[] = MANY_CLUSTER_RESOURCES,
): Partial<ResourceService> {
  const mappedItems = items.map((item) => ({
    ...item,
    isAvailable: !!(item as any).spec?.ready,
  }));
  const listResult: ResourceListResult = {
    items: mappedItems,
    resourceVersion: '100',
    continue: undefined,
    remainingItemCount: 0,
  };
  return {
    list: (_op: any, _fields: any, _ctx: any, _opts?: any): Observable<any> =>
      of(listResult),
    read: (_id: any, _params: any, _fields: any, _ctx: any): Observable<any> =>
      of(items[0] ?? null),
    resourceChangeSubscription: (): Observable<any> => of(undefined),
    create: (_res: any, _def: any, _ctx: any): Observable<any> => of({}) as any,
    update: (_res: any, _def: any, _ctx: any): Observable<any> => of({}) as any,
    delete: (_res: any, _def: any, _ctx: any): Observable<any> => of({}) as any,
    getNamespace: (ctx: any) => ctx?.namespaceId,
    isAvailable: (_item: any) => true,
  };
}

/**
 * First 10 items from MANY_CLUSTER_RESOURCES — used by RichColumns stories
 * to limit the initial render. MANY_CLUSTER_RESOURCES (30 items) is kept
 * intact for Paginated stories (load-more needs ~30 items to be meaningful).
 */
export const RICH_CLUSTER_RESOURCES: Resource[] = MANY_CLUSTER_RESOURCES.slice(
  0,
  10,
);

/**
 * Returns an OpenSearchService-shaped stub that honours `request.page` and
 * `request.limit` from the OpenSearchRequest.
 *
 * search-list-dynamic-page contract (component lines ~362-370):
 *   listResources(context, { q, resource, limit, page, filters })
 * where `limit` defaults to 20 (limitFromUrl()) and `page` is 1-based.
 * `onPageChange(n)` sets currentPage(n) and re-calls list() with the new page.
 * `onLimitChange(n)` sets paginationLimit(n) and re-calls list() with new limit.
 *
 * The component reads `result.totalCount` to drive the pager (total pages =
 * ceil(totalCount / limit)). `result.nextCursor` drives `hasMore` but the
 * pager itself only needs totalCount.
 *
 * NOTE: paginationLimit defaults to 20 (limitFromUrl()) and cannot be seeded
 * lower from a story (no input, and the Storybook URL doesn't carry ?limit=5).
 * To see 5-item pages, use the rows-per-page selector in the story UI.
 */
export function makePagedOpenSearchServiceStub(results: OpenSearchResult): {
  listResources: (ctx: any, req: any) => Observable<OpenSearchResult>;
} {
  const allItems = results.results;
  return {
    listResources: (_ctx: any, req: any): Observable<OpenSearchResult> => {
      const limit: number = req?.limit ?? 20;
      const page: number = req?.page ?? 1;
      const start = (page - 1) * limit;
      const pageItems = allItems.slice(start, start + limit);
      return of({
        results: pageItems,
        source: results.source,
        totalCount: allItems.length,
        nextCursor: '',
      });
    },
  };
}

/**
 * ErrorHandlerService stub — no-ops for all methods.
 */
export const FAKE_ERROR_HANDLER_SERVICE: Partial<ErrorHandlerService> = {
  handleError: (_error: any) => {},
  errorCode: (error: any) => error?.status ?? 500,
};

const ERROR_STATE_TEXTS: Record<string, string> = {
  ERROR_CONTENT_NOT_FOUND_TITLE: "The content you specified can't be found",
  ERROR_CONTENT_NOT_FOUND_TEXT:
    'Check if the URL is correct or search in the Portal. If this problem persists, create an issue.',
  SESSION_EXPIRED: 'Your session has expired.',
  SIGN_IN_HINT: 'Sign in again to continue working on awesome things!',
};

export const FAKE_I18N_SERVICE = {
  getTranslationAsync: async (key: string) => ERROR_STATE_TEXTS[key] ?? key,
};

/**
 * InstancePermissionsService stub — always returns empty permissions.
 */
export const FAKE_INSTANCE_PERMISSIONS_SERVICE: Partial<InstancePermissionsService> =
  {
    checkInstances: (_ctx: any, _def: any, _instances: any): Observable<any> =>
      of([]),
    checkInstance: (_ctx: any, _def: any, _instance: any): Observable<any> =>
      of({ actions: [] }),
  };

/**
 * AccountInfoService stub — returns minimal account info.
 */
export const FAKE_ACCOUNT_INFO_SERVICE: Partial<AccountInfoService> = {
  read: (_ctx: any): Observable<any> =>
    of({
      metadata: { name: 'mock-account' },
      spec: {
        oidc: {
          issuerUrl: 'https://oidc.example.com',
          clients: { kubectl: { clientId: 'kubectl-client' } },
        },
      },
    }),
};

/**
 * GatewayService stub — returns a mock workspace path.
 */
export const FAKE_GATEWAY_SERVICE: Partial<GatewayService> = {
  resolveKcpPath: (_ctx: any) => 'root:org:workspace',
};

/**
 * KubeconfigSecretService stub.
 */
export const FAKE_KUBECONFIG_SECRET_SERVICE: Partial<KubeconfigSecretService> =
  {
    secretReferenceQueryFields: (_settings: any) => [],
    isSecretReferenceAvailable: (_settings: any, _resource: any, _ctx: any) =>
      false,
    readKubeconfig: (_settings: any, _resource: any, _ctx: any) => EMPTY,
  };
