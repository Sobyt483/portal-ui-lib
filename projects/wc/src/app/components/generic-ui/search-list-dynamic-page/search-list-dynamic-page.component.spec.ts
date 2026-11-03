import { InstancePermissionsStore } from '../store/instance-permissions-store.service';
import { SearchListDynamicPage } from './search-list-dynamic-page.component';
import {
  OpenSearchResult,
  OpenSearchService,
} from './services/open-search.service';
import { HttpErrorResponse } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ErrorHandlerService,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import { Subject, of, throwError } from 'rxjs';
import { MockedObject } from 'vitest';
import { mock } from 'vitest-mock-extended';

describe('SearchListDynamicPage', () => {
  let component: SearchListDynamicPage;
  let fixture: ComponentFixture<SearchListDynamicPage>;
  let mockResourceService: MockedObject<ResourceService>;
  let mockOpenSearchService: { listResources: ReturnType<typeof vi.fn> };
  let mockErrorHandlerService: MockedObject<ErrorHandlerService>;
  let mockInstancePermissionsStore: MockedObject<InstancePermissionsStore>;
  let listSubject: Subject<OpenSearchResult>;

  const buildContext = (overrides: Partial<any> = {}) =>
    (() => ({
      resourceDefinition: {
        entityCollection: 'clusters',
        entity: 'Cluster',
        apiGroup: 'core_k8s_io',
        version: 'v1alpha1',
        ui: {
          listView: { fields: [] },
          detailView: { fields: [] },
        },
        ...(overrides.resourceDefinition ?? {}),
      },
      portalContext: {},
      ...overrides,
    })) as any;

  const buildLuigiClient = () => {
    const navigate = vi.fn();
    return {
      _navigate: navigate,
      linkManager: () => ({ navigate }),
      uxManager: () => ({ showAlert: vi.fn() }),
      getActiveFeatureToggles: () => [],
    };
  };

  const createComponent = (
    contextOverrides: Partial<any> = {},
    luigiClient?: any,
  ): ComponentFixture<SearchListDynamicPage> => {
    const f = TestBed.createComponent(SearchListDynamicPage);
    f.componentInstance.context = buildContext(contextOverrides);
    f.componentInstance.LuigiClient = (() =>
      luigiClient ?? buildLuigiClient()) as any;
    f.detectChanges();
    return f;
  };

  beforeEach(() => {
    mockResourceService = mock<ResourceService>();
    mockErrorHandlerService = mock<ErrorHandlerService>();
    mockInstancePermissionsStore = mock<InstancePermissionsStore>();
    mockInstancePermissionsStore.permissions.mockReturnValue({});

    listSubject = new Subject<OpenSearchResult>();
    mockOpenSearchService = {
      listResources: vi.fn().mockReturnValue(listSubject.asObservable()),
    };

    TestBed.configureTestingModule({
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: ResourceService, useValue: mockResourceService },
        { provide: OpenSearchService, useValue: mockOpenSearchService },
        { provide: ErrorHandlerService, useValue: mockErrorHandlerService },
        {
          provide: InstancePermissionsStore,
          useValue: mockInstancePermissionsStore,
        },
      ],
    }).overrideComponent(SearchListDynamicPage, {
      set: {
        template: '',
        imports: [],
        providers: [],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      },
    });

    fixture = createComponent();
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
    history.replaceState(null, '', '/');
  });

  it('should create and call list on init', () => {
    expect(component).toBeTruthy();
    expect(mockOpenSearchService.listResources).toHaveBeenCalledWith(
      expect.objectContaining({ resourceDefinition: expect.any(Object) }),
      expect.objectContaining({
        q: '*',
        resource: 'clusters',
        limit: 20,
        page: 1,
      }),
    );
  });

  describe('resourceTitleDefinition', () => {
    it('falls back to entityCollection when resourceTitle.label is missing', () => {
      expect(component.resourceTitleDefinition()).toBe('clusters');
    });

    it('uses resourceDefinition.ui.listView.resourceTitle.label when set', () => {
      const f = createComponent({
        resourceDefinition: {
          ui: { listView: { resourceTitle: { label: 'Custom title' } } },
        },
      });
      expect(f.componentInstance.resourceTitleDefinition()).toBe(
        'Custom title',
      );
    });
  });

  describe('resourceDescriptionDefinition', () => {
    it('returns custom label when resourceDescription.label is set', () => {
      const f = createComponent({
        resourceDefinition: {
          ui: {
            listView: { resourceDescription: { label: 'My description' } },
          },
        },
      });
      expect(f.componentInstance.resourceDescriptionDefinition()).toBe(
        'My description',
      );
    });

    it('returns fallback sentence when resourceDescription.label is missing', () => {
      expect(component.resourceDescriptionDefinition()).toBe(
        'This page displays the created clusters in your environment',
      );
    });
  });

  describe('actions', () => {
    it('returns empty array when no actions are defined', () => {
      expect(component.actions()).toEqual([]);
    });

    it('returns actions from listView when defined', () => {
      const action = {
        property: 'spec.url',
        label: 'Open',
        uiSettings: { buttonSettings: { action: 'navigate' } },
      };
      const f = createComponent({
        resourceDefinition: {
          ui: { listView: { actions: [action] } },
        },
      });
      expect(f.componentInstance.actions()).toEqual([action]);
    });
  });

  describe('hasUiCreateViewFields', () => {
    it('returns false when createView fields are absent', () => {
      expect(component.hasUiCreateViewFields()).toBe(false);
    });

    it('returns true when createView fields are present', () => {
      const f = createComponent({
        resourceDefinition: {
          ui: { createView: { fields: [{ property: 'metadata.name' }] } },
        },
      });
      expect(f.componentInstance.hasUiCreateViewFields()).toBe(true);
    });
  });

  describe('createFields', () => {
    it('returns empty array when createView fields are absent', () => {
      expect(component.createFields()).toEqual([]);
    });

    it('returns the createView fields when present', () => {
      const fields = [{ property: 'metadata.name', label: 'Name' }];
      const f = createComponent({
        resourceDefinition: {
          ui: { createView: { fields } },
        },
      });
      expect(f.componentInstance.createFields()).toEqual(fields);
    });
  });

  describe('columns', () => {
    it('returns ui.listView.fields when no readyCondition', () => {
      const f = createComponent({
        resourceDefinition: {
          ui: { listView: { fields: [{ property: 'metadata.name' }] } },
        },
      });
      expect(f.componentInstance.columns()).toEqual([
        { property: 'metadata.name' },
      ]);
    });

    it('prepends readyCondition as alert column when defined', () => {
      const f = createComponent({
        resourceDefinition: {
          ui: { listView: { fields: [{ property: 'metadata.name' }] } },
          readyCondition: { property: 'status.ready' },
        },
      });
      const cols = f.componentInstance.columns();
      expect(cols[0]).toEqual(
        expect.objectContaining({
          property: 'status.ready',
          uiSettings: expect.objectContaining({
            displayAs: 'alert',
            columnWidth: '30px',
          }),
        }),
      );
      expect(cols[1]).toEqual({ property: 'metadata.name' });
    });

    it('defaults to empty array when listView.fields is absent', () => {
      const f = createComponent({
        resourceDefinition: { ui: {} },
      });
      expect(f.componentInstance.columns()).toEqual([]);
    });
  });

  describe('canDo', () => {
    it('returns true when action is undefined', () => {
      expect(component.canDo(undefined)).toBe(true);
    });

    it('returns true when portalPermissions allows the action', () => {
      const f = createComponent({
        portalPermissions: { clusters: ['create'] },
        resourceDefinition: {
          permissionsDefinition: { resource: 'clusters' },
        },
      });
      expect(f.componentInstance.canDo('create')).toBe(true);
    });

    it('returns false when portalPermissions denies the action', () => {
      const f = createComponent({
        portalPermissions: { clusters: ['get'] },
        resourceDefinition: {
          permissionsDefinition: { resource: 'clusters' },
        },
      });
      expect(f.componentInstance.canDo('create')).toBe(false);
    });

    it('returns true when portalPermissions is undefined', () => {
      const f = createComponent({
        portalPermissions: undefined,
        resourceDefinition: { permissionsDefinition: { resource: 'clusters' } },
      });
      expect(f.componentInstance.canDo('create')).toBe(true);
    });
  });

  describe('canCreate', () => {
    it('returns true when portalPermissions allows create', () => {
      const f = createComponent({
        portalPermissions: { clusters: ['create'] },
        resourceDefinition: {
          permissionsDefinition: { resource: 'clusters' },
        },
      });
      expect(f.componentInstance.canCreate()).toBe(true);
    });

    it('returns false when portalPermissions denies create', () => {
      const f = createComponent({
        portalPermissions: { clusters: ['get'] },
        resourceDefinition: {
          permissionsDefinition: { resource: 'clusters' },
        },
      });
      expect(f.componentInstance.canCreate()).toBe(false);
    });
  });

  describe('list', () => {
    it('sets resources from result.results', () => {
      listSubject.next({
        results: [
          { id: 'r1', metadata: { name: 'r1' } },
          { id: 'r2', metadata: { name: 'r2' } },
        ] as any,
        nextCursor: '',
        source: 'os',
      });
      listSubject.complete();
      expect(component.resources().map((r) => (r as any).id)).toEqual([
        'r1',
        'r2',
      ]);
    });

    it('defaults to empty array when result.results is undefined', () => {
      listSubject.next({
        results: undefined as any,
        nextCursor: '',
        source: 'os',
      });
      listSubject.complete();
      expect(component.resources()).toEqual([]);
    });

    it('sets hasMore=true when nextCursor is present', () => {
      listSubject.next({
        results: [{ id: 'a' }] as any,
        nextCursor: 'cursor1',
        source: 'os',
      });
      listSubject.complete();
      expect(component.hasMore()).toBe(true);
    });

    it('sets hasMore=false when nextCursor is empty', () => {
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();
      expect(component.hasMore()).toBe(false);
    });

    it('sets totalItemsCount from result.totalCount', () => {
      listSubject.next({
        results: [],
        nextCursor: '',
        source: 'os',
        totalCount: 42,
      });
      listSubject.complete();
      expect(component.totalItemsCount()).toBe(42);
    });

    it('sets totalItemsCount to undefined when totalCount is absent', () => {
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();
      expect(component.totalItemsCount()).toBeUndefined();
    });

    it('replaces resources on each page load (no append)', () => {
      listSubject.next({
        results: [{ id: 'r1' }] as any,
        nextCursor: '',
        source: 'os',
      });
      listSubject.complete();

      listSubject = new Subject<OpenSearchResult>();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );

      component.onPageChange(2);
      listSubject.next({
        results: [{ id: 'r2' }, { id: 'r3' }] as any,
        nextCursor: '',
        source: 'os',
      });
      listSubject.complete();

      expect(component.resources().map((r) => (r as any).id)).toEqual([
        'r2',
        'r3',
      ]);
    });

    it('cancels in-flight request when a new list() supersedes it', () => {
      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      component.list();
      expect(mockOpenSearchService.listResources.mock.calls.length).toBe(
        callsBefore + 1,
      );
    });

    it('logs a failed list without alerting', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('boom');
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();

      mockOpenSearchService.listResources.mockReturnValue(
        throwError(() => error),
      );
      component.list();

      expect(consoleSpy).toHaveBeenCalledWith(error);
      expect(mockErrorHandlerService.handleError).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('clears the error when listing again', () => {
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockOpenSearchService.listResources.mockReturnValue(
        throwError(() => new Error('boom')),
      );
      component.list();
      expect(component.error()).not.toBeNull();

      mockOpenSearchService.listResources.mockReturnValue(
        of({ results: [], nextCursor: '', source: 'os' }),
      );
      component.list();

      expect(component.error()).toBeNull();
    });

    it('does not call listResources when canDo("list") returns false', () => {
      const f = createComponent({
        portalPermissions: { clusters: ['get'] },
        resourceDefinition: {
          permissionsDefinition: { resource: 'clusters' },
        },
      });
      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      f.componentInstance.list();
      expect(mockOpenSearchService.listResources.mock.calls.length).toBe(
        callsBefore,
      );
    });

    it('sets error with status 403 when canDo("list") returns false', () => {
      const f = createComponent({
        portalPermissions: { clusters: ['get'] },
        resourceDefinition: {
          permissionsDefinition: { resource: 'clusters' },
        },
      });
      f.componentInstance.list();
      expect(f.componentInstance.error()).toEqual({
        status: 403,
        title: 'Permission denied',
      });
    });

    it('sets error with API response fields on request failure', () => {
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();

      const apiError = {
        status: 500,
        title: 'Server Error',
        detail: 'Something broke',
      };
      mockOpenSearchService.listResources.mockReturnValue(
        throwError(() => apiError),
      );
      component.list();

      expect(component.error()).toEqual({
        status: 500,
        title: 'Server Error',
        message: 'Something broke',
        withRetryButton: true,
      });
    });

    it('uses the detail of the response body for an HTTP error', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();
      mockOpenSearchService.listResources.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              url: 'http://search/api',
              error: { detail: 'The search query is invalid.' },
            }),
        ),
      );

      component.list();

      expect(component.error()?.status).toBe(400);
      expect(component.error()?.message).toBe('The search query is invalid.');
    });

    it('does not show the technical message of an HTTP error without a detail', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();
      mockOpenSearchService.listResources.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 500, url: 'http://search/api' }),
        ),
      );

      component.list();

      expect(component.error()?.status).toBe(500);
      expect(component.error()?.message).toBeUndefined();
    });

    it('falls back to error.message when detail is absent', () => {
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();

      const apiError = { status: 404, message: 'Not found' };
      mockOpenSearchService.listResources.mockReturnValue(
        throwError(() => apiError),
      );
      component.list();

      expect(component.error()).toEqual(
        expect.objectContaining({ message: 'Not found', status: 404 }),
      );
    });

    it('falls back to status 400 when error.status is absent', () => {
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();

      mockOpenSearchService.listResources.mockReturnValue(
        throwError(() => ({ message: 'oops' })),
      );
      component.list();

      expect(component.error()?.status).toBe(400);
    });

    it('error is null on initial component creation', () => {
      expect(component.error()).toBeNull();
    });

    it('calls listResources with correct context and request params', () => {
      // Reset state and call list() fresh so we control what the call contains
      mockOpenSearchService.listResources.mockClear();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );
      component.currentPage.set(1);
      component.list();

      const call = mockOpenSearchService.listResources.mock.calls[0]!;
      expect(call[0]).toEqual(
        expect.objectContaining({ resourceDefinition: expect.any(Object) }),
      );
      expect(call[1]).toEqual(
        expect.objectContaining({
          q: '*',
          resource: 'clusters',
          limit: 20,
          page: 1,
        }),
      );
    });
  });

  describe('list() out-of-range page fallback', () => {
    const setupSubject = () => {
      listSubject = new Subject<OpenSearchResult>();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );
    };

    it('resets to last page and re-fetches when page > 1 returns empty with totalCount', () => {
      setupSubject();
      component.currentPage.set(5);
      component.paginationLimit.set(20);
      component.list();

      // First response: page 5, empty results, totalCount = 42 → lastPage = ceil(42/20) = 3
      const firstSubject = listSubject;
      setupSubject();
      firstSubject.next({
        results: [],
        nextCursor: '',
        source: 'os',
        totalCount: 42,
      });
      firstSubject.complete();

      expect(component.currentPage()).toBe(3);
      expect(mockOpenSearchService.listResources.mock.calls.at(-1)![1]).toEqual(
        expect.objectContaining({ page: 3 }),
      );
    });

    it('calculates lastPage correctly for different limit/total combinations', () => {
      setupSubject();
      component.currentPage.set(10);
      component.paginationLimit.set(10);
      component.list();

      // totalCount=25, limit=10 → lastPage = ceil(25/10) = 3
      const firstSubject = listSubject;
      setupSubject();
      firstSubject.next({
        results: [],
        nextCursor: '',
        source: 'os',
        totalCount: 25,
      });
      firstSubject.complete();

      expect(component.currentPage()).toBe(3);
    });

    it('clamps to page 1 when totalCount is 0', () => {
      setupSubject();
      component.currentPage.set(3);
      component.paginationLimit.set(20);
      component.list();

      const firstSubject = listSubject;
      setupSubject();
      firstSubject.next({
        results: [],
        nextCursor: '',
        source: 'os',
        totalCount: 0,
      });
      firstSubject.complete();

      expect(component.currentPage()).toBe(1);
    });

    it('does not redirect when page is 1 and results are empty (legitimate no-results)', () => {
      setupSubject();
      component.currentPage.set(1);
      component.list();

      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      listSubject.next({
        results: [],
        nextCursor: '',
        source: 'os',
        totalCount: 0,
      });
      listSubject.complete();

      expect(component.currentPage()).toBe(1);
      expect(mockOpenSearchService.listResources.mock.calls.length).toBe(
        callsBefore,
      );
      expect(component.resources()).toEqual([]);
    });

    it('does not redirect when results are non-empty on page > 1', () => {
      setupSubject();
      component.currentPage.set(3);
      component.list();

      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      listSubject.next({
        results: [{ id: 'r1', metadata: { name: 'r1' } }] as any,
        nextCursor: '',
        source: 'os',
        totalCount: 60,
      });
      listSubject.complete();

      expect(component.currentPage()).toBe(3);
      expect(mockOpenSearchService.listResources.mock.calls.length).toBe(
        callsBefore,
      );
      expect(component.resources()).toHaveLength(1);
    });

    it('does not redirect when totalCount is absent (API did not return a count)', () => {
      setupSubject();
      component.currentPage.set(5);
      component.list();

      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();

      expect(component.currentPage()).toBe(5);
      expect(mockOpenSearchService.listResources.mock.calls.length).toBe(
        callsBefore,
      );
    });

    it('sets totalItemsCount from the out-of-range response before redirecting', () => {
      setupSubject();
      component.currentPage.set(99);
      component.list();

      const firstSubject = listSubject;
      setupSubject();
      firstSubject.next({
        results: [],
        nextCursor: '',
        source: 'os',
        totalCount: 15,
      });
      firstSubject.complete();

      // totalCount was applied even though results were empty
      expect(component.totalItemsCount()).toBe(15);
    });
  });

  describe('onLimitChange', () => {
    it('updates paginationLimit, resets to page 1, and re-fetches', () => {
      component.currentPage.set(4);
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();
      listSubject = new Subject<OpenSearchResult>();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );

      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      component.onLimitChange(50);

      expect(component.paginationLimit()).toBe(50);
      expect(component.currentPage()).toBe(1);
      expect(mockOpenSearchService.listResources.mock.calls.length).toBe(
        callsBefore + 1,
      );
    });
  });

  describe('onPageChange', () => {
    it('updates currentPage and re-fetches', () => {
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();
      listSubject = new Subject<OpenSearchResult>();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );

      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      component.onPageChange(3);

      expect(component.currentPage()).toBe(3);
      expect(mockOpenSearchService.listResources.mock.calls.length).toBe(
        callsBefore + 1,
      );
    });

    it('sends the updated page in the request argument', () => {
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();
      listSubject = new Subject<OpenSearchResult>();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );

      component.onPageChange(5);

      const lastCall = mockOpenSearchService.listResources.mock.calls.at(-1)!;
      expect(lastCall[1]).toEqual(expect.objectContaining({ page: 5 }));
    });
  });

  describe('openCreateModal', () => {
    it('does not throw when createModal viewChild is absent', () => {
      expect(() => component.openCreateModal()).not.toThrow();
    });
  });

  describe('onCreateSubmit', () => {
    it('calls resourceService.create, closes modal, and refreshes list on success', () => {
      const resource = { id: 'r1', metadata: { name: 'r1' } } as any;
      mockResourceService.create.mockReturnValue(of(resource));

      const closeSpy = vi.fn();
      vi.spyOn(component as any, 'createModal', 'get').mockReturnValue(() => ({
        close: closeSpy,
      }));

      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      component.onCreateSubmit(resource);

      expect(mockResourceService.create).toHaveBeenCalledWith(
        resource,
        component.resourceDefinition(),
        component.context(),
      );
      expect(closeSpy).toHaveBeenCalled();
      expect(
        mockOpenSearchService.listResources.mock.calls.length,
      ).toBeGreaterThan(callsBefore);
    });

    it('passes a create error to the error handler', () => {
      const error = new Error('create failed');
      mockResourceService.create.mockReturnValue(throwError(() => error));

      component.onCreateSubmit({ id: 'r1', metadata: { name: 'r1' } } as any);

      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error);
    });

    it('does nothing when resourceDefinition is undefined', () => {
      const f = createComponent({ resourceDefinition: undefined });
      const resource = { id: 'r1', metadata: { name: 'r1' } } as any;

      f.componentInstance.onCreateSubmit(resource);

      expect(mockResourceService.create).not.toHaveBeenCalled();
    });
  });

  describe('navigateToResource', () => {
    it('does nothing when detailView is not configured', () => {
      const lc = buildLuigiClient();
      const f = createComponent(
        { resourceDefinition: { ui: { listView: { fields: [] } } } },
        lc,
      );
      f.componentInstance.navigateToResource({
        metadata: { name: 'r1' },
      } as any);
      expect(lc._navigate).not.toHaveBeenCalled();
    });

    it('navigates using metadata.name when detailView exists', () => {
      const lc = buildLuigiClient();
      component.LuigiClient = (() => lc) as any;

      component.navigateToResource({
        id: 'r1',
        metadata: { name: 'cluster-1' },
      } as any);

      expect(lc._navigate).toHaveBeenCalledWith('cluster-1');
    });

    it('navigates using listView.resourceURL, resolving resource and context placeholders', () => {
      const lc = buildLuigiClient();
      const f = createComponent(
        {
          resourceDefinition: {
            ui: {
              listView: {
                resourceURL:
                  '/workspaces/{resource.accountName}/components/{resource.metadata.name}',
              },
            },
          },
        },
        lc,
      );

      f.componentInstance.navigateToResource({
        accountName: 'alert-notification-service',
        metadata: { name: 'alert-notification-service' },
      } as any);

      expect(lc._navigate).toHaveBeenCalledWith(
        '/workspaces/alert-notification-service/components/alert-notification-service',
      );
    });

    it('resolves both {context.*} and {resource.*} in resourceURL', () => {
      const lc = buildLuigiClient();
      const f = createComponent(
        {
          organization: 'sap',
          resourceDefinition: {
            ui: {
              listView: {
                resourceURL:
                  '/workspaces/{context.organization}/components/{resource.metadata.name}',
              },
            },
          },
        },
        lc,
      );

      f.componentInstance.navigateToResource({
        metadata: { name: 'comp1' },
      } as any);

      expect(lc._navigate).toHaveBeenCalledWith(
        '/workspaces/sap/components/comp1',
      );
    });

    it('navigates via resourceURL even when detailView is not configured', () => {
      const lc = buildLuigiClient();
      const f = createComponent(
        {
          resourceDefinition: {
            ui: {
              listView: { resourceURL: '/workspaces/{resource.metadata.name}' },
            },
          },
        },
        lc,
      );

      f.componentInstance.navigateToResource({
        metadata: { name: 'r1' },
      } as any);

      expect(lc._navigate).toHaveBeenCalledWith('/workspaces/r1');
    });

    it('alerts and throws when resource.metadata.name is missing', () => {
      const showAlert = vi.fn();
      component.LuigiClient = (() => ({
        uxManager: () => ({ showAlert }),
        linkManager: () => ({ navigate: vi.fn() }),
      })) as any;

      expect(() =>
        component.navigateToResource({ metadata: {} } as any),
      ).toThrow('Resource name is not defined');
      expect(showAlert).toHaveBeenCalledWith({
        text: 'Resource name is not defined',
        type: 'error',
      });
    });

    it('alerts and throws when resourceDefinition is undefined', () => {
      const showAlert = vi.fn();
      const lc = buildLuigiClient();
      lc.uxManager = () => ({ showAlert });

      const f = createComponent({ resourceDefinition: undefined }, lc);

      expect(() =>
        f.componentInstance.navigateToResource({ metadata: { name: 'r1' } }),
      ).toThrow('Resource definition is not defined');
      expect(showAlert).toHaveBeenCalledWith({
        text: 'Resource definition is not defined',
        type: 'error',
      });
    });
  });

  describe('genericActionHandler', () => {
    it('calls linkManager navigate when action is navigate', () => {
      const navigateSpy = vi.fn();
      component.LuigiClient = (() => ({
        linkManager: () => ({ navigate: navigateSpy }),
        uxManager: () => ({ showAlert: vi.fn() }),
      })) as any;

      const field = {
        value: '/clusters/cluster-1',
        uiSettings: { buttonSettings: { action: 'navigate' } },
      } as any;
      const resource = { id: 'r1', metadata: { name: 'r1' } } as any;

      component.genericActionHandler({ field, resource } as any);

      expect(navigateSpy).toHaveBeenCalledWith('/clusters/cluster-1');
    });

    it('does not throw for a valid action event with no resource', () => {
      const navigateSpy = vi.fn();
      component.LuigiClient = (() => ({
        linkManager: () => ({ navigate: navigateSpy }),
      })) as any;

      const field = {
        value: '/some/path',
        uiSettings: { buttonSettings: { action: 'navigate' } },
      } as any;

      expect(() =>
        component.genericActionHandler({ field, resource: undefined } as any),
      ).not.toThrow();
    });
  });

  describe('genericActionHandler modal callback branches (via handleModalResult)', () => {
    it('navigate action calls navigateToResource', () => {
      const navigateSpy = vi.fn();
      component.LuigiClient = (() => ({
        linkManager: () => ({ navigate: navigateSpy }),
        uxManager: () => ({ showAlert: vi.fn() }),
      })) as any;

      component.handleModalResult({
        data: { action: 'navigate', resource: { metadata: { name: 'r1' } } },
      } as any);

      expect(navigateSpy).toHaveBeenCalledWith('r1');
    });

    it('no result data does nothing', () => {
      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      component.handleModalResult(undefined);
      expect(mockOpenSearchService.listResources.mock.calls.length).toBe(
        callsBefore,
      );
    });

    it('create action calls resourceService.create', () => {
      mockResourceService.create.mockReturnValue(of({} as any));
      component.handleModalResult({
        data: { action: 'create', resource: { metadata: { name: 'new-r' } } },
      } as any);
      expect(mockResourceService.create).toHaveBeenCalled();
    });

    it('loadTableData action calls list()', () => {
      listSubject.next({ results: [], nextCursor: '', source: 'os' });
      listSubject.complete();
      listSubject = new Subject<OpenSearchResult>();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );

      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      component.handleModalResult({ data: { action: 'loadTableData' } } as any);
      expect(
        mockOpenSearchService.listResources.mock.calls.length,
      ).toBeGreaterThan(callsBefore);
    });

    it('unknown action does not throw', () => {
      expect(() =>
        component.handleModalResult({ data: { action: 'unknown' } } as any),
      ).not.toThrow();
    });
  });

  describe('instance permissions sync effect', () => {
    it('calls instancePermissionsStore.sync when resources and entityActions are present', () => {
      const f = createComponent({
        resourceDefinition: {
          entityCollection: 'clusters',
          ui: { listView: { fields: [] }, detailView: { fields: [] } },
          permissionsDefinition: {
            resource: 'clusters',
            entityActions: ['get', 'delete'],
          },
        },
      });

      f.componentInstance.resources.set([
        { id: 'r1', metadata: { name: 'r1' } } as any,
      ]);
      TestBed.flushEffects();

      expect(mockInstancePermissionsStore.sync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ entityActions: ['get', 'delete'] }),
        [expect.objectContaining({ name: 'r1' })],
      );
    });
  });

  describe('tableResources', () => {
    it('maps resources with generated id', () => {
      listSubject.next({
        results: [{ id: 'x', metadata: { name: 'foo' } }] as any,
        nextCursor: '',
        source: 'os',
      });
      listSubject.complete();

      const rows = component.tableResources();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('id');
      expect((rows[0] as any).metadata).toEqual({ name: 'foo' });
    });

    it('returns empty array when resources is empty', () => {
      expect(component.tableResources()).toEqual([]);
    });

    it('falls back to metadata.name when resourceDefinition is absent', () => {
      const f = createComponent({ resourceDefinition: undefined });
      f.componentInstance.resources.set([
        { id: '', metadata: { name: 'fallback-name' } } as any,
      ]);
      const rows = f.componentInstance.tableResources();
      expect(rows[0].id).toBe('fallback-name');
    });
  });

  describe('searchFilters computed', () => {
    it('returns undefined when no filters are defined', () => {
      expect(component.searchFilters()).toBeUndefined();
    });

    it('returns array of FieldFilterDefinition when listView.filters is set', () => {
      const f = createComponent({
        resourceDefinition: {
          ui: {
            listView: {
              filters: [
                { label: 'Active', property: 'status', value: 'active' },
                { label: 'Inactive', property: 'status', value: 'inactive' },
              ],
            },
          },
        },
      });
      const filters = f.componentInstance.searchFilters();
      expect(filters).toHaveLength(2);
      expect(filters![0]).toEqual({
        label: 'Active',
        property: 'status',
        value: 'active',
      });
      expect(filters![1]).toEqual({
        label: 'Inactive',
        property: 'status',
        value: 'inactive',
      });
    });

    it('resolves {context.xxx} placeholders from context', () => {
      const f = createComponent({
        namespace: 'my-ns',
        resourceDefinition: {
          ui: {
            listView: {
              filters: [
                {
                  label: 'NS filter',
                  property: 'metadata.namespace',
                  value: '{context.namespace}',
                },
              ],
            },
          },
        },
      });
      const filters = f.componentInstance.searchFilters();
      expect(filters![0].value).toBe('my-ns');
    });
  });

  describe('hasFilters computed', () => {
    it('returns false when no filters defined', () => {
      expect(component.hasFilters()).toBe(false);
    });

    it('returns true when filters are present', () => {
      const f = createComponent({
        resourceDefinition: {
          ui: {
            listView: {
              filters: [{ label: 'A', property: 'p', value: 'v' }],
            },
          },
        },
      });
      expect(f.componentInstance.hasFilters()).toBe(true);
    });
  });

  describe('selectedSearchFilter linkedSignal', () => {
    it('is undefined when no filters are defined', () => {
      expect(component.selectedSearchFilter()).toBeUndefined();
    });

    it('picks the first filter by default', () => {
      const f = createComponent({
        resourceDefinition: {
          ui: {
            listView: {
              filters: [
                { label: 'First', property: 'p', value: 'v1' },
                { label: 'Second', property: 'p', value: 'v2' },
              ],
            },
          },
        },
      });
      expect(f.componentInstance.selectedSearchFilter()).toEqual(
        expect.objectContaining({ label: 'First', value: 'v1' }),
      );
    });

    it('picks the filter marked default: true', () => {
      const f = createComponent({
        resourceDefinition: {
          ui: {
            listView: {
              filters: [
                { label: 'First', property: 'p', value: 'v1' },
                { label: 'Default', property: 'p', value: 'v2', default: true },
              ],
            },
          },
        },
      });
      expect(f.componentInstance.selectedSearchFilter()).toEqual(
        expect.objectContaining({
          label: 'Default',
          value: 'v2',
          default: true,
        }),
      );
    });
  });

  describe('filterTabs computed', () => {
    it('returns empty array when no filters defined', () => {
      expect(component.filterTabs()).toEqual([]);
    });

    it('returns tabs with text = label when no count yet', () => {
      const f = createComponent({
        resourceDefinition: {
          ui: {
            listView: {
              filters: [
                { label: 'All', property: 'p', value: '*' },
                { label: 'Active', property: 'status', value: 'active' },
              ],
            },
          },
        },
      });
      // Before filter counts resolve, mock loadFilterCounts to return counts
      const tabs = f.componentInstance.filterTabs();
      expect(tabs[0].text).toBe('All');
      expect(tabs[1].text).toBe('Active');
    });

    it('first tab is selected by default', () => {
      const f = createComponent({
        resourceDefinition: {
          ui: {
            listView: {
              filters: [
                { label: 'All', property: 'p', value: '*' },
                { label: 'Active', property: 'status', value: 'active' },
              ],
            },
          },
        },
      });
      const tabs = f.componentInstance.filterTabs();
      expect(tabs[0].selected).toBe(true);
      expect(tabs[1].selected).toBe(false);
    });

    it('shows label (count) after filterCounts are populated via loadFilterCounts', () => {
      // Use of() so forkJoin resolves immediately with totalCount
      mockOpenSearchService.listResources.mockReturnValue(
        of({ results: [], nextCursor: '', source: 'os', totalCount: 7 }),
      );

      const f = createComponent({
        resourceDefinition: {
          ui: {
            listView: {
              filters: [{ label: 'All', property: 'p', value: '*' }],
            },
          },
        },
      });

      const tabs = f.componentInstance.filterTabs();
      expect(tabs[0].text).toBe('All (7)');
    });
  });

  describe('onFilterTabSelect', () => {
    let filterFixture: ComponentFixture<SearchListDynamicPage>;

    beforeEach(() => {
      // Each listResources call returns a new observable so both list() and loadFilterCounts() work
      mockOpenSearchService.listResources.mockReturnValue(
        of({ results: [], nextCursor: '', source: 'os', totalCount: 3 }),
      );

      filterFixture = createComponent({
        resourceDefinition: {
          ui: {
            listView: {
              filters: [
                { label: 'All', property: 'p', value: '*' },
                { label: 'Active', property: 'status', value: 'active' },
                { label: 'Inactive', property: 'status', value: 'inactive' },
              ],
            },
          },
        },
      });
    });

    it('sets selectedSearchFilter to the filter at given index', () => {
      (filterFixture.componentInstance as any).onFilterTabSelect(1);
      expect(filterFixture.componentInstance.selectedSearchFilter()).toEqual(
        expect.objectContaining({ label: 'Active', value: 'active' }),
      );
    });

    it('resets currentPage to 1', () => {
      filterFixture.componentInstance.currentPage.set(3);
      (filterFixture.componentInstance as any).onFilterTabSelect(2);
      expect(filterFixture.componentInstance.currentPage()).toBe(1);
    });

    it('calls listResources after selecting a filter', () => {
      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      (filterFixture.componentInstance as any).onFilterTabSelect(1);
      expect(
        mockOpenSearchService.listResources.mock.calls.length,
      ).toBeGreaterThan(callsBefore);
    });
  });

  describe('loadFilterCounts (via ngOnInit)', () => {
    it('does nothing when no filters are defined', () => {
      // Default fixture has no filters — only the list() call from ngOnInit
      const listCalls = mockOpenSearchService.listResources.mock.calls.length;
      // With no filters there should be exactly 1 call (list), no extra calls for counts
      expect(listCalls).toBe(1);
    });

    it('does nothing when canDo("list") is false', () => {
      mockOpenSearchService.listResources.mockClear();
      createComponent({
        portalPermissions: { clusters: ['get'] },
        resourceDefinition: {
          permissionsDefinition: { resource: 'clusters' },
          ui: {
            listView: {
              filters: [{ label: 'All', property: 'p', value: '*' }],
            },
          },
        },
      });
      // canDo('list') is false so neither list() nor loadFilterCounts() should call listResources
      expect(mockOpenSearchService.listResources).not.toHaveBeenCalled();
    });

    it('makes one listResources call per filter with limit:1,page:1', () => {
      mockOpenSearchService.listResources.mockReturnValue(
        of({ results: [], nextCursor: '', source: 'os', totalCount: 5 }),
      );

      // Clear previous calls from the outer beforeEach fixture before creating a new one
      mockOpenSearchService.listResources.mockClear();

      createComponent({
        resourceDefinition: {
          ui: {
            listView: {
              filters: [
                { label: 'All', property: 'p', value: '*' },
                { label: 'Active', property: 'status', value: 'active' },
              ],
            },
          },
        },
      });

      // 1 list() call + 2 filter count calls = 3
      expect(mockOpenSearchService.listResources.mock.calls.length).toBe(3);

      // The filter count calls use limit:1,page:1
      const countCalls = mockOpenSearchService.listResources.mock.calls.filter(
        (call: any[]) => call[1].limit === 1 && call[1].page === 1,
      );
      expect(countCalls).toHaveLength(2);
    });
  });

  describe('submitSearch', () => {
    it('sets searchKey, resets currentPage to 1, and triggers list()', () => {
      component.currentPage.set(3);
      component.searchControl().value.set('my query');

      const callsBefore = mockOpenSearchService.listResources.mock.calls.length;
      component.submitSearch();

      expect(component.searchKey()).toBe('my query');
      expect(component.currentPage()).toBe(1);
      expect(mockOpenSearchService.listResources.mock.calls.length).toBe(
        callsBefore + 1,
      );
    });

    it('forwards an empty string to searchKey when the control is cleared', () => {
      component.searchControl().value.set('');
      component.submitSearch();
      expect(component.searchKey()).toBe('');
    });
  });

  describe('list() with searchKey', () => {
    it('sends the typed query to listResources when searchKey is set', () => {
      component.searchKey.set('hello');
      mockOpenSearchService.listResources.mockClear();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );

      component.list();

      const lastCall = mockOpenSearchService.listResources.mock.calls.at(-1)!;
      expect(lastCall[1]).toEqual(expect.objectContaining({ q: 'hello' }));
    });

    it('falls back to q: "*" when searchKey is empty string', () => {
      component.searchKey.set('');
      mockOpenSearchService.listResources.mockClear();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );

      component.list();

      const lastCall = mockOpenSearchService.listResources.mock.calls.at(-1)!;
      expect(lastCall[1]).toEqual(expect.objectContaining({ q: '*' }));
    });

    it('falls back to q: "*" when searchKey is whitespace only', () => {
      component.searchKey.set('   ');
      mockOpenSearchService.listResources.mockClear();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );

      component.list();

      const lastCall = mockOpenSearchService.listResources.mock.calls.at(-1)!;
      expect(lastCall[1]).toEqual(expect.objectContaining({ q: '*' }));
    });
  });

  describe('URL ?q= param management', () => {
    let href: string;
    const makeLocation = () => ({
      get href() {
        return href;
      },
      set href(value: string) {
        href = new URL(value, 'http://localhost/').href;
      },
      get search() {
        return new URL(href).search;
      },
    });
    const historyStub = {
      replaceState: (
        _state: unknown,
        _title: string,
        url?: string | URL | null,
      ) => {
        if (url != null) href = new URL(String(url), 'http://localhost/').href;
      },
    };
    const params = () => new URL(href).searchParams;

    beforeEach(() => {
      href = 'http://localhost/';
      vi.stubGlobal('location', makeLocation());
      vi.stubGlobal('history', historyStub);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('writes ?q= to the URL when searchKey is non-empty', () => {
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );
      component.searchKey.set('widgets');
      component.list();

      expect(params().get('q')).toBe('widgets');
    });

    it('strips ?q= from the URL when searchKey is empty', () => {
      href = 'http://localhost/?q=old-query';
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );
      component.searchKey.set('');
      component.list();

      expect(params().has('q')).toBe(false);
    });
  });

  describe('URL ?q= seeding on init', () => {
    it('seeds searchControl value and searchKey from the URL ?q= param', () => {
      let href = 'http://localhost/?q=seeded-value';
      vi.stubGlobal('location', {
        get href() {
          return href;
        },
        get search() {
          return new URL(href).search;
        },
      });
      vi.stubGlobal('history', {
        replaceState: (
          _state: unknown,
          _title: string,
          url?: string | URL | null,
        ) => {
          if (url != null)
            href = new URL(String(url), 'http://localhost/').href;
        },
      });

      // Create a fresh component after stubbing so readUrlSearchParam picks up ?q=
      const f = createComponent();

      expect(f.componentInstance.searchControl().value()).toBe('seeded-value');
      expect(f.componentInstance.searchKey()).toBe('seeded-value');

      vi.unstubAllGlobals();
    });
  });

  describe('baselineFilter', () => {
    it('baseline resolved + kcpPath present: list() sends merged filters', () => {
      mockOpenSearchService.listResources.mockClear();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );

      const f = createComponent({
        kcpPath: '/ws/test',
        resourceDefinition: {
          entityCollection: 'clusters',
          ui: {
            listView: {
              baselineFilters: [
                { property: 'workspace_path', value: '{context.kcpPath}' },
              ],
            },
          },
        },
      });

      // list() is called on init — grab the most recent call
      const lastCall = mockOpenSearchService.listResources.mock.calls.at(-1)!;
      expect(lastCall[1].filters).toEqual({ workspace_path: '/ws/test' });

      // No extra tab rendered for the baseline filter
      expect(f.componentInstance.filterTabs()).toHaveLength(0);
    });

    it('baseline unresolved (kcpPath missing): list() sends no filters and logs debug', () => {
      mockOpenSearchService.listResources.mockClear();
      mockOpenSearchService.listResources.mockReturnValue(
        listSubject.asObservable(),
      );

      const debugSpy = vi
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);

      createComponent({
        // kcpPath intentionally absent
        resourceDefinition: {
          entityCollection: 'clusters',
          ui: {
            listView: {
              baselineFilters: [
                { property: 'workspace_path', value: '{context.kcpPath}' },
              ],
            },
          },
        },
      });

      const lastCall = mockOpenSearchService.listResources.mock.calls.at(-1)!;
      // Unresolved baseline entry is skipped → filters should be undefined
      expect(lastCall[1].filters).toBeUndefined();
      expect(debugSpy).toHaveBeenCalledWith(
        'baselineFilter skipped (unresolved value)',
        'workspace_path',
        '{context.kcpPath}',
      );
    });

    it('baseline + selected tab on same property: tab value wins', () => {
      mockOpenSearchService.listResources.mockReturnValue(
        of({ results: [], nextCursor: '', source: 'os', totalCount: 0 }),
      );
      mockOpenSearchService.listResources.mockClear();

      const f = createComponent({
        kcpPath: '/baseline',
        resourceDefinition: {
          entityCollection: 'clusters',
          ui: {
            listView: {
              baselineFilters: [
                { property: 'workspace_path', value: '{context.kcpPath}' },
              ],
              filters: [
                { label: 'Tab', property: 'workspace_path', value: '/tab' },
              ],
            },
          },
        },
      });

      // Explicitly trigger list() after init to ensure the selected tab filter is merged
      mockOpenSearchService.listResources.mockClear();
      mockOpenSearchService.listResources.mockReturnValue(
        of({ results: [], nextCursor: '', source: 'os', totalCount: 0 }),
      );
      f.componentInstance.list();

      const lastCall = mockOpenSearchService.listResources.mock.calls.at(-1)!;
      // Tab value (/tab) must win over baseline value (/baseline)
      expect(lastCall[1].filters).toEqual({ workspace_path: '/tab' });
    });

    it('loadFilterCounts carries baseline merged into each per-tab count query', () => {
      mockOpenSearchService.listResources.mockReturnValue(
        of({ results: [], nextCursor: '', source: 'os', totalCount: 5 }),
      );
      mockOpenSearchService.listResources.mockClear();

      createComponent({
        kcpPath: '/ws/test',
        resourceDefinition: {
          entityCollection: 'clusters',
          ui: {
            listView: {
              baselineFilters: [
                { property: 'workspace_path', value: '{context.kcpPath}' },
              ],
              filters: [
                { label: 'All', property: 'status', value: '*' },
                { label: 'Active', property: 'status', value: 'active' },
              ],
            },
          },
        },
      });

      // 1 list() + 2 filter count calls = 3 total
      const countCalls = mockOpenSearchService.listResources.mock.calls.filter(
        (call: any[]) => call[1].limit === 1 && call[1].page === 1,
      );
      expect(countCalls).toHaveLength(2);

      // Every count call must include the baseline filter merged in
      for (const call of countCalls) {
        expect(call[1].filters).toEqual(
          expect.objectContaining({ workspace_path: '/ws/test' }),
        );
      }
    });
  });
});
