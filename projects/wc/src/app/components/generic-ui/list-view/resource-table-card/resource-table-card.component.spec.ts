import { InstancePermissionsStore } from '../../store/instance-permissions-store.service';
import { ResourceTableCard } from './resource-table-card.component';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ResourceDefinition,
  ResourceListResult,
  ResourceSubscriptionResult,
} from '@platform-mesh/portal-ui-lib/models';
import {
  ErrorHandlerService,
  InstancePermissionsService,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import * as utils from '@platform-mesh/portal-ui-lib/utils';
import { Subject, of, throwError } from 'rxjs';
import { MockedObject } from 'vitest';
import { mock } from 'vitest-mock-extended';

describe('ResourceTableCard', () => {
  let component: ResourceTableCard;
  let fixture: ComponentFixture<ResourceTableCard>;
  let mockResourceService: MockedObject<ResourceService>;
  let mockErrorHandlerService: MockedObject<ErrorHandlerService>;
  let mockInstancePermissionsService: MockedObject<InstancePermissionsService>;
  let mockInstancePermissionsLocalStore: MockedObject<InstancePermissionsStore>;

  const makeContext = (overrides: object = {}) =>
    signal({
      resourceDefinition: {
        entityCollection: 'clusters',
        entity: 'Cluster',
        apiGroup: 'core_k8s_io',
        version: 'v1alpha1',
        ui: {
          listView: { fields: [] },
          detailView: { fields: [] },
        },
        ...overrides,
      },
    }) as any;

  const makeLuigiClient = (navSpy = vi.fn(), addCoreSearchParams = vi.fn()) =>
    (() => ({
      linkManager: () => ({ navigate: navSpy }),
      uxManager: () => ({ showAlert: vi.fn() }),
      getNodeParams: vi.fn(),
      addCoreSearchParams,
    })) as any;

  beforeEach(() => {
    mockResourceService = mock();
    mockResourceService.list.mockReturnValue(
      of({
        items: [
          {
            metadata: { name: 'test' },
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
          },
        ],
        resourceVersion: '1234567890',
      }),
    );
    mockResourceService.resourceChangeSubscription.mockReturnValue(
      of(undefined),
    );
    mockErrorHandlerService = mock();
    mockInstancePermissionsService = mock();
    // Default: checkInstances returns empty array so InstancePermissionsStore doesn't blow up
    mockInstancePermissionsService.checkInstances.mockReturnValue(of([]));
    mockInstancePermissionsLocalStore = mock();
    // Default: all instances are "missing" so checkInstances is called
    mockInstancePermissionsLocalStore.missing.mockReturnValue([]);

    TestBed.configureTestingModule({
      providers: [
        { provide: ResourceService, useValue: mockResourceService },
        { provide: ErrorHandlerService, useValue: mockErrorHandlerService },
        {
          provide: InstancePermissionsService,
          useValue: mockInstancePermissionsService,
        },
        {
          provide: InstancePermissionsStore,
          useValue: mockInstancePermissionsLocalStore,
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).overrideComponent(ResourceTableCard, {
      set: { template: '', imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });

    fixture = TestBed.createComponent(ResourceTableCard);
    component = fixture.componentInstance;
    component.context = makeContext();
    component.LuigiClient = makeLuigiClient();

    fixture.detectChanges();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it.each([false, true])(
    'reports invalid form configuration without an unhandled rejection (edit=%s)',
    async (editMode) => {
      (component.context as any).set(
        makeContext({
          ui: {
            listView: { fields: [] },
            createView: {
              fields: [
                { property: 'metadata.name' },
                { property: 'metadata.name' },
              ],
            },
          },
        })(),
      );
      const closeCreateDialog = vi.fn();
      const closeEditDialog = vi.fn();
      (component as any).tableCard = () => ({
        closeCreateDialog,
        closeEditDialog,
      });
      const config = editMode
        ? component.config().editResourceFormConfig!({
            metadata: { name: 'resource' },
          })
        : component.config().createResourceFormConfig!;
      await expect(
        (config.fields as () => Promise<unknown[]>)(),
      ).resolves.toEqual([]);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Duplicate form field: metadata.name',
        }),
      );
      expect(
        editMode ? closeEditDialog : closeCreateDialog,
      ).toHaveBeenCalledOnce();
      expect(component.createFormState().pending).toBe(false);
      expect(component.editFormState().pending).toBe(false);
    },
  );

  it('preserves initial validation in both forms on seed events', () => {
    component.onCreateFieldChange({
      fieldProperty: 'metadata.name',
      value: '',
      source: 'seed',
    });
    component.onEditFieldChange({
      resource: { metadata: { name: 'resource' } },
      formChangeEvent: {
        fieldProperty: 'metadata.name',
        value: '',
        source: 'seed',
      },
    });
    expect(component.createFormState().fieldErrors?.['metadata.name']).toBe(
      'This field is required',
    );
    expect(component.editFormState().fieldErrors?.['metadata.name']).toBe(
      'This field is required',
    );
  });

  it('should fetch resources on init', () => {
    expect(mockResourceService.list).toHaveBeenCalled();
    expect(component.resources().length).toBeGreaterThan(0);
  });

  it('should include ready fields when listing resources', () => {
    mockResourceService.list = vi.fn().mockReturnValue(of([]));

    const readyCondition = {
      jsonPathExpression: '$.status.ready',
      property: 'status.ready',
    };

    const newFixture = TestBed.createComponent(ResourceTableCard);
    const newComponent = newFixture.componentInstance;

    newComponent.context = signal({
      resourceDefinition: {
        entityCollection: 'clusters',
        entity: 'Cluster',
        apiGroup: 'core_k8s_io',
        version: 'v1alpha1',
        readyCondition,
        ui: { listView: { fields: [{ property: 'metadata.name' }] } },
      } as ResourceDefinition,
    }) as any;
    newComponent.LuigiClient = makeLuigiClient();

    const expectedContext = newComponent.context();
    newFixture.detectChanges();

    const expectedFields = utils.generateGraphQLFields([
      { property: 'status.ready' },
      { property: 'metadata.name' },
      { property: 'metadata.deletionTimestamp' },
    ]);

    expect(mockResourceService.list).toHaveBeenCalledWith(
      'core_k8s_io_v1alpha1_clusters',
      expectedFields,
      expectedContext,
      { pagination: { continue: undefined, limit: 5 } },
    );
  });

  it('should include metadata.namespace in query fields for namespaced resources', () => {
    mockResourceService.list = vi.fn().mockReturnValue(of([]));

    const newFixture = TestBed.createComponent(ResourceTableCard);
    const newComponent = newFixture.componentInstance;

    newComponent.context = signal({
      resourceDefinition: {
        entityCollection: 'clusters',
        entity: 'Cluster',
        apiGroup: 'core_k8s_io',
        version: 'v1alpha1',
        scope: 'Namespaced',
        ui: { listView: { fields: [{ property: 'metadata.name' }] } },
      } as ResourceDefinition,
    }) as any;
    newComponent.LuigiClient = makeLuigiClient();

    newFixture.detectChanges();

    const fields = mockResourceService.list.mock.calls.at(-1)?.[1];
    const fieldsAsString = JSON.stringify(fields);
    expect(fieldsAsString).toContain('metadata');
    expect(fieldsAsString).toContain('namespace');
  });

  describe('Navigation', () => {
    it('should navigate to resource for namespaced resource', () => {
      const navSpy = vi.fn();
      const addCoreSearchParams = vi.fn();

      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = makeContext({ scope: 'Namespaced' });
      newComponent.LuigiClient = makeLuigiClient(navSpy, addCoreSearchParams);
      newFixture.detectChanges();

      newComponent.navigateToResource({
        metadata: { name: 'res1', namespace: 'test-namespace' },
      } as any);

      expect(addCoreSearchParams).toHaveBeenCalledWith(
        { namespace: 'test-namespace' },
        false,
        true,
      );
      expect(addCoreSearchParams.mock.invocationCallOrder[0]).toBeLessThan(
        navSpy.mock.invocationCallOrder[0],
      );
      expect(navSpy).toHaveBeenCalledWith('res1');
    });

    it('should clear namespace param for cluster-scoped resource', () => {
      const navSpy = vi.fn();
      const addCoreSearchParams = vi.fn();
      component.LuigiClient = makeLuigiClient(navSpy, addCoreSearchParams);

      component.navigateToResource({
        metadata: { name: 'res1', namespace: 'test-namespace' },
      } as any);

      expect(addCoreSearchParams).toHaveBeenCalledWith(
        { namespace: undefined },
        false,
        true,
      );
      expect(addCoreSearchParams.mock.invocationCallOrder[0]).toBeLessThan(
        navSpy.mock.invocationCallOrder[0],
      );
      expect(navSpy).toHaveBeenCalledWith('res1');
    });

    it('should navigate using listView.resourceURL with resolved resource placeholders', () => {
      const navSpy = vi.fn();
      component.context = makeContext({
        ui: {
          listView: {
            resourceURL:
              '/workspaces/{resource.accountName}/components/{resource.metadata.name}',
          },
        },
      });
      component.LuigiClient = makeLuigiClient(navSpy);

      component.navigateToResource({
        accountName: 'alert-notification-service',
        metadata: { name: 'alert-notification-service' },
      } as any);

      expect(navSpy).toHaveBeenCalledWith(
        '/workspaces/alert-notification-service/components/alert-notification-service',
      );
    });

    it('should navigate via resourceURL even when detailView is not defined', () => {
      const navSpy = vi.fn();
      component.context = makeContext({
        ui: {
          listView: { resourceURL: '/workspaces/{resource.metadata.name}' },
        },
      });
      component.LuigiClient = makeLuigiClient(navSpy);

      component.navigateToResource({ metadata: { name: 'res1' } } as any);

      expect(navSpy).toHaveBeenCalledWith('/workspaces/res1');
    });

    it('should not navigate when detailView is not defined', () => {
      const navSpy = vi.fn();
      component.context = makeContext({ ui: { listView: { fields: [] } } });
      component.LuigiClient = makeLuigiClient(navSpy);

      component.navigateToResource({ metadata: { name: 'res1' } } as any);

      expect(navSpy).not.toHaveBeenCalled();
    });

    it('should not navigate when ui is not defined', () => {
      const navSpy = vi.fn();
      component.context = signal({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
        },
      }) as any;
      component.LuigiClient = makeLuigiClient(navSpy);

      component.navigateToResource({ metadata: { name: 'res1' } } as any);

      expect(navSpy).not.toHaveBeenCalled();
    });

    it('should show alert and throw when resource name is undefined', () => {
      const showAlertSpy = vi.fn();
      component.LuigiClient = (() => ({
        linkManager: () => ({ navigate: vi.fn() }),
        uxManager: () => ({ showAlert: showAlertSpy }),
      })) as any;

      expect(() =>
        component.navigateToResource({ metadata: {} } as any),
      ).toThrow('Resource name is not defined');
      expect(showAlertSpy).toHaveBeenCalledWith({
        text: 'Resource name is not defined',
        type: 'error',
      });
    });
  });

  describe('Delete resource', () => {
    it('should delegate non-delete button actions to executeButtonAction', () => {
      // executeAction now always calls executeButtonAction - delete is handled
      // by DeclarativeTableCard via deleteResourceConfirmationConfig, not here
      const resource = { metadata: { name: 'test' } } as any;
      const event = {
        stopPropagation: vi.fn(),
      } as unknown as MouseEvent;

      // A non-delete action (e.g. navigate) should not throw
      expect(() =>
        component.executeAction({
          event,
          resource,
          field: {
            property: 'metadata.name',
            uiSettings: {
              displayAs: 'button',
              buttonSettings: { action: 'navigate' },
            },
          },
        }),
      ).not.toThrow();
    });

    it('should delete the resource and close the dialog via tableCard', () => {
      const resource = { metadata: { name: 'test' } } as any;
      const closeDeleteDialog = vi.fn();
      mockResourceService.delete.mockReturnValue(of(resource));
      vi.spyOn(component as any, 'tableCard', 'get').mockReturnValue(() => ({
        closeDeleteDialog,
      }));

      component.delete(resource);

      expect(mockResourceService.delete).toHaveBeenCalledWith(
        resource,
        component.resourceDefinition(),
        component.context(),
      );
      expect(closeDeleteDialog).toHaveBeenCalled();
    });

    it('should handle delete errors', () => {
      const resource = { metadata: { name: 'test' } } as any;
      const error = new Error('delete failed');
      mockResourceService.delete.mockReturnValue(throwError(() => error));

      component.delete(resource);

      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error);
    });

    it('should build the delete confirmation config from the resource via config()', () => {
      const deleteConfig = component.config().deleteResourceConfirmationConfig!(
        {
          metadata: { name: 'My-Cluster' },
        } as any,
      );

      // name is lower-cased and used as the confirmation text
      expect(deleteConfig.title).toBe('Delete my-cluster');
      expect(deleteConfig.confirmationText).toBe('my-cluster');
      expect(deleteConfig.message).toContain('<b>my-cluster</b>');
      expect(deleteConfig.message).toContain('Cluster');
      expect(deleteConfig.confirmLabel).toBe('Delete');
      expect(deleteConfig.cancelLabel).toBe('Cancel');
      expect(deleteConfig.confirmationPlaceholder).toBe('Type name');
    });

    it('should fall back to an empty confirmation name when metadata.name is missing', () => {
      const deleteConfig = component.config().deleteResourceConfirmationConfig!(
        {
          metadata: {},
        } as any,
      );

      expect(deleteConfig.title).toBe('Delete ');
      expect(deleteConfig.confirmationText).toBe('');
    });
  });

  describe('Pagination', () => {
    it('should update pagination limit when onLimitChange is called', () => {
      component.onLimitChange(10);
      expect(component.paginationLimit()).toBe(10);
    });

    it('should reset pagination when limit changes', () => {
      component.resources.set([
        { metadata: { name: 'res1' } },
        { metadata: { name: 'res2' } },
        { metadata: { name: 'res3' } },
        { metadata: { name: 'res4' } },
        { metadata: { name: 'res5' } },
      ] as any);
      component.remainingItemCount.set(10);

      component.onLimitChange(3);

      expect(component.paginationLimit()).toBe(3);
      expect(component.resources().length).toBe(3);
      expect(component.hasMore()).toBe(true);
    });

    it('should load more resources when loadMore is called and hasMore is true', () => {
      const listSpy = vi.spyOn(component, 'list');
      component.hasMore.set(true);
      component.loadMore();
      expect(listSpy).toHaveBeenCalled();
    });

    it('should not load more resources when hasMore is false', () => {
      const listSpy = vi.spyOn(component, 'list');
      component.hasMore.set(false);
      component.loadMore();
      expect(listSpy).not.toHaveBeenCalled();
    });

    it('should calculate totalItemsCount correctly', () => {
      component.resources.set([
        { metadata: { name: 'res1' } },
        { metadata: { name: 'res2' } },
      ] as any);
      component.remainingItemCount.set(8);
      expect(component.totalItemsCount()).toBe(10);
    });
  });

  describe('Create resource', () => {
    it('should detect hasUiCreateViewFields when createView fields are defined', () => {
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          ui: {
            createView: { fields: [{ property: 'metadata.name' }] },
            listView: { fields: [] },
          },
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      expect(newComponent.hasUiCreateViewFields()).toBe(true);
    });

    it('should return false for hasUiCreateViewFields when createView is undefined', () => {
      expect(component.hasUiCreateViewFields()).toBe(false);
    });

    it('should include createResourceFormConfig with a lazy fields thunk when createView fields exist', async () => {
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          ui: {
            createView: {
              fields: [
                { property: 'metadata.name', label: 'Name', required: true },
              ],
            },
            listView: { fields: [] },
          },
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();

      const formConfig = newComponent.config().createResourceFormConfig;
      expect(formConfig).toBeDefined();
      // `fields` is a thunk resolved lazily on dialog open (fetches dynamic
      // options on demand rather than prefetching them on render).
      expect(typeof formConfig!.fields).toBe('function');

      const resolved = await (formConfig!.fields as () => Promise<any[]>)();
      expect(resolved[0].name).toBe('metadata.name');
      expect(resolved[0].label).toBe('Name');
      expect(resolved[0].required).toBe(true);
    });

    it('should not include createResourceFormConfig when no createView fields', () => {
      expect(component.config().createResourceFormConfig).toBeUndefined();
    });

    it('should call resourceService.create on onCreateSubmit', () => {
      mockResourceService.create = vi
        .fn()
        .mockReturnValue(of({ metadata: { name: 'new' } }));
      const mockCloseDialog = vi.fn();
      vi.spyOn(component as any, 'tableCard', 'get').mockReturnValue(() => ({
        closeCreateDialog: mockCloseDialog,
      }));
      component.onCreateSubmit({ metadata: { name: 'new' } });
      expect(mockResourceService.create).toHaveBeenCalled();
    });

    it('should pass a create error to the error handler', () => {
      const error = new Error('create failed');
      mockResourceService.create = vi
        .fn()
        .mockReturnValue(throwError(() => error));

      component.onCreateSubmit({ metadata: { name: 'new' } });

      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error);
    });

    it('should pass a dynamic values read error to the error handler', async () => {
      const error = new Error('list failed');
      mockResourceService.list.mockReturnValue(throwError(() => error));

      const result = await (component as any).resolveDynamicValuesResult(
        {
          dynamicValuesDefinition: {
            operation: 'v1.Namespaces.items',
            gqlQuery:
              'query { v1 { Namespaces { items { metadata { name } } } } }',
            value: 'metadata.name',
          },
        },
        {},
      );

      expect(result).toEqual({ kind: 'error', error });
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error);
    });

    it('should reset createFieldErrors after successful create', () => {
      mockResourceService.create = vi
        .fn()
        .mockReturnValue(of({ metadata: { name: 'new' } }));
      vi.spyOn(component as any, 'tableCard', 'get').mockReturnValue(() => ({
        closeCreateDialog: vi.fn(),
      }));
      component.onCreateFieldChange({
        fieldProperty: 'metadata.name',
        value: 'bad value!!',
      });
      component.onCreateSubmit({ metadata: { name: 'new' } });
      expect(component.createFormState().fieldErrors).toEqual({});
    });

    it('should set k8s name error for invalid metadata.name', () => {
      component.onCreateFieldChange({
        fieldProperty: 'metadata.name',
        value: 'Invalid Name!!',
      });
      expect(
        component.createFormState().fieldErrors?.['metadata.name'],
      ).toBeTruthy();
    });

    it('should clear k8s name error for valid metadata.name', () => {
      component.onCreateFieldChange({
        fieldProperty: 'metadata.name',
        value: 'Invalid Name!!',
      });
      component.onCreateFieldChange({
        fieldProperty: 'metadata.name',
        value: 'valid-name',
      });
      expect(
        component.createFormState().fieldErrors?.['metadata.name'],
      ).toBeFalsy();
    });

    const makeNamespacedCreateContext = () =>
      signal({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          scope: 'Namespaced',
          ui: {
            createView: { fields: [{ property: 'metadata.name' }] },
            listView: { fields: [] },
          },
        },
      }) as any;

    it('should not add a metadata.namespace field when a namespace is already resolved', () => {
      mockResourceService.getNamespace.mockReturnValue('default');
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = makeNamespacedCreateContext();
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      const properties = newComponent.createFormFields().map((f) => f.property);
      expect(properties).not.toContain('metadata.namespace');
    });

    it('should add a metadata.namespace field when no namespace is resolved', () => {
      mockResourceService.getNamespace.mockReturnValue(undefined);
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = makeNamespacedCreateContext();
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      const properties = newComponent.createFormFields().map((f) => f.property);
      expect(properties).toContain('metadata.namespace');
    });

    describe('namespace for Create on a namespace route', () => {
      const secretQuery =
        'query ($namespace: String!) { v1 { Secrets(namespace: $namespace) { items { metadata { name } } } } }';

      const makeCreateComponent = (
        pathParams?: Record<string, string>,
        contextOverrides: object = {},
      ) => {
        mockResourceService.getNamespace.mockImplementation(
          (context: any) => context.namespaceId,
        );
        mockResourceService.list.mockImplementation(
          (_operation: string, fieldsOrQuery: any) =>
            typeof fieldsOrQuery === 'string'
              ? of([{ metadata: { name: 'llm-credentials' } }])
              : of({ items: [], resourceVersion: '1' }),
        );
        mockResourceService.create = vi.fn().mockReturnValue(of({}));

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = signal({
          resourceDefinition: {
            entityCollection: 'ChatUIInstances',
            entity: 'ChatUIInstance',
            apiGroup: 'ui_privatellms_msp',
            version: 'v1alpha1',
            scope: 'Namespaced',
            ui: {
              createView: {
                fields: [
                  { property: 'metadata.name', required: true },
                  {
                    property: 'spec.credentialsSecretRef.name',
                    required: true,
                    dynamicValuesDefinition: {
                      operation: 'v1.Secrets.items',
                      gqlQuery: secretQuery,
                      value: 'metadata.name',
                      key: 'metadata.name',
                    },
                  },
                ],
              },
              listView: { fields: [] },
            },
          },
          ...contextOverrides,
        }) as any;
        newComponent.LuigiClient = (() => ({
          linkManager: () => ({ navigate: vi.fn() }),
          uxManager: () => ({ showAlert: vi.fn() }),
          getNodeParams: vi.fn(),
          getPathParams: vi.fn(() => pathParams),
        })) as any;
        vi.spyOn(newComponent as any, 'tableCard', 'get').mockReturnValue(
          () => ({ closeCreateDialog: vi.fn() }),
        );
        newFixture.detectChanges();
        return { newComponent };
      };

      const openCreate = (component: ResourceTableCard) =>
        (
          component.config().createResourceFormConfig!.fields as () => Promise<
            any[]
          >
        )();

      const secretQueryCalls = () =>
        mockResourceService.list.mock.calls.filter(
          (call) => call[1] === secretQuery,
        );

      it('keeps the route namespace when the selection is -all-', async () => {
        const { newComponent } = makeCreateComponent({
          accountId: 'demo',
          namespaceId: 'default',
        });

        const fields = await openCreate(newComponent);
        newComponent.onCreateSubmit({ metadata: { name: 'chat' } });

        expect(fields.map((f) => f.name)).not.toContain('metadata.namespace');
        expect(
          fields.find((f) => f.name === 'spec.credentialsSecretRef.name')
            ?.values,
        ).toEqual(['llm-credentials']);
        expect(secretQueryCalls()).toHaveLength(1);
        expect(secretQueryCalls()[0][2].namespaceId).toBe('default');
        expect(
          (mockResourceService.create as any).mock.calls[0][2].namespaceId,
        ).toBe('default');
      });

      it('lets a concrete namespace selection win over the route', async () => {
        const { newComponent } = makeCreateComponent(
          { namespaceId: 'default' },
          { namespaceId: 'team-b' },
        );

        await openCreate(newComponent);
        newComponent.onCreateSubmit({ metadata: { name: 'chat' } });

        expect(secretQueryCalls()[0][2].namespaceId).toBe('team-b');
        expect(
          (mockResourceService.create as any).mock.calls[0][2].namespaceId,
        ).toBe('team-b');
      });

      it('skips a query that requires $namespace when no namespace resolves', async () => {
        const { newComponent } = makeCreateComponent({ accountId: 'demo' });

        const fields = await openCreate(newComponent);

        expect(secretQueryCalls()).toHaveLength(0);
        expect(fields.map((f) => f.name)).toContain('metadata.namespace');
        expect(
          fields.find((f) => f.name === 'spec.credentialsSecretRef.name')
            ?.values,
        ).toBeUndefined();
      });

      it('keeps the list query on the unresolved selection', () => {
        makeCreateComponent({ namespaceId: 'default' });

        const listCall = mockResourceService.list.mock.calls.find(
          (call) => typeof call[1] !== 'string',
        )!;
        expect(listCall[2].namespaceId).toBeUndefined();
      });
    });

    it('should set required error for empty required field', async () => {
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          ui: {
            createView: { fields: [{ property: 'spec.type', required: true }] },
            listView: { fields: [] },
          },
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      await newComponent.onCreateFieldChange({
        fieldProperty: 'spec.type',
        value: '',
      });
      expect(newComponent.createFormState().fieldErrors?.['spec.type']).toBe(
        'This field is required',
      );
    });

    describe('B5: onFieldChange hook and resolveDynamicValues (formValues-aware)', () => {
      const depQuery =
        'query ($namespace: String!) { v1 { Secrets(namespace: $namespace) { items { metadata { name } } } } }';

      const makeDepComponent = (pathParams?: Record<string, string>) => {
        mockResourceService.getNamespace.mockImplementation(
          (context: any) => context.namespaceId,
        );
        // dynamic-values calls return resources; list calls return ResourceListResult
        mockResourceService.list.mockImplementation(
          (_op: string, fieldsOrQuery: any) =>
            typeof fieldsOrQuery === 'string'
              ? of([{ metadata: { name: 'secret-a' } }])
              : of({ items: [], resourceVersion: '1' }),
        );

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = signal({
          namespaceId: 'ns-from-context',
          resourceDefinition: {
            entityCollection: 'ChatUIInstances',
            entity: 'ChatUIInstance',
            apiGroup: 'ui_privatellms_msp',
            version: 'v1alpha1',
            scope: 'Namespaced',
            ui: {
              createView: {
                fields: [
                  { property: 'metadata.name', required: true },
                  {
                    property: 'spec.secretRef',
                    required: true,
                    dynamicValuesDefinition: {
                      operation: 'v1.Secrets.items',
                      gqlQuery: depQuery,
                      value: 'metadata.name',
                      key: 'metadata.name',
                      gqlQueryVariables: {
                        namespace: '{form.metadata.namespace}',
                      },
                    },
                  },
                ],
              },
              listView: { fields: [] },
            },
          },
        }) as any;
        newComponent.LuigiClient = (() => ({
          linkManager: () => ({ navigate: vi.fn() }),
          uxManager: () => ({ showAlert: vi.fn() }),
          getNodeParams: vi.fn(),
          getPathParams: vi.fn(() => pathParams),
        })) as any;
        vi.spyOn(newComponent as any, 'tableCard', 'get').mockReturnValue(
          () => ({ closeCreateDialog: vi.fn() }),
        );
        newFixture.detectChanges();
        return newComponent;
      };

      it('namespace field is FIRST in the createFormFields array', () => {
        mockResourceService.getNamespace.mockReturnValue(undefined);
        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = signal({
          resourceDefinition: {
            entityCollection: 'clusters',
            entity: 'Cluster',
            apiGroup: 'core_k8s_io',
            version: 'v1alpha1',
            scope: 'Namespaced',
            ui: {
              createView: {
                fields: [{ property: 'metadata.name' }],
              },
              listView: { fields: [] },
            },
          },
        }) as any;
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();
        const fields = newComponent.createFormFields();
        expect(fields[0].property).toBe('metadata.namespace');
      });

      it('resolveDynamicValuesResult injects {form.namespace} into list call variables', async () => {
        mockResourceService.list.mockClear();
        mockResourceService.list.mockImplementation((_op: string, q: any) =>
          typeof q === 'string'
            ? of([{ metadata: { name: 'secret-a' } }])
            : of({ items: [], resourceVersion: '1' }),
        );
        mockResourceService.getNamespace.mockReturnValue('ns-test');

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = signal({
          namespaceId: 'ns-test',
          resourceDefinition: {
            entityCollection: 'ChatUIInstances',
            entity: 'ChatUIInstance',
            apiGroup: 'ui_privatellms_msp',
            version: 'v1alpha1',
            scope: 'Namespaced',
            ui: {
              createView: { fields: [{ property: 'metadata.name' }] },
              listView: { fields: [] },
            },
          },
        }) as any;
        newComponent.LuigiClient = (() => ({
          linkManager: () => ({ navigate: vi.fn() }),
          uxManager: () => ({ showAlert: vi.fn() }),
          getNodeParams: vi.fn(),
          getPathParams: vi.fn(() => undefined),
        })) as any;
        newFixture.detectChanges();

        const result = await (newComponent as any).resolveDynamicValuesResult(
          {
            dynamicValuesDefinition: {
              operation: 'v1.Secrets.items',
              gqlQuery: depQuery,
              value: 'metadata.name',
              gqlQueryVariables: { namespace: '{form.metadata.namespace}' },
            },
          },
          { 'metadata.namespace': 'injected-ns' },
        );

        expect(result).toEqual({ kind: 'ready', values: ['secret-a'] });
        const depQueryCalls = mockResourceService.list.mock.calls.filter(
          (c) => c[1] === depQuery,
        );
        expect(depQueryCalls).toHaveLength(1);
        expect(depQueryCalls[0][3]).toEqual({
          variables: {
            namespace: { type: 'String!', value: 'injected-ns' },
          },
        });
      });

      it('resolveDynamicValuesResult returns blocked for a query with unresolved {form.*} namespace placeholder', async () => {
        mockResourceService.list.mockClear();
        mockResourceService.getNamespace.mockReturnValue(undefined);

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = signal({
          resourceDefinition: {
            entityCollection: 'ChatUIInstances',
            entity: 'ChatUIInstance',
            apiGroup: 'ui_privatellms_msp',
            version: 'v1alpha1',
            scope: 'Namespaced',
            ui: {
              createView: { fields: [{ property: 'metadata.name' }] },
              listView: { fields: [] },
            },
          },
        }) as any;
        newComponent.LuigiClient = (() => ({
          linkManager: () => ({ navigate: vi.fn() }),
          uxManager: () => ({ showAlert: vi.fn() }),
          getNodeParams: vi.fn(),
          getPathParams: vi.fn(() => undefined),
        })) as any;
        newFixture.detectChanges();

        const result = await (newComponent as any).resolveDynamicValuesResult(
          {
            dynamicValuesDefinition: {
              operation: 'v1.Secrets.items',
              gqlQuery: depQuery,
              value: 'metadata.name',
              gqlQueryVariables: { namespace: '{form.metadata.namespace}' },
            },
          },
          {},
        );

        expect(result).toEqual({ kind: 'blocked' });
        expect(
          mockResourceService.list.mock.calls.filter((c) => c[1] === depQuery),
        ).toHaveLength(0);
      });

      it('parent trigger field gets validation:onChange set in the fields thunk', async () => {
        // Use a namespaced context with NO resolved namespace so the synthetic
        // namespace field is added to createFormFields and becomes a trigger.
        mockResourceService.getNamespace.mockReturnValue(undefined);
        mockResourceService.list.mockImplementation((_op: string, q: any) =>
          typeof q === 'string'
            ? of([{ metadata: { name: 'secret-a' } }])
            : of({ items: [], resourceVersion: '1' }),
        );

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = signal({
          resourceDefinition: {
            entityCollection: 'ChatUIInstances',
            entity: 'ChatUIInstance',
            apiGroup: 'ui_privatellms_msp',
            version: 'v1alpha1',
            scope: 'Namespaced',
            ui: {
              createView: {
                fields: [
                  { property: 'metadata.name', required: true },
                  {
                    property: 'spec.secretRef',
                    required: true,
                    dynamicValuesDefinition: {
                      operation: 'v1.Secrets.items',
                      gqlQuery: depQuery,
                      value: 'metadata.name',
                      key: 'metadata.name',
                      gqlQueryVariables: {
                        namespace: '{form.metadata.namespace}',
                      },
                    },
                  },
                ],
              },
              listView: { fields: [] },
            },
          },
        }) as any;
        newComponent.LuigiClient = (() => ({
          linkManager: () => ({ navigate: vi.fn() }),
          uxManager: () => ({ showAlert: vi.fn() }),
          getNodeParams: vi.fn(),
          getPathParams: vi.fn(() => undefined),
        })) as any;
        newFixture.detectChanges();

        const formConfig = newComponent.config().createResourceFormConfig!;
        const fields = await (formConfig.fields as () => Promise<any[]>)();

        // metadata.namespace is a parent trigger (spec.secretRef references it)
        const nsField = fields.find((f) => f.name === 'metadata.namespace');
        expect(nsField?.validation).toBe('onChange');
      });
    });
  });

  describe('Edit resource', () => {
    it.each(['', null, undefined, 'replacement'])(
      'omits empty write-only values before updating (%s)',
      (password) => {
        (component.context as any).set(
          makeContext({
            ui: {
              listView: { fields: [] },
              createView: {
                fields: [
                  {
                    property: 'spec.password',
                    inputType: 'Password',
                    writeOnly: true,
                  },
                  { property: 'spec.description' },
                ],
              },
            },
          })(),
        );
        const closeEditDialog = vi.fn();
        (component as any).tableCard = () => ({ closeEditDialog });
        mockResourceService.update.mockReturnValue(
          of({ metadata: { name: 'resource' } }),
        );
        const value = {
          metadata: { name: 'resource' },
          spec: { password, description: '' },
        };
        component.onEditSubmit({
          resource: { metadata: { name: 'resource' } },
          value,
        });
        expect(mockResourceService.update).toHaveBeenCalledWith(
          {
            metadata: { name: 'resource' },
            spec: { description: '', ...(password && { password }) },
          },
          expect.anything(),
          component.context(),
        );
        expect(value.spec.password).toBe(password);
        expect(closeEditDialog).toHaveBeenCalledOnce();
      },
    );

    const makeEditContext = (overrides: object = {}) =>
      signal({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          ui: {
            createView: {
              fields: [
                { property: 'metadata.name', label: 'Name', required: true },
              ],
            },
            listView: { fields: [] },
          },
          ...overrides,
        },
      }) as any;

    it('should include editResourceFormConfig when createView fields exist and canDo("update") is true', () => {
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = makeEditContext();
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();

      expect(newComponent.config().editResourceFormConfig).toBeDefined();
    });

    it('editResourceFormConfig returns a config when called with a resource', async () => {
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = makeEditContext();
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();

      const resource = { metadata: { name: 'test' } } as any;
      const editConfig =
        newComponent.config().editResourceFormConfig!(resource);
      expect(editConfig).toBeDefined();
      expect(typeof editConfig.fields).toBe('function');

      const resolved = await (editConfig.fields as () => Promise<any[]>)();
      expect(resolved[0].name).toBe('metadata.name');
      expect(resolved[0].label).toBe('Name');
      expect(resolved[0].required).toBe(true);
    });

    it('should NOT include editResourceFormConfig when canDo("update") is denied', () => {
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        portalPermissions: { clusters: ['get', 'create'] }, // no 'update'
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          permissionsDefinition: {
            group: 'core.k8s.io',
            resource: 'clusters',
            entityActions: ['get'],
            resourceActions: ['create'],
            entityContextKey: 'entityName',
          },
          ui: {
            createView: { fields: [{ property: 'metadata.name' }] },
            listView: { fields: [] },
          },
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();

      expect(newComponent.config().editResourceFormConfig).toBeUndefined();
    });

    it('should NOT include editResourceFormConfig when no createView fields', () => {
      // context from beforeEach has no createView fields
      expect(component.config().editResourceFormConfig).toBeUndefined();
    });

    it('editResourceFormConfig fields thunk sets validation:onChange on parent trigger fields', async () => {
      const depQuery =
        'query ($namespace: String!) { v1 { Secrets(namespace: $namespace) { items { metadata { name } } } } }';
      mockResourceService.getNamespace.mockReturnValue(undefined);
      mockResourceService.list.mockImplementation((_op: string, q: any) =>
        typeof q === 'string'
          ? of([{ metadata: { name: 'secret-a' } }])
          : of({ items: [], resourceVersion: '1' }),
      );

      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        resourceDefinition: {
          entityCollection: 'ChatUIInstances',
          entity: 'ChatUIInstance',
          apiGroup: 'ui_privatellms_msp',
          version: 'v1alpha1',
          scope: 'Namespaced',
          ui: {
            createView: {
              fields: [
                { property: 'metadata.name', required: true },
                {
                  property: 'spec.secretRef',
                  required: true,
                  dynamicValuesDefinition: {
                    operation: 'v1.Secrets.items',
                    gqlQuery: depQuery,
                    value: 'metadata.name',
                    key: 'metadata.name',
                    gqlQueryVariables: {
                      namespace: '{form.metadata.namespace}',
                    },
                  },
                },
              ],
            },
            listView: { fields: [] },
          },
        },
      }) as any;
      newComponent.LuigiClient = (() => ({
        linkManager: () => ({ navigate: vi.fn() }),
        uxManager: () => ({ showAlert: vi.fn() }),
        getNodeParams: vi.fn(),
        getPathParams: vi.fn(() => undefined),
      })) as any;
      newFixture.detectChanges();

      const resource = { metadata: { name: 'test' } } as any;
      const editConfig =
        newComponent.config().editResourceFormConfig!(resource);
      const fields = await (editConfig.fields as () => Promise<any[]>)();

      // metadata.namespace is a parent trigger (spec.secretRef references it)
      const nsField = fields.find((f: any) => f.name === 'metadata.namespace');
      expect(nsField?.validation).toBe('onChange');
    });

    it('editResourceFormConfig fields thunk resolves dependent values against the prefilled parent (initial edit-open resolve)', async () => {
      // Regression test for the edit-open empty-options bug: BEFORE this fix,
      // the edit thunk passed `{}` as formValues to resolveDynamicValues, so
      // dependent fields saw an unresolved `{form.metadata.namespace}` and
      // their resolver returned [] (or no call at all). AFTER this fix, the
      // thunk uses `buildInitialValues(createFormFields(), resource)` as the
      // parent-value map — so the dependent's values are resolved against the
      // prefilled parent before the dialog ever mounts.
      const depQuery =
        'query ($namespace: String!) { v1 { Secrets(namespace: $namespace) { items { metadata { name } } } } }';
      mockResourceService.getNamespace.mockReturnValue(undefined);
      mockResourceService.list.mockImplementation((_op: string, q: any) =>
        typeof q === 'string'
          ? of([{ metadata: { name: 'secret-for-ns-a' } }])
          : of({ items: [], resourceVersion: '1' }),
      );

      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        resourceDefinition: {
          entityCollection: 'ChatUIInstances',
          entity: 'ChatUIInstance',
          apiGroup: 'ui_privatellms_msp',
          version: 'v1alpha1',
          scope: 'Namespaced',
          ui: {
            createView: {
              fields: [
                { property: 'metadata.name', required: true },
                {
                  property: 'spec.secretRef',
                  required: true,
                  dynamicValuesDefinition: {
                    operation: 'v1.Secrets.items',
                    gqlQuery: depQuery,
                    value: 'metadata.name',
                    key: 'metadata.name',
                    gqlQueryVariables: {
                      namespace: '{form.metadata.namespace}',
                    },
                  },
                },
              ],
            },
            listView: { fields: [] },
          },
        },
      }) as any;
      newComponent.LuigiClient = (() => ({
        linkManager: () => ({ navigate: vi.fn() }),
        uxManager: () => ({ showAlert: vi.fn() }),
        getNodeParams: vi.fn(),
        getPathParams: vi.fn(() => undefined),
      })) as any;
      newFixture.detectChanges();

      // Resource with a prefilled namespace. The edit thunk MUST pass this
      // namespace to resolveDynamicValues so the dependent's options list is
      // populated before the user interacts.
      const resource = {
        metadata: { name: 'edited', namespace: 'ns-a' },
        spec: { secretRef: 'secret-for-ns-a' },
      } as any;
      const editConfig =
        newComponent.config().editResourceFormConfig!(resource);
      const fields = await (editConfig.fields as () => Promise<any[]>)();

      const dep = fields.find((f: any) => f.name === 'spec.secretRef');
      expect(dep?.values).toEqual(['secret-for-ns-a']);

      // And the resolver was actually called with the resolved namespace,
      // confirming parentValues flowed through.
      const secretCalls = mockResourceService.list.mock.calls.filter(
        (c) => c[0] === 'v1.Secrets.items',
      );
      expect(secretCalls.length).toBeGreaterThan(0);
      expect(secretCalls[0][3]).toEqual({
        variables: { namespace: { type: 'String!', value: 'ns-a' } },
      });
    });

    it('keeps metadata.namespace immutable while an editable parent refreshes its dependent', async () => {
      const query =
        'query ($namespace: String!) { Secrets(namespace: $namespace) { items { metadata { name } } } }';
      mockResourceService.getNamespace.mockReturnValue('prod');
      mockResourceService.list.mockImplementation(
        (_op: string, fieldsOrQuery: unknown) =>
          typeof fieldsOrQuery === 'string'
            ? of([{ metadata: { name: 'db-password' } }])
            : of({ items: [], resourceVersion: '1' }),
      );

      const localFixture = TestBed.createComponent(ResourceTableCard);
      const local = localFixture.componentInstance;
      local.context = signal({
        resourceDefinition: {
          entityCollection: 'Resources',
          entity: 'Resource',
          apiGroup: 'example.io',
          version: 'v1',
          scope: 'Namespaced',
          ui: {
            listView: { fields: [] },
            createView: {
              fields: [
                { property: 'metadata.namespace' },
                { property: 'spec.targetNamespace' },
                {
                  property: 'spec.secretRef.name',
                  required: true,
                  dynamicValuesDefinition: {
                    operation: 'Secrets.items',
                    gqlQuery: query,
                    key: 'metadata.name',
                    value: 'metadata.name',
                    gqlQueryVariables: {
                      namespace: '{form.spec.targetNamespace}',
                    },
                  },
                },
              ],
            },
          },
        },
      }) as any;
      local.LuigiClient = makeLuigiClient();
      const applyPatch = vi.fn();
      (local as any).tableCard = () => ({ applyEditFormPatch: applyPatch });
      localFixture.detectChanges();

      const resource = {
        metadata: { namespace: 'prod' },
        spec: { targetNamespace: 'prod', secretRef: { name: 'db-password' } },
      } as any;
      const config = local.config().editResourceFormConfig!(resource);
      const fields = await (config.fields as () => Promise<any[]>)();
      expect(
        fields.find((field) => field.name === 'metadata.namespace')?.disabled,
      ).toBe(true);
      expect(
        fields.find((field) => field.name === 'spec.targetNamespace')?.disabled,
      ).toBe(false);
      expect(
        fields.find((field) => field.name === 'spec.secretRef.name')?.values,
      ).toEqual(['db-password']);

      mockResourceService.list.mockClear();
      local.onEditFieldChange({
        resource,
        formChangeEvent: {
          fieldProperty: 'spec.targetNamespace',
          value: 'staging',
          source: 'user',
          formValues: {
            'metadata.namespace': 'prod',
            'spec.targetNamespace': 'staging',
            'spec.secretRef.name': 'db-password',
          },
        },
      });
      expect(applyPatch).toHaveBeenCalledWith(
        expect.objectContaining({
          values: { 'spec.secretRef.name': '' },
        }),
      );
      expect(local.editFormState().pending).toBe(true);
      expect(
        local.editFormState().fieldErrors?.['spec.secretRef.name'],
      ).toBeNull();

      await vi.waitFor(() =>
        expect(applyPatch).toHaveBeenLastCalledWith(
          expect.objectContaining({
            fieldUpdates: {
              'spec.secretRef.name': { values: ['db-password'] },
            },
          }),
        ),
      );
      expect(local.editFormState().pending).toBe(true);
      local.onEditFieldChange({
        resource,
        formChangeEvent: {
          fieldProperty: 'spec.secretRef.name',
          value: '',
          source: 'seed',
        },
      });
      expect(
        local.editFormState().fieldErrors?.['spec.secretRef.name'],
      ).toBeNull();
      expect(local.editFormState().pending).toBe(true);
      local.onEditFieldChange({
        resource,
        formChangeEvent: {
          fieldProperty: 'spec.secretRef.name',
          value: 'new-secret',
          source: 'user',
        },
      });
      expect(local.editFormState().pending).toBe(false);
      expect(mockResourceService.list).toHaveBeenCalledWith(
        'Secrets.items',
        query,
        expect.anything(),
        { variables: { namespace: { type: 'String!', value: 'staging' } } },
      );
    });

    it('onEditSubmit calls resourceService.update and closes the edit dialog', () => {
      const closeEditDialog = vi.fn();
      mockResourceService.update = vi
        .fn()
        .mockReturnValue(of({ metadata: { name: 'updated' } }));
      vi.spyOn(component as any, 'tableCard', 'get').mockReturnValue(() => ({
        closeEditDialog,
      }));

      component.onEditSubmit({
        resource: { metadata: { name: 'existing' } } as any,
        value: { metadata: { name: 'updated' } } as any,
      });

      expect(mockResourceService.update).toHaveBeenCalled();
      expect(closeEditDialog).toHaveBeenCalled();
    });

    it('onEditSubmit clears editFieldErrors on success', () => {
      mockResourceService.update = vi
        .fn()
        .mockReturnValue(of({ metadata: { name: 'updated' } }));
      vi.spyOn(component as any, 'tableCard', 'get').mockReturnValue(() => ({
        closeEditDialog: vi.fn(),
      }));

      (component as any).editFieldErrors.set({ 'metadata.name': 'Some error' });

      component.onEditSubmit({
        resource: { metadata: { name: 'existing' } } as any,
        value: { metadata: { name: 'updated' } } as any,
      });

      expect(component.editFormState().fieldErrors).toEqual({});
    });

    it('onEditSubmit passes an update error to the error handler', () => {
      const error = new Error('update failed');
      mockResourceService.update = vi
        .fn()
        .mockReturnValue(throwError(() => error));

      component.onEditSubmit({
        resource: { metadata: { name: 'existing' } } as any,
        value: { metadata: { name: 'bad' } } as any,
      });

      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(error);
    });

    it('onEditFieldChange validates metadata.name with k8s name regex via wrapper shape', async () => {
      await component.onEditFieldChange({
        resource: { metadata: { name: 'existing' } } as any,
        formChangeEvent: {
          fieldProperty: 'metadata.name',
          value: 'Invalid Name!!',
        },
      });
      expect(
        component.editFormState().fieldErrors?.['metadata.name'],
      ).toBeTruthy();
    });

    it('onEditFieldChange clears error for valid metadata.name', async () => {
      await component.onEditFieldChange({
        resource: { metadata: { name: 'existing' } } as any,
        formChangeEvent: {
          fieldProperty: 'metadata.name',
          value: 'Invalid Name!!',
        },
      });
      await component.onEditFieldChange({
        resource: { metadata: { name: 'existing' } } as any,
        formChangeEvent: {
          fieldProperty: 'metadata.name',
          value: 'valid-name',
        },
      });
      expect(
        component.editFormState().fieldErrors?.['metadata.name'],
      ).toBeFalsy();
    });
  });

  describe('List subscription', () => {
    beforeEach(() => {
      mockResourceService.list.mockReturnValue(
        of({ items: [], resourceVersion: '1' }),
      );
    });

    it('should handle ADDED operation in subscription', () => {
      const subscriptionSubject = new Subject<
        ResourceSubscriptionResult | undefined
      >();
      mockResourceService.resourceChangeSubscription.mockReturnValue(
        subscriptionSubject,
      );
      mockResourceService.list.mockReturnValue(
        of({
          items: [{ id: 'existing', metadata: { name: 'existing' } }],
          resourceVersion: '1',
        }),
      );

      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = makeContext();
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();

      subscriptionSubject.next({
        type: 'ADDED',
        object: { id: 'new-resource', metadata: { name: 'new-resource' } },
      });

      expect(newComponent.resources().length).toBe(2);
      expect(
        newComponent
          .resources()
          .some((r) => r.metadata.name === 'new-resource'),
      ).toBe(true);
    });

    it('should handle MODIFIED operation in subscription', () => {
      const subscriptionSubject = new Subject<
        ResourceSubscriptionResult | undefined
      >();
      mockResourceService.resourceChangeSubscription.mockReturnValue(
        subscriptionSubject,
      );
      mockResourceService.list.mockReturnValue(
        of({
          items: [
            {
              id: 'existing',
              metadata: { name: 'existing' },
              spec: { type: 'v1' },
            },
          ],
          resourceVersion: '1',
        }),
      );

      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = makeContext();
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();

      subscriptionSubject.next({
        type: 'MODIFIED',
        object: {
          id: 'existing',
          metadata: { name: 'existing' },
          spec: { type: 'v2' },
        },
      });

      expect(newComponent.resources().length).toBe(1);
      expect(newComponent.resources()[0]?.spec?.type).toBe('v2');
    });

    it('should handle DELETED operation in subscription', () => {
      const subscriptionSubject = new Subject<
        ResourceSubscriptionResult | undefined
      >();
      mockResourceService.resourceChangeSubscription.mockReturnValue(
        subscriptionSubject,
      );
      mockResourceService.list.mockReturnValue(
        of({
          items: [
            { id: 'to-delete', metadata: { name: 'to-delete' } },
            { id: 'to-keep', metadata: { name: 'to-keep' } },
          ],
          resourceVersion: '1',
        }),
      );

      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = makeContext();
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();

      subscriptionSubject.next({
        type: 'DELETED',
        object: { id: 'to-delete', metadata: { name: 'to-delete' } },
      });

      expect(newComponent.resources().length).toBe(1);
      expect(newComponent.resources()[0].metadata.name).toBe('to-keep');
    });

    it('should handle null/undefined subscription results', () => {
      const subscriptionSubject = new Subject<
        ResourceSubscriptionResult | undefined
      >();
      mockResourceService.resourceChangeSubscription.mockReturnValue(
        subscriptionSubject,
      );
      const initialResources = [{ metadata: { name: 'existing' } }] as any;
      mockResourceService.list.mockReturnValue(
        of({ items: initialResources, resourceVersion: '1' }),
      );

      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = makeContext();
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();

      subscriptionSubject.next(undefined);

      expect(newComponent.resources()).toEqual(initialResources);
    });

    it('should unsubscribe from subscription on cleanup', () => {
      const subscription = { unsubscribe: vi.fn() } as any;
      const subscriptionSubject: MockedObject<
        Subject<ResourceSubscriptionResult | undefined>
      > = mock();
      subscriptionSubject.subscribe.mockReturnValue(subscription);
      mockResourceService.resourceChangeSubscription.mockReturnValue(
        subscriptionSubject,
      );

      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = makeContext();
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();

      newComponent.resourceVersion.set('new-version');
      newFixture.detectChanges();

      expect(subscription.unsubscribe).toHaveBeenCalled();
    });

    describe('List method', () => {
      it('should not call list twice if already loading', () => {
        const listSpy = vi
          .fn()
          .mockReturnValueOnce(of({ items: [], resourceVersion: '123' }));
        mockResourceService.list = listSpy;
        component.loading.set(true);
        component.list();
        expect(listSpy).not.toHaveBeenCalled();
      });

      it('should set hasMore to false when continue token is not present', () => {
        mockResourceService.list.mockReturnValue(
          of({
            items: [{ metadata: { name: 'test' } }],
            resourceVersion: '123',
            continue: undefined,
            remainingItemCount: 0,
          }),
        );

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makeContext();
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();

        expect(newComponent.hasMore()).toBe(false);
      });

      it('should set hasMore to true when continue token is present', () => {
        mockResourceService.list.mockReturnValue(
          of({
            items: [{ metadata: { name: 'test' } }],
            resourceVersion: '123',
            continue: 'next-token',
            remainingItemCount: 5,
          }),
        );

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makeContext();
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();

        expect(newComponent.hasMore()).toBe(true);
        expect((newComponent as any).currentContinueToken).toBe('next-token');
      });

      it('should merge existing resources with new ones from list', () => {
        const firstResponse = {
          items: [
            { id: 'res1', metadata: { name: 'res1' }, spec: { version: 'v1' } },
          ],
          resourceVersion: '123',
          continue: 'token1',
        };
        const secondResponse = {
          items: [
            { id: 'res1', metadata: { name: 'res1' }, spec: { version: 'v2' } },
            { id: 'res2', metadata: { name: 'res2' }, spec: { version: 'v1' } },
          ],
          resourceVersion: '124',
        };

        let callCount = 0;
        mockResourceService.list.mockImplementation(() => {
          callCount++;
          return of(callCount === 1 ? firstResponse : secondResponse);
        });

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makeContext();
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();

        expect(newComponent.resources().length).toBe(1);

        newComponent.list();

        expect(newComponent.resources().length).toBe(2);
        const res1 = newComponent
          .resources()
          .find((r) => r.metadata.name === 'res1');
        expect(res1?.spec?.version).toBe('v2');
      });

      it('should handle error and call error handler service', () => {
        const error = new Error('Forbidden');
        mockResourceService.list.mockReturnValue(throwError(() => error));
        mockErrorHandlerService.redirectToErrorPage.mockReturnValue(true);

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makeContext();
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();

        expect(
          mockErrorHandlerService.redirectToErrorPage,
        ).toHaveBeenCalledWith(error);
        expect((newComponent as any).listError()).toBeNull();
      });

      it('should set remainingItemCount to 0 when not provided in response', () => {
        mockResourceService.list.mockReturnValue(
          of({
            items: [{ metadata: { name: 'test' } }],
            resourceVersion: '123',
          }),
        );

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makeContext();
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();

        expect(newComponent.remainingItemCount()).toBe(0);
      });

      it('should show alert and throw when resourceDefinition is undefined', () => {
        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = signal({
          resourceDefinition: undefined,
        }) as any;

        const showAlertSpy = vi.fn();
        newComponent.LuigiClient = (() => ({
          linkManager: () => ({ navigate: vi.fn() }),
          uxManager: () => ({ showAlert: showAlertSpy }),
        })) as any;

        expect(() => newComponent.list()).toThrow(
          'Resource definition is not defined',
        );
        expect(showAlertSpy).toHaveBeenCalledWith({
          text: 'Resource definition is not defined',
          type: 'error',
        });
      });
    });

    describe('Request recovery', () => {
      const row = (name: string) => ({ id: name, metadata: { name } }) as any;

      function createReactiveTable(showAlert = vi.fn()) {
        mockResourceService.list.mockClear();
        mockResourceService.resourceChangeSubscription.mockClear();
        const table = TestBed.createComponent(ResourceTableCard);
        const context = {
          ...makeContext()(),
          kcpPath: 'root:orgs:example:first',
        };
        table.componentRef.setInput('context', context);
        table.componentRef.setInput('LuigiClient', {
          ...makeLuigiClient()(),
          uxManager: () => ({ showAlert }),
        });
        table.detectChanges();
        return { table, context, card: table.componentInstance };
      }

      it('shows a retryable initial failure and replaces rows with the successful retry', () => {
        const initial = new Subject<ResourceListResult>();
        const retry = new Subject<ResourceListResult>();
        mockResourceService.list
          .mockReturnValueOnce(initial)
          .mockReturnValueOnce(retry);
        const { card } = createReactiveTable();

        expect(card.loading()).toBe(true);
        expect((card as any).listError()).toBeNull();
        initial.error(new Error('Gateway unavailable'));
        expect(card.loading()).toBe(false);
        expect((card as any).listError()).not.toBeNull();
        expect(mockErrorHandlerService.handleError).not.toHaveBeenCalled();

        card.resources.set([row('stale')]);
        card.retryList();
        card.retryList();
        expect(mockResourceService.list).toHaveBeenCalledTimes(2);
        expect(card.loading()).toBe(true);
        expect((card as any).listError()).toBeNull();
        retry.next({
          items: [row('current')],
          resourceVersion: '2',
          continue: undefined,
        });
        retry.complete();

        expect(card.resources()).toEqual([row('current')]);
        expect(card.loading()).toBe(false);
        card.retryList();
        expect(mockResourceService.list).toHaveBeenCalledTimes(2);
      });

      it('retries a failed load-more request with the same token and keeps existing rows', () => {
        mockResourceService.list
          .mockReturnValueOnce(
            of({
              items: [row('first')],
              resourceVersion: '1',
              continue: 'next-page',
            }),
          )
          .mockReturnValueOnce(
            throwError(() => new Error('Gateway unavailable')),
          )
          .mockReturnValueOnce(
            of({ items: [row('second')], resourceVersion: '2' }),
          );
        const { card } = createReactiveTable();

        card.loadMore();
        expect((card as any).listError()).not.toBeNull();
        expect(card.resources()).toEqual([row('first')]);
        card.retryList();

        expect(mockResourceService.list).toHaveBeenCalledTimes(3);
        for (const call of mockResourceService.list.mock.calls.slice(1)) {
          expect(call[3]).toEqual({
            pagination: { continue: 'next-page', limit: 5 },
          });
        }
        expect(card.resources()).toEqual([row('first'), row('second')]);
        expect((card as any).listError()).toBeNull();
        expect(card.hasMore()).toBe(false);
      });

      it('cancels an initial read when context changes and ignores its late result', () => {
        const oldRead = new Subject<ResourceListResult>();
        const currentRead = new Subject<ResourceListResult>();
        mockResourceService.list
          .mockReturnValueOnce(oldRead)
          .mockReturnValueOnce(currentRead);
        const { table, card, context } = createReactiveTable();
        const currentContext = {
          ...context,
          kcpPath: 'root:orgs:example:second',
        };

        table.componentRef.setInput('context', currentContext);
        oldRead.next({
          items: [row('wrong-workspace')],
          resourceVersion: 'old',
          continue: undefined,
        });
        expect(card.resources()).toEqual([]);
        table.detectChanges();

        expect(oldRead.observed).toBe(false);
        expect(currentRead.observed).toBe(true);
        expect(mockResourceService.list.mock.calls.at(-1)?.slice(2)).toEqual([
          currentContext,
          { pagination: { continue: undefined, limit: 5 } },
        ]);
        oldRead.error(new Error('Forbidden'));
        expect(
          mockErrorHandlerService.redirectToErrorPage,
        ).not.toHaveBeenCalled();
        expect(card.loading()).toBe(true);
        expect((card as any).listError()).toBeNull();
        currentRead.next({
          items: [row('current')],
          resourceVersion: '2',
          continue: undefined,
        });
        currentRead.complete();
        expect(card.resources()).toEqual([row('current')]);
        expect(card.loading()).toBe(false);
      });

      it('clears a failed page and its watch when switching contexts before retry', () => {
        const oldWatch = new Subject<ResourceSubscriptionResult | undefined>();
        const currentRead = new Subject<ResourceListResult>();
        mockResourceService.resourceChangeSubscription.mockReturnValue(
          oldWatch,
        );
        mockResourceService.list
          .mockReturnValueOnce(
            of({
              items: [row('old')],
              resourceVersion: '1',
              continue: 'old-page',
              remainingItemCount: 3,
            }),
          )
          .mockReturnValueOnce(
            throwError(() => new Error('Gateway unavailable')),
          )
          .mockReturnValueOnce(currentRead);
        const { table, card, context } = createReactiveTable();
        card.loadMore();
        expect((card as any).listError()).not.toBeNull();

        table.componentRef.setInput('context', {
          ...context,
          kcpPath: 'root:orgs:example:second',
        });
        oldWatch.next({ type: 'ADDED', object: row('late-old') });
        expect(card.resources()).toEqual([row('old')]);
        table.detectChanges();

        expect(oldWatch.observed).toBe(false);
        expect(card.resources()).toEqual([]);
        expect(card.resourceVersion()).toBeUndefined();
        expect(card.remainingItemCount()).toBe(0);
        expect(card.hasMore()).toBe(false);
        expect((card as any).listError()).toBeNull();
        card.retryList();
        expect(mockResourceService.list).toHaveBeenCalledTimes(3);
        expect(mockResourceService.list.mock.calls.at(-1)?.[3]).toEqual({
          pagination: { continue: undefined, limit: 5 },
        });
      });

      it.each(['list', 'watch'])(
        'ignores a stale %s error before context cleanup runs',
        (source) => {
          const oldRequest = new Subject<any>();
          const currentRead = new Subject<ResourceListResult>();
          mockResourceService.list
            .mockReturnValueOnce(
              source === 'list'
                ? oldRequest
                : of({ items: [row('old')], resourceVersion: '1' }),
            )
            .mockReturnValueOnce(currentRead);
          mockResourceService.resourceChangeSubscription.mockReturnValue(
            oldRequest,
          );
          mockErrorHandlerService.redirectToErrorPage.mockReturnValue(true);
          const showAlert = vi.fn();
          const { table, card, context } = createReactiveTable(showAlert);

          table.componentRef.setInput('context', {
            ...context,
            kcpPath: 'root:orgs:example:second',
          });
          oldRequest.error(new Error('Forbidden'));
          expect(
            mockErrorHandlerService.redirectToErrorPage,
          ).not.toHaveBeenCalled();
          expect(showAlert).not.toHaveBeenCalled();
          expect((card as any).listError()).toBeNull();

          table.detectChanges();
          expect(currentRead.observed).toBe(true);
          expect(card.loading()).toBe(true);
        },
      );

      it('recovers a failed watch by replacing the first page and restarting the same resource version', () => {
        const oldWatch = new Subject<ResourceSubscriptionResult | undefined>();
        const currentWatch = new Subject<
          ResourceSubscriptionResult | undefined
        >();
        const nextPage = new Subject<ResourceListResult>();
        const refresh = new Subject<ResourceListResult>();
        mockResourceService.resourceChangeSubscription
          .mockReturnValueOnce(oldWatch)
          .mockReturnValueOnce(currentWatch);
        mockResourceService.list
          .mockReturnValueOnce(
            of({
              items: [row('first')],
              resourceVersion: '1',
              continue: 'next-page',
            }),
          )
          .mockReturnValueOnce(nextPage)
          .mockReturnValueOnce(refresh);
        const { table, card } = createReactiveTable();
        card.loadMore();
        oldWatch.error(new Error('Watch disconnected'));
        expect((card as any).watchError()).not.toBeNull();
        card.retryList();
        expect(mockResourceService.list).toHaveBeenCalledTimes(2);
        expect((card as any).watchError()).not.toBeNull();

        nextPage.next({
          items: [row('second')],
          resourceVersion: '1',
          continue: 'third-page',
        });
        nextPage.complete();
        table.detectChanges();
        expect(card.resources()).toEqual([row('first'), row('second')]);
        card.retryList();
        card.retryList();
        expect(mockResourceService.list).toHaveBeenCalledTimes(3);
        expect(mockResourceService.list.mock.calls.at(-1)?.[3]).toEqual({
          pagination: { continue: undefined, limit: 5 },
        });
        expect((card as any).watchError()).toBeNull();
        expect(card.loading()).toBe(true);

        refresh.next({
          items: [row('current')],
          resourceVersion: '1',
          continue: undefined,
        });
        refresh.complete();
        table.detectChanges();
        expect(card.resources()).toEqual([row('current')]);
        expect(currentWatch.observed).toBe(true);
        expect(
          mockResourceService.resourceChangeSubscription,
        ).toHaveBeenCalledTimes(2);
        expect(card.hasMore()).toBe(false);
        expect(card.loading()).toBe(false);
        expect(mockErrorHandlerService.handleError).not.toHaveBeenCalled();
      });

      it('preserves authorization handling when the watch is forbidden', () => {
        const watch = new Subject<ResourceSubscriptionResult | undefined>();
        mockResourceService.list.mockReturnValueOnce(
          of({ items: [], resourceVersion: '1' }),
        );
        mockResourceService.resourceChangeSubscription.mockReturnValueOnce(
          watch,
        );
        mockErrorHandlerService.redirectToErrorPage.mockReturnValue(true);
        const { card } = createReactiveTable();
        const error = new Error('Forbidden');
        watch.error(error);

        expect(
          mockErrorHandlerService.redirectToErrorPage,
        ).toHaveBeenCalledWith(error);
        expect((card as any).watchError()).toBeNull();
        expect((card as any).listError()).toBeNull();
        card.retryList();
        expect(mockResourceService.list).toHaveBeenCalledTimes(1);
      });

      it('cancels the active retry when the component is destroyed', () => {
        const retry = new Subject<ResourceListResult>();
        mockResourceService.list
          .mockReturnValueOnce(
            throwError(() => new Error('Gateway unavailable')),
          )
          .mockReturnValueOnce(retry);
        const { table, card } = createReactiveTable();
        card.retryList();
        expect(retry.observed).toBe(true);

        table.destroy();
        expect(retry.observed).toBe(false);
        expect(card.loading()).toBe(false);
      });
    });

    describe('Computed properties', () => {
      it('should compute columns correctly', () => {
        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makeContext({
          ui: {
            listView: {
              fields: [
                { property: 'metadata.name' },
                { property: 'spec.version' },
              ],
            },
          },
        });
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();
        expect(newComponent.columns().length).toBe(2);
      });
    });
  });

  describe('Permissions', () => {
    it('should include createResourceFormConfig when canCreate=true (no permissionsDefinition)', () => {
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          ui: {
            createView: { fields: [{ property: 'metadata.name' }] },
            listView: { fields: [] },
          },
          // no permissionsDefinition — canCreate defaults to true
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      expect(newComponent.config().createResourceFormConfig).toBeDefined();
    });

    it('should omit createResourceFormConfig when portalPermissions does not include create', () => {
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        portalPermissions: { clusters: ['get'] }, // no 'create'
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          permissionsDefinition: {
            group: 'core.k8s.io',
            resource: 'clusters',
            entityActions: ['get', 'delete'],
            resourceActions: ['create'],
            entityContextKey: 'entityName',
          },
          ui: {
            createView: { fields: [{ property: 'metadata.name' }] },
            listView: { fields: [] },
          },
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      expect(newComponent.config().createResourceFormConfig).toBeUndefined();
    });

    it('should include createResourceFormConfig when portalPermissions includes create', () => {
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        portalPermissions: { clusters: ['get', 'create'] },
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          permissionsDefinition: {
            group: 'core.k8s.io',
            resource: 'clusters',
            entityActions: ['get', 'delete'],
            resourceActions: ['create'],
            entityContextKey: 'entityName',
          },
          ui: {
            createView: { fields: [{ property: 'metadata.name' }] },
            listView: { fields: [] },
          },
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      expect(newComponent.config().createResourceFormConfig).toBeDefined();
    });

    it('should generate tableResources id using permissionsDefinition.resource via permissionKey', () => {
      mockResourceService.list.mockReturnValue(
        of({
          items: [{ metadata: { name: 'c1', namespace: 'ns1' } }],
          resourceVersion: '1',
        }),
      );
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          scope: 'Namespaced',
          permissionsDefinition: {
            group: 'core.k8s.io',
            resource: 'clusters',
            entityActions: ['get'],
            resourceActions: [],
            entityContextKey: 'entityName',
          },
          ui: { listView: { fields: [] } },
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      // permissionKey({ resource: 'clusters', namespace: 'ns1', name: 'c1' }) = 'clusters/ns1/c1'
      expect(newComponent.tableResources()[0].id).toBe('clusters/ns1/c1');
    });

    it('should generate tableResources id without resource prefix when no permissionsDefinition', () => {
      mockResourceService.list.mockReturnValue(
        of({
          items: [{ metadata: { name: 'c1' } }],
          resourceVersion: '1',
        }),
      );
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          ui: { listView: { fields: [] } },
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      // permissionKey({ resource: undefined, name: 'c1' }) = 'c1'
      expect(newComponent.tableResources()[0].id).toBe('c1');
    });

    it('should NOT call instancePermissionsService.checkInstances when permissionsDefinition is absent', () => {
      mockResourceService.list.mockReturnValue(
        of({ items: [{ metadata: { name: 'c1' } }], resourceVersion: '1' }),
      );
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          ui: { listView: { fields: [] } },
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      expect(
        mockInstancePermissionsService.checkInstances,
      ).not.toHaveBeenCalled();
    });

    it('should NOT call instancePermissionsService.checkInstances when entityActions is empty', () => {
      mockResourceService.list.mockReturnValue(
        of({ items: [{ metadata: { name: 'c1' } }], resourceVersion: '1' }),
      );
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          permissionsDefinition: {
            group: 'core.k8s.io',
            resource: 'clusters',
            entityActions: [],
            resourceActions: [],
            entityContextKey: 'entityName',
          },
          ui: { listView: { fields: [] } },
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      expect(
        mockInstancePermissionsService.checkInstances,
      ).not.toHaveBeenCalled();
    });

    it('should call instancePermissionsService.checkInstances with correct args when entityActions are set', () => {
      const pd = {
        group: 'core.k8s.io',
        resource: 'clusters',
        entityActions: ['get', 'delete'],
        resourceActions: [],
        entityContextKey: 'entityName',
      };
      mockResourceService.list.mockReturnValue(
        of({ items: [{ metadata: { name: 'c1' } }], resourceVersion: '1' }),
      );
      const newFixture = TestBed.createComponent(ResourceTableCard);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        organization: 'my-org',
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          version: 'v1alpha1',
          permissionsDefinition: pd,
          ui: { listView: { fields: [] } },
        },
      }) as any;
      newComponent.LuigiClient = makeLuigiClient();
      newFixture.detectChanges();
      expect(
        mockInstancePermissionsService.checkInstances,
      ).toHaveBeenCalledWith(
        expect.any(Object),
        pd,
        expect.arrayContaining([expect.objectContaining({ name: 'c1' })]),
      );
    });

    describe('list() guard (canDo("list"))', () => {
      const makePermissionedContext = (
        perms: Record<string, string[]> | undefined,
      ) =>
        signal({
          portalPermissions: perms,
          resourceDefinition: {
            entityCollection: 'clusters',
            entity: 'Cluster',
            apiGroup: 'core_k8s_io',
            version: 'v1alpha1',
            permissionsDefinition: {
              group: 'core.k8s.io',
              resource: 'clusters',
              entityActions: [],
              resourceActions: ['list'],
              entityContextKey: 'entityName',
            },
            ui: { listView: { fields: [] } },
          },
        }) as any;

      it('does NOT call resourceService.list when portalPermissions has the resource entry without "list"', () => {
        mockResourceService.list.mockClear();
        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makePermissionedContext({ clusters: ['get'] });
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();
        expect(mockResourceService.list).not.toHaveBeenCalled();
      });

      it('keeps loading false when list() is blocked by missing "list" permission', () => {
        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makePermissionedContext({ clusters: ['get'] });
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();
        // Calling list() directly should still be a no-op
        newComponent.list();
        expect(newComponent.loading()).toBe(false);
      });

      it('calls resourceService.list when "list" verb is present in portalPermissions', () => {
        mockResourceService.list.mockClear();
        mockResourceService.list.mockReturnValue(
          of({ items: [], resourceVersion: '1' }),
        );
        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makePermissionedContext({
          clusters: ['list', 'get'],
        });
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();
        expect(mockResourceService.list).toHaveBeenCalled();
      });

      it('calls resourceService.list when portalPermissions has no entry for the resource (fail-open)', () => {
        mockResourceService.list.mockClear();
        mockResourceService.list.mockReturnValue(
          of({ items: [], resourceVersion: '1' }),
        );
        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        // No entry for 'clusters' → fail-open → list proceeds
        newComponent.context = makePermissionedContext({ other: ['get'] });
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();
        expect(mockResourceService.list).toHaveBeenCalled();
      });

      it('calls resourceService.list when portalPermissions is undefined (fail-open)', () => {
        mockResourceService.list.mockClear();
        mockResourceService.list.mockReturnValue(
          of({ items: [], resourceVersion: '1' }),
        );
        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makePermissionedContext(undefined);
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();
        expect(mockResourceService.list).toHaveBeenCalled();
      });
    });

    describe('watch effect guard (canDo("watch"))', () => {
      const makeWatchContext = (perms: Record<string, string[]> | undefined) =>
        signal({
          portalPermissions: perms,
          resourceDefinition: {
            entityCollection: 'clusters',
            entity: 'Cluster',
            apiGroup: 'core_k8s_io',
            version: 'v1alpha1',
            permissionsDefinition: {
              group: 'core.k8s.io',
              resource: 'clusters',
              entityActions: [],
              resourceActions: ['list', 'watch'],
              entityContextKey: 'entityName',
            },
            ui: { listView: { fields: [] } },
          },
        }) as any;

      it('does NOT open a watch subscription when portalPermissions lacks "watch" for the resource', () => {
        mockResourceService.list.mockReturnValue(
          of({ items: [], resourceVersion: 'v1' }),
        );
        mockResourceService.resourceChangeSubscription.mockClear();

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makeWatchContext({ clusters: ['list'] }); // 'watch' absent
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();

        // resourceVersion is now set ('v1') but the watch effect should have bailed out
        expect(newComponent.resourceVersion()).toBe('v1');
        expect(
          mockResourceService.resourceChangeSubscription,
        ).not.toHaveBeenCalled();
      });

      it('opens the watch subscription when "watch" is present in portalPermissions', () => {
        mockResourceService.list.mockReturnValue(
          of({ items: [], resourceVersion: 'v1' }),
        );
        mockResourceService.resourceChangeSubscription.mockReturnValue(
          of(undefined),
        );

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makeWatchContext({
          clusters: ['list', 'watch'],
        });
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();

        expect(
          mockResourceService.resourceChangeSubscription,
        ).toHaveBeenCalled();
      });

      it('opens the watch subscription when portalPermissions has no entry for the resource (fail-open)', () => {
        mockResourceService.list.mockReturnValue(
          of({ items: [], resourceVersion: 'v1' }),
        );
        mockResourceService.resourceChangeSubscription.mockReturnValue(
          of(undefined),
        );

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makeWatchContext({ other: ['get'] }); // no 'clusters' entry
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();

        expect(
          mockResourceService.resourceChangeSubscription,
        ).toHaveBeenCalled();
      });

      it('opens the watch subscription when portalPermissions is undefined (fail-open)', () => {
        mockResourceService.list.mockReturnValue(
          of({ items: [], resourceVersion: 'v1' }),
        );
        mockResourceService.resourceChangeSubscription.mockReturnValue(
          of(undefined),
        );

        const newFixture = TestBed.createComponent(ResourceTableCard);
        const newComponent = newFixture.componentInstance;
        newComponent.context = makeWatchContext(undefined);
        newComponent.LuigiClient = makeLuigiClient();
        newFixture.detectChanges();

        expect(
          mockResourceService.resourceChangeSubscription,
        ).toHaveBeenCalled();
      });
    });
  });
});
