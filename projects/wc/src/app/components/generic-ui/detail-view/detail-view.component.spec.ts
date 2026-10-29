import { DetailView } from './detail-view.component';
import { NgTemplateOutlet } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EnvConfigService, LuigiCoreService } from '@openmfp/portal-ui-lib';
import { AccountInfo } from '@platform-mesh/portal-ui-lib/models/models';
import {
  AccountInfoService,
  ErrorHandlerService,
  GatewayService,
  KubeconfigSecretService,
  NamespaceService,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import { EMPTY, Subject, of, throwError } from 'rxjs';
import { MockedObject } from 'vitest';
import { mock } from 'vitest-mock-extended';

describe('DetailViewComponent', () => {
  let component: DetailView;
  let fixture: ComponentFixture<DetailView>;
  let mockResourceService: any;
  let mockGatewayService: any;
  let envConfigServiceMock: MockedObject<EnvConfigService>;
  let accountInfoServiceMock: MockedObject<AccountInfoService>;
  let kubeconfigSecretServiceMock: {
    secretReferenceQueryFields: ReturnType<typeof vi.fn>;
    isSecretReferenceAvailable: ReturnType<typeof vi.fn>;
    readKubeconfig: ReturnType<typeof vi.fn>;
  };
  let luigiClientLinkManagerNavigate = vi.fn();
  let errorHandlerServiceMock: MockedObject<ErrorHandlerService>;
  const secretAction = {
    uiSettings: {
      displayAs: 'button',
      buttonSettings: {
        action: 'download-kubeconfig-from-secret-ref',
        text: 'Download cluster access',
        icon: 'download-from-cloud',
        design: 'Emphasized',
        resourceProperty: 'status.kubeconfig.secretRef.name',
        dataKey: 'config',
        filename: 'cluster.yaml',
        namespaceProperty: 'status.kubeconfig.secretRef.namespace',
      },
    },
  } as const;

  beforeEach(() => {
    envConfigServiceMock = mock();
    accountInfoServiceMock = mock();
    kubeconfigSecretServiceMock = {
      secretReferenceQueryFields: vi.fn((buttonSettings) =>
        buttonSettings?.action === 'download-kubeconfig-from-secret-ref'
          ? [
              {
                property: buttonSettings.resourceProperty,
              },
              ...(buttonSettings.namespaceProperty
                ? [
                    {
                      property: buttonSettings.namespaceProperty,
                    },
                  ]
                : []),
            ]
          : [],
      ),
      isSecretReferenceAvailable: vi.fn().mockReturnValue(true),
      readKubeconfig: vi
        .fn()
        .mockReturnValue(
          of({ contents: 'apiVersion: v1', filename: 'kubeconfig.yaml' }),
        ),
    };

    const accountInfo: AccountInfo = {
      metadata: {
        annotations: {
          'kcp.io/cluster': 'ly4pjqo89u2llqcg',
        },
        name: 'account',
      },
      spec: {
        account: {
          originClusterId: 'originClusterId',
        },
        clusterInfo: {
          ca: 'ca',
        },
        oidc: {
          clients: {
            kubectl: { clientId: 'f1aefb48-bc47-41ca-8e92-e11bf1fc37ec' },
          },
          issuerUrl: 'https://portal.local/keycloak/realms/sub',
        },
        organization: {
          originClusterId: 'mwi4ti5r3vtng851',
          name: 'org',
        },
      },
    };
    accountInfoServiceMock.read.mockReturnValue(of(accountInfo));

    mockResourceService = {
      read: vi.fn().mockReturnValue(of({ name: 'test-resource' })),
      readAccountInfo: vi.fn().mockReturnValue(of('mock-ca-data')),
      delete: vi.fn().mockReturnValue(of({})),
      update: vi.fn().mockReturnValue(of({})),
      getNamespace: vi.fn((context) => context.namespaceId),
    };

    mockGatewayService = {
      resolveKcpPath: vi.fn().mockReturnValue('https://example.com'),
    };
    errorHandlerServiceMock = mock();

    TestBed.configureTestingModule({
      providers: [
        { provide: ResourceService, useValue: mockResourceService },
        { provide: AccountInfoService, useValue: accountInfoServiceMock },
        { provide: GatewayService, useValue: mockGatewayService },
        {
          provide: KubeconfigSecretService,
          useValue: kubeconfigSecretServiceMock,
        },
        { provide: EnvConfigService, useValue: envConfigServiceMock },
        { provide: ErrorHandlerService, useValue: errorHandlerServiceMock },
      ],
    }).overrideComponent(DetailView, {
      set: { template: '<div></div>' },
    });

    fixture = TestBed.createComponent(DetailView);
    component = fixture.componentInstance;

    component.context = signal({
      resourceId: 'cluster-1',
      token: 'abc123',
      accountPath: 'account-123',
      accountId: 'account-123',
      organization: 'org-123',
      kcpCA: 'kcp-ca-data',
      resourceDefinition: {
        version: 'v1alpha1',
        entity: 'Cluster',
        entityCollection: 'clusters',
        apiGroup: 'core_k8s_io',
        ui: {
          detailView: {
            fields: [],
          },
        },
      },
      portalContext: { kcpWorkspaceUrl: 'https://example.com' },
      entityName: 'test-resource',
      parentNavigationContexts: ['project'],
    }) as any;

    component.LuigiClient = (() => ({
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: luigiClientLinkManagerNavigate,
        withParams: vi.fn().mockReturnThis(),
      }),
      uxManager: () => ({
        showAlert: vi.fn(),
      }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
    })) as any;

    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (global as any).URL.createObjectURL;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should resolve workspace path with gateway service', () => {
    expect(component.workspacePath()).toBe('https://example.com');
    expect(mockGatewayService.resolveKcpPath).toHaveBeenCalledWith(
      component.context(),
    );
  });

  it('should call read on init', () => {
    expect(mockResourceService.read).toHaveBeenCalled();
  });

  it('should compute showDownloadKubeconfig as false by default', () => {
    expect(component.showDownloadKubeconfig()).toBe(false);
  });

  it('should compute showDownloadKubeconfig as true when enabled in definition', () => {
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;

    newComponent.context = signal({
      resourceId: 'cluster-1',
      token: 'abc123',
      accountPath: 'account-123',
      accountId: 'account-123',
      organization: 'org-123',
      kcpCA: 'kcp-ca-data',
      resourceDefinition: {
        version: 'v1alpha1',
        entity: 'Cluster',
        entityCollection: 'clusters',
        apiGroup: 'core_k8s_io',
        ui: {
          detailView: {
            fields: [],
            showDownloadKubeconfig: true,
          },
        },
      },
      portalContext: { kcpWorkspaceUrl: 'https://example.com' },
      entityName: 'test-resource',
      parentNavigationContexts: ['project'],
    }) as any;

    newComponent.LuigiClient = (() => ({
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
        withParams: vi.fn().mockReturnThis(),
      }),
      uxManager: () => ({
        showAlert: vi.fn(),
      }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
    })) as any;

    newFixture.detectChanges();

    expect(newComponent.showDownloadKubeconfig()).toBe(true);
  });

  it('should compute showDownloadKubeconfig as false when detailView is missing', () => {
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;

    newComponent.context = signal({
      entityName: 'cluster-1',
      resourceId: 'cluster-1',
      token: 'abc123',
      resourceDefinition: {
        version: 'v1alpha1',
        entity: 'Cluster',
        entityCollection: 'clusters',
        apiGroup: 'core_k8s_io',
      },
      entity: {
        metadata: { name: 'test-resource' },
      },
      parentNavigationContexts: ['project'],
    }) as any;

    newComponent.LuigiClient = (() => ({
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
        withParams: vi.fn().mockReturnThis(),
      }),
      uxManager: () => ({
        showAlert: vi.fn(),
      }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
    })) as any;

    newFixture.detectChanges();

    expect(newComponent.showDownloadKubeconfig()).toBe(false);
  });

  it('should navigate to parent', () => {
    component.navigateToParent();
    expect(luigiClientLinkManagerNavigate).toHaveBeenCalledWith('/');
  });

  it('should navigate to first parent navigation context', () => {
    const fromContextSpy = vi.fn().mockReturnThis();
    const navigateSpy = vi.fn();

    component.LuigiClient = (() => ({
      linkManager: () => ({
        fromContext: fromContextSpy,
        navigate: navigateSpy,
        withParams: vi.fn().mockReturnThis(),
      }),
      uxManager: () => ({
        showAlert: vi.fn(),
      }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
    })) as any;

    component.context = signal({
      resourceId: 'cluster-1',
      token: 'abc123',
      accountPath: 'account-123',
      accountId: 'account-123',
      organization: 'org-123',
      kcpCA: 'kcp-ca-data',
      resourceDefinition: {
        version: 'v1alpha1',
        entity: 'Cluster',
        entityCollection: 'clusters',
        apiGroup: 'core_k8s_io',
        ui: {
          detailView: {
            fields: [],
          },
        },
      },
      portalContext: { kcpWorkspaceUrl: 'https://example.com' },
      entityName: 'test-resource',
      parentNavigationContexts: ['organizations', 'projects'],
    }) as any;

    component.navigateToParent();

    expect(fromContextSpy).toHaveBeenCalledWith('organizations');
    expect(navigateSpy).toHaveBeenCalledWith('/');
  });

  describe('Modal operations', () => {
    it('should set deleteDialogOpen when openDeleteResourceModal is called', () => {
      const event = new MouseEvent('click');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      component.openDeleteResourceModal(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
      expect((component as any).deleteDialogOpen()).toBe(true);
    });

    it('should refetch the resource with createView fields and open the edit modal', () => {
      const mockCreateModal = {
        open: vi.fn(),
      };
      (component as any).createModal = () => mockCreateModal;

      const fetchedResource = {
        metadata: { name: 'test-resource' },
        spec: { createOnlyField: 'current-value' },
      };
      mockResourceService.read.mockClear();
      mockResourceService.read.mockReturnValue(of(fetchedResource));

      const event = new MouseEvent('click');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      component.openEditResourceModal(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(mockResourceService.read).toHaveBeenCalled();
      expect(mockCreateModal.open).toHaveBeenCalledWith(fetchedResource);
    });

    it('should omit write-only fields from the edit refetch GraphQL selection', () => {
      const mockCreateModal = { open: vi.fn() };
      (component as any).createModal = () => mockCreateModal;

      const localFixture = TestBed.createComponent(DetailView);
      const localComponent = localFixture.componentInstance;
      localComponent.context = (() => ({
        ...component.context(),
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'IdPRegistration',
          entityCollection: 'idpregistrations',
          apiGroup: 'core_platform_mesh_io',
          ui: {
            detailView: { fields: [] },
            createView: {
              fields: [
                { property: 'spec.oidc.clientId', label: 'Client ID' },
                {
                  property: 'spec.oidc.clientSecret',
                  label: 'Client secret',
                  writeOnly: true,
                },
              ],
            },
          },
        },
      })) as any;
      localComponent.LuigiClient = component.LuigiClient;
      localFixture.detectChanges();

      mockResourceService.read.mockClear();
      mockResourceService.read.mockReturnValue(
        of({ metadata: { name: 'dex' }, spec: { oidc: { clientId: 'id' } } }),
      );

      localComponent.openEditResourceModal(new MouseEvent('click'));

      expect(mockResourceService.read).toHaveBeenCalled();
      const fields = JSON.stringify(mockResourceService.read.mock.calls[0][2]);
      expect(fields).toContain('clientId');
      expect(fields).not.toContain('clientSecret');
    });

    it('should delete resource successfully', () => {
      mockResourceService.delete = vi.fn().mockReturnValue(of({}));

      const resource: any = {
        metadata: { name: 'test-resource' },
      };

      component.delete(resource);

      expect(mockResourceService.delete).toHaveBeenCalledWith(
        {
          ...resource,
          metadata: { name: 'cluster-1' },
        },
        expect.any(Object),
        expect.any(Object),
        false,
      );
    });

    it('should set deleteDialogOpen to false and navigate to parent after successful delete', () => {
      mockResourceService.delete = vi.fn().mockReturnValue(of({}));
      const navigateSpy = vi.spyOn(component, 'navigateToParent');
      (component as any).deleteDialogOpen.set(true);

      const resource: any = {
        metadata: { name: 'test-resource' },
      };

      component.delete(resource);

      expect((component as any).deleteDialogOpen()).toBe(false);
      expect(navigateSpy).toHaveBeenCalled();
    });

    it('should handle delete error', () => {
      const error = new Error('Delete failed');
      mockResourceService.delete = vi
        .fn()
        .mockReturnValue(throwError(() => error));

      const resource: any = {
        metadata: { name: 'test-resource' },
      };

      component.delete(resource);

      expect(errorHandlerServiceMock.handleError).toHaveBeenCalledWith(
        error,
        'Failure! Could not delete resource: test-resource.',
      );
    });

    it('should delete account resource with account flag', () => {
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      newComponent.context = signal({
        resourceId: 'account-1',
        token: 'abc123',
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'Account',
          entityCollection: 'accounts',
          apiGroup: 'core_k8s_io',
          ui: {
            detailView: {
              fields: [],
            },
          },
        },
        entityName: 'account-1',
        parentNavigationContexts: ['project'],
      }) as any;

      newComponent.LuigiClient = component.LuigiClient;
      mockResourceService.delete = vi.fn().mockReturnValue(of({}));

      newFixture.detectChanges();

      const resource: any = {
        metadata: { name: 'account-1' },
      };

      newComponent.delete(resource);

      expect(mockResourceService.delete).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        true,
      );
    });

    it('should update resource successfully', () => {
      const mockCreateModal = {
        close: vi.fn(),
      };
      (component as any).createModal = () => mockCreateModal;
      const updatedResource = { metadata: { name: 'cluster-1' }, spec: {} };
      mockResourceService.update = vi.fn().mockReturnValue(of(updatedResource));

      const resource: any = {
        metadata: { name: 'test-resource' },
      };

      component.update(resource);

      expect(mockResourceService.update).toHaveBeenCalled();
      expect(component.resource()).toEqual(updatedResource);
      expect(mockCreateModal.close).toHaveBeenCalled();
    });

    it('should omit write-only fields from the update mutation return selection', () => {
      const mockCreateModal = { close: vi.fn() };
      const updateSpy = vi
        .fn()
        .mockReturnValue(of({ metadata: { name: 'dex' } }));
      mockResourceService.update = updateSpy;

      const localFixture = TestBed.createComponent(DetailView);
      const localComponent = localFixture.componentInstance;
      localComponent.context = (() => ({
        ...component.context(),
        resourceId: 'dex',
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'IdPRegistration',
          entityCollection: 'idpregistrations',
          apiGroup: 'core_platform_mesh_io',
          ui: {
            detailView: { fields: [] },
            createView: {
              fields: [
                { property: 'spec.oidc.clientId', label: 'Client ID' },
                {
                  property: 'spec.oidc.clientSecret',
                  label: 'Client secret',
                  writeOnly: true,
                },
              ],
            },
          },
        },
      })) as any;
      localComponent.LuigiClient = component.LuigiClient;
      (localComponent as any).createModal = () => mockCreateModal;
      localFixture.detectChanges();

      localComponent.update({
        metadata: { name: 'dex' },
        spec: { oidc: { clientId: 'id' } },
      } as any);

      expect(updateSpy).toHaveBeenCalled();
      const fields = JSON.stringify(updateSpy.mock.calls[0][4]);
      expect(fields).toContain('clientId');
      expect(fields).not.toContain('clientSecret');
    });

    it('should handle update error', () => {
      const error = new Error('Update failed');
      mockResourceService.update = vi
        .fn()
        .mockReturnValue(throwError(() => error));

      const resource: any = {
        metadata: { name: 'test-resource' },
      };

      component.update(resource);

      expect(errorHandlerServiceMock.handleError).toHaveBeenCalledWith(
        error,
        'Failure! Could not update resource: test-resource.',
      );
    });

    it('should update account resource with account flag', () => {
      const mockCreateModal = {
        close: vi.fn(),
      };
      const updateSpy = vi.fn().mockReturnValue(of({}));
      mockResourceService.update = updateSpy;

      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      newComponent.context = signal({
        resourceId: 'account-1',
        token: 'abc123',
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'Account',
          entityCollection: 'accounts',
          apiGroup: 'core_k8s_io',
          ui: {
            detailView: {
              fields: [{ property: 'spec.name' }],
            },
          },
        },
        entityName: 'account-1',
        parentNavigationContexts: ['project'],
      }) as any;

      newComponent.LuigiClient = component.LuigiClient;
      (newComponent as any).createModal = () => mockCreateModal;

      newFixture.detectChanges();

      const resource: any = {
        metadata: { name: 'account-1' },
      };

      newComponent.update(resource);

      expect(updateSpy).toHaveBeenCalled();
      const callArgs = updateSpy.mock.calls[0];
      expect(callArgs[3]).toBe(true);
      expect(callArgs.length).toBe(5);
    });
  });

  describe('signal-driven delete dialog', () => {
    it('deleteDialogOpen starts as false', () => {
      expect((component as any).deleteDialogOpen()).toBe(false);
    });

    it('openDeleteResourceModal sets deleteDialogOpen to true', () => {
      component.openDeleteResourceModal(new MouseEvent('click'));
      expect((component as any).deleteDialogOpen()).toBe(true);
    });

    it('deleteConfig title is "Delete <name>" (lowercased resourceId)', () => {
      const cfg = (component as any).deleteConfig();
      expect(cfg.title).toBe('Delete cluster-1');
    });

    it('deleteConfig confirmationText is the lowercased resourceId', () => {
      const cfg = (component as any).deleteConfig();
      expect(cfg.confirmationText).toBe('cluster-1');
    });

    it('deleteConfig has expected labels', () => {
      const cfg = (component as any).deleteConfig();
      expect(cfg.confirmLabel).toBe('Delete');
      expect(cfg.cancelLabel).toBe('Cancel');
      expect(cfg.confirmationPlaceholder).toBe('Type name');
    });

    it('deleteConfig message contains the resource entity and name', () => {
      const cfg = (component as any).deleteConfig();
      expect(cfg.message).toContain('cluster-1');
      expect(cfg.message).toContain('Cluster');
    });

    it('deleteConfig message warns the action cannot be undone', () => {
      const cfg = (component as any).deleteConfig();
      expect(cfg.message).toContain('dialog__message--critical');
      expect(cfg.message).toContain('cannot');
    });

    it('delete() success path sets deleteDialogOpen to false', () => {
      mockResourceService.delete = vi.fn().mockReturnValue(of({}));
      (component as any).deleteDialogOpen.set(true);
      component.delete({ metadata: { name: 'r1' } } as any);
      expect((component as any).deleteDialogOpen()).toBe(false);
    });

    it('cancelled path sets deleteDialogOpen to false (simulated via signal)', () => {
      (component as any).deleteDialogOpen.set(true);
      (component as any).deleteDialogOpen.set(false);
      expect((component as any).deleteDialogOpen()).toBe(false);
    });
  });

  describe('getResourceId', () => {
    it('should return resourceId when defined', () => {
      const resourceId = (component as any).getResourceId();
      expect(resourceId).toBe('cluster-1');
    });

    it('should throw error and show alert when resourceId is undefined', () => {
      const showAlertSpy = vi.fn();
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      const mockReadResource = vi.fn();
      (newComponent as any).readResource = mockReadResource;

      newComponent.LuigiClient = (() => ({
        linkManager: () => ({
          fromContext: vi.fn().mockReturnThis(),
          navigate: vi.fn(),
          withParams: vi.fn().mockReturnThis(),
        }),
        uxManager: () => ({
          showAlert: showAlertSpy,
        }),
        getNodeParams: vi.fn(),
        getActiveFeatureToggles: () => [],
      })) as any;

      newComponent.context = signal({
        resourceId: undefined,
        token: 'abc123',
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'Cluster',
          entityCollection: 'clusters',
          apiGroup: 'core_k8s_io',
          ui: {
            detailView: {
              fields: [],
            },
          },
        },
        entityName: 'test-resource',
        parentNavigationContexts: ['project'],
      }) as any;

      newFixture.detectChanges();

      expect(() => {
        (newComponent as any).getResourceId();
      }).toThrow('Resource ID is not defined');

      expect(showAlertSpy).toHaveBeenCalledWith({
        text: 'Resource ID is not defined',
        type: 'error',
      });
    });
  });

  it('should have namespaceId in context when provided', () => {
    const testNamespace = 'test-namespace';
    component.context = signal({
      resourceId: 'cluster-1',
      token: 'abc123',
      namespaceId: testNamespace,
      resourceDefinition: {
        entity: 'Cluster',
        entityCollection: 'clusters',
        apiGroup: 'core_k8s_io',
        ui: {
          detailView: {
            fields: [],
          },
        },
      },
      entityName: 'test-resource',
      parentNavigationContexts: ['project'],
    }) as any;

    fixture.detectChanges();

    expect(component.context().namespaceId).toBe(testNamespace);
  });

  it('should download kubeconfig', async () => {
    const mockAnchorElement = document.createElement('a');
    vi.spyOn(mockAnchorElement, 'click');
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(mockAnchorElement);
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob-url');

    envConfigServiceMock.getEnvConfig.mockResolvedValue({
      oidcIssuerUrl: 'oidcIssuerUrl',
    } as any);
    await component.downloadKubeConfig();

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(mockAnchorElement.href).toContain('blob-url');
    expect(mockAnchorElement.download).toBe('kubeconfig.yaml');
    expect(mockAnchorElement.click).toHaveBeenCalled();
  });

  it('should download kubeconfig when account info is missing', async () => {
    const mockAnchorElement = document.createElement('a');
    vi.spyOn(mockAnchorElement, 'click');
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchorElement);
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob-url');
    accountInfoServiceMock.read.mockReturnValueOnce(
      of(undefined as unknown as AccountInfo),
    );

    await component.downloadKubeConfig();

    expect(mockAnchorElement.href).toContain('blob-url');
    expect(mockAnchorElement.download).toBe('kubeconfig.yaml');
    expect(mockAnchorElement.click).toHaveBeenCalled();
  });

  it('should download kubeconfig when accountId and kcpCA are missing', async () => {
    const mockAnchorElement = document.createElement('a');
    vi.spyOn(mockAnchorElement, 'click');
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchorElement);
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob-url');
    accountInfoServiceMock.read.mockReturnValueOnce(
      of({
        spec: {
          oidc: {
            issuerUrl: 'issuer',
            clients: { kubectl: { clientId: 'client-id' } },
          },
        },
      } as AccountInfo),
    );
    component.context = (() => ({
      accountId: undefined,
      portalContext: { kcpWorkspaceUrl: 'https://example.com' },
      accountPath: 'account-123',
      kcpCA: undefined,
    })) as any;

    await component.downloadKubeConfig();

    expect(mockAnchorElement.href).toContain('blob-url');
    expect(mockAnchorElement.download).toBe('kubeconfig.yaml');
    expect(mockAnchorElement.click).toHaveBeenCalled();
  });

  it('should skip download when already downloading', async () => {
    const accountInfoSpy = accountInfoServiceMock.read;
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

    component.isDownloadingKubeConfig.set(true);
    await component.downloadKubeConfig();

    expect(accountInfoSpy).not.toHaveBeenCalled();
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('should show alert when downloadKubeConfig fails', async () => {
    const showAlertSpy = vi.fn();
    component.LuigiClient = (() => ({
      uxManager: () => ({ showAlert: showAlertSpy }),
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
        withParams: vi.fn().mockReturnThis(),
      }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
    })) as any;
    accountInfoServiceMock.read.mockReturnValueOnce(
      throwError(() => new Error('boom')),
    );

    await component.downloadKubeConfig();

    expect(showAlertSpy).toHaveBeenCalledWith({
      text: 'Failed to download kubeconfig: boom',
      type: 'error',
    });
  });

  it('should include Secret reference properties but not generic action properties in the detail query', () => {
    mockResourceService.read.mockClear();
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: {
          detailView: {
            fields: [],
            actions: [
              secretAction,
              {
                uiSettings: {
                  displayAs: 'button',
                  buttonSettings: {
                    action: 'download-kubeconfig-from-secret-ref',
                    resourceProperty: 'status.kubeconfigSecretRef.name',
                    text: 'Download local cluster access',
                  },
                },
              },
              {
                property: 'status.console.url',
                uiSettings: {
                  displayAs: 'button',
                  buttonSettings: { action: 'navigate', text: 'Console' },
                },
              },
            ],
          },
        },
      },
    }) as any;
    newComponent.LuigiClient = component.LuigiClient;

    newFixture.detectChanges();

    expect(mockResourceService.read.mock.calls[0][2]).toEqual([
      { metadata: ['deletionTimestamp'] },
      { status: [{ kubeconfig: [{ secretRef: ['name'] }] }] },
      { status: [{ kubeconfig: [{ secretRef: ['namespace'] }] }] },
      { status: [{ kubeconfigSecretRef: ['name'] }] },
    ]);
  });

  it('should hide a Secret action while its reference is unavailable', () => {
    kubeconfigSecretServiceMock.isSecretReferenceAvailable.mockReturnValue(
      false,
    );
    mockResourceService.read.mockReturnValueOnce(
      of({ metadata: { name: 'cluster-1', namespace: 'default' } }),
    );
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: { detailView: { fields: [], actions: [secretAction] } },
      },
    }) as any;
    newComponent.LuigiClient = component.LuigiClient;
    newFixture.detectChanges();

    expect(newComponent.customActions()).not.toContain(
      secretAction.uiSettings.buttonSettings,
    );
  });

  it('should hide generic actions until the resource arrives', () => {
    const resourceRead = new Subject<any>();
    const navigateAction = {
      value: '/clusters',
      uiSettings: {
        displayAs: 'button',
        buttonSettings: { action: 'navigate', text: 'Clusters' },
      },
    };
    mockResourceService.read.mockReturnValueOnce(resourceRead);
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: { detailView: { fields: [], actions: [navigateAction] } },
      },
    }) as any;
    newComponent.LuigiClient = component.LuigiClient;
    newFixture.detectChanges();

    expect(newComponent.resource()).toBeUndefined();
    expect(newComponent.customActions()).toEqual([]);
    resourceRead.next({ metadata: { name: 'cluster-1' } });
    expect(newComponent.customActions()).toContain(
      navigateAction.uiSettings.buttonSettings,
    );
    newFixture.destroy();
  });

  it('should surface a click-time error when the kubeconfig download fails', async () => {
    const showAlert = vi.fn();
    component.LuigiClient = (() => ({
      uxManager: () => ({ showAlert }),
      linkManager: () => ({ navigate: vi.fn(), openAsModal: vi.fn() }),
      getActiveFeatureToggles: () => [],
    })) as any;
    kubeconfigSecretServiceMock.readKubeconfig.mockReturnValue(
      throwError(() => new Error('Kubeconfig Secret could not be read')),
    );

    await component.downloadKubeconfigFromSecretRef(
      secretAction.uiSettings.buttonSettings,
    );

    expect(showAlert).toHaveBeenCalledWith({
      text: 'Failed to download kubeconfig: Kubeconfig Secret could not be read',
      type: 'error',
    });
    expect(component.isDownloadingKubeConfig()).toBe(false);
  });

  it.each([
    { shape: 'a non-array value', actions: {} },
    { shape: 'a null array entry', actions: [null] },
  ])('should ignore actions configured as $shape', ({ actions }) => {
    mockResourceService.read.mockClear();
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: { detailView: { fields: [], actions } },
      },
    }) as any;
    newComponent.LuigiClient = component.LuigiClient;

    expect(() => newFixture.detectChanges()).not.toThrow();
    expect(mockResourceService.read.mock.calls[0][2]).toEqual([
      { metadata: ['deletionTimestamp'] },
    ]);
    expect(newComponent.configuredActions()).toEqual([]);
  });

  it('should render configured presentation when the Secret reference is ready', () => {
    kubeconfigSecretServiceMock.isSecretReferenceAvailable.mockReturnValue(
      true,
    );
    mockResourceService.read.mockReturnValueOnce(
      of({
        metadata: { name: 'cluster-1', namespace: 'default' },
        status: {
          kubeconfig: {
            secretRef: {
              name: 'cluster-kubeconfig',
              namespace: 'provider-ns',
            },
          },
        },
      }),
    );
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: { detailView: { fields: [], actions: [secretAction] } },
      },
    }) as any;
    newComponent.LuigiClient = component.LuigiClient;
    newFixture.detectChanges();

    expect(newComponent.customActions()).toContain(
      secretAction.uiSettings.buttonSettings,
    );
    expect(
      kubeconfigSecretServiceMock.isSecretReferenceAvailable,
    ).toHaveBeenCalledWith(
      secretAction.uiSettings.buttonSettings,
      expect.objectContaining({
        metadata: expect.objectContaining({ name: 'cluster-1' }),
      }),
      expect.anything(),
    );
  });

  it('should delegate Secret-backed download resolution to the service', async () => {
    const loadedResource = {
      metadata: { name: 'cluster-1', namespace: 'default' },
      status: {
        kubeconfig: {
          secretRef: { name: 'cluster-kubeconfig', namespace: 'provider-ns' },
        },
      },
    } as any;
    component.resource.set(loadedResource);
    kubeconfigSecretServiceMock.readKubeconfig.mockReturnValue(
      of({ contents: 'apiVersion: v1', filename: 'cluster.yaml' }),
    );
    const blobConstructor = vi.fn(function (parts, options) {
      return { parts, options };
    });
    vi.stubGlobal('Blob', blobConstructor);
    const anchor = document.createElement('a');
    vi.spyOn(anchor, 'click');
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob-url');
    global.URL.revokeObjectURL = vi.fn();

    await component.downloadKubeconfigFromSecretRef(
      secretAction.uiSettings.buttonSettings,
    );

    expect(kubeconfigSecretServiceMock.readKubeconfig).toHaveBeenCalledWith(
      secretAction.uiSettings.buttonSettings,
      loadedResource,
      component.context(),
    );
    expect(blobConstructor).toHaveBeenCalledWith(['apiVersion: v1'], {
      type: 'application/yaml',
    });
    expect(anchor.download).toBe('cluster.yaml');
    expect(anchor.click).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob-url');
    expect(component.isDownloadingKubeConfig()).toBe(false);
  });

  it('should not start a second Secret-backed download while one is running', async () => {
    component.isDownloadingKubeConfig.set(true);

    await component.downloadKubeconfigFromSecretRef(
      secretAction.uiSettings.buttonSettings,
    );

    expect(kubeconfigSecretServiceMock.readKubeconfig).not.toHaveBeenCalled();
  });

  it('should discard a Secret response after the displayed resource changes', async () => {
    const readResult = new Subject<{
      contents: string;
      filename: string;
    }>();
    component.resource.set({
      metadata: { name: 'cluster-1', namespace: 'default' },
    } as any);
    kubeconfigSecretServiceMock.readKubeconfig.mockReturnValue(readResult);
    global.URL.createObjectURL = vi.fn();

    const download = component.downloadKubeconfigFromSecretRef(
      secretAction.uiSettings.buttonSettings,
    );
    component.resource.set({
      metadata: { name: 'cluster-2', namespace: 'default' },
    } as any);
    readResult.next({
      contents: 'apiVersion: v1',
      filename: 'cluster-1.yaml',
    });
    readResult.complete();
    await download;

    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    expect(component.isDownloadingKubeConfig()).toBe(false);
  });

  it('should suppress a Secret error after the displayed resource changes', async () => {
    const showAlert = vi.fn();
    const readResult = new Subject<{
      contents: string;
      filename: string;
    }>();
    component.resource.set({
      metadata: { name: 'cluster-1', namespace: 'default' },
    } as any);
    component.LuigiClient = (() => ({
      uxManager: () => ({ showAlert }),
      linkManager: () => ({ navigate: vi.fn(), openAsModal: vi.fn() }),
      getActiveFeatureToggles: () => [],
    })) as any;
    kubeconfigSecretServiceMock.readKubeconfig.mockReturnValue(readResult);

    const download = component.downloadKubeconfigFromSecretRef(
      secretAction.uiSettings.buttonSettings,
    );
    component.resource.set({
      metadata: { name: 'cluster-2', namespace: 'default' },
    } as any);
    readResult.error(new Error('stale failure'));
    await download;

    expect(showAlert).not.toHaveBeenCalled();
    expect(component.isDownloadingKubeConfig()).toBe(false);
  });

  it('should cancel a pending Secret read when the context changes', async () => {
    const showAlert = vi.fn();
    const readResult = new Subject<{
      contents: string;
      filename: string;
    }>();
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    const oldContext = {
      ...component.context(),
      resourceId: 'cluster-1',
      kcpPath: 'root:orgs:showroom:old-account',
    };
    newFixture.componentRef.setInput('context', oldContext);
    newFixture.componentRef.setInput('LuigiClient', (() => ({
      uxManager: () => ({ showAlert }),
      linkManager: () => ({ navigate: vi.fn(), openAsModal: vi.fn() }),
      getActiveFeatureToggles: () => [],
    })) as any);
    newFixture.detectChanges();
    newComponent.resource.set({
      metadata: { name: 'cluster-1', namespace: 'default' },
    } as any);
    kubeconfigSecretServiceMock.readKubeconfig.mockReturnValue(readResult);
    global.URL.createObjectURL = vi.fn();

    const download = newComponent.downloadKubeconfigFromSecretRef(
      secretAction.uiSettings.buttonSettings,
    );
    expect(readResult.observed).toBe(true);

    newFixture.componentRef.setInput('context', {
      ...oldContext,
      resourceId: 'cluster-2',
      kcpPath: 'root:orgs:showroom:new-account',
    });
    newFixture.detectChanges();
    await download;

    expect(readResult.observed).toBe(false);
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    expect(showAlert).not.toHaveBeenCalled();
    expect(newComponent.isDownloadingKubeConfig()).toBe(false);
    newFixture.destroy();
  });

  it.each(['response', 'error'])(
    'ignores a stale Secret %s before context cleanup',
    async (outcome) => {
      const pending = new Subject<{ contents: string; filename: string }>();
      const showAlert = vi.fn();
      const view = TestBed.createComponent(DetailView);
      const card = view.componentInstance;
      const context = { ...component.context(), resourceId: 'cluster-1' };
      view.componentRef.setInput('context', context);
      view.componentRef.setInput('LuigiClient', {
        ...component.LuigiClient(),
        uxManager: () => ({ showAlert }),
      });
      view.detectChanges();
      kubeconfigSecretServiceMock.readKubeconfig.mockReturnValue(pending);
      global.URL.createObjectURL = vi.fn();
      const download = card.downloadKubeconfigFromSecretRef(
        secretAction.uiSettings.buttonSettings,
      );

      view.componentRef.setInput('context', {
        ...context,
        resourceId: 'cluster-2',
      });
      if (outcome === 'response') {
        pending.next({
          contents: 'apiVersion: v1',
          filename: 'cluster-1.yaml',
        });
        pending.complete();
      } else {
        pending.error(new Error('Stale read failure'));
      }
      await download;
      expect(global.URL.createObjectURL).not.toHaveBeenCalled();
      expect(showAlert).not.toHaveBeenCalled();
      await card.downloadKubeconfigFromSecretRef(
        secretAction.uiSettings.buttonSettings,
      );
      expect(kubeconfigSecretServiceMock.readKubeconfig).toHaveBeenCalledTimes(
        1,
      );
      view.destroy();
    },
  );

  it('should cancel a pending Secret read when the view is destroyed', async () => {
    const showAlert = vi.fn();
    const readResult = new Subject<{
      contents: string;
      filename: string;
    }>();
    component.resource.set({
      metadata: { name: 'cluster-1', namespace: 'default' },
    } as any);
    component.LuigiClient = (() => ({
      uxManager: () => ({ showAlert }),
      linkManager: () => ({ navigate: vi.fn(), openAsModal: vi.fn() }),
      getActiveFeatureToggles: () => [],
    })) as any;
    kubeconfigSecretServiceMock.readKubeconfig.mockReturnValue(readResult);
    global.URL.createObjectURL = vi.fn();

    const download = component.downloadKubeconfigFromSecretRef(
      secretAction.uiSettings.buttonSettings,
    );
    expect(readResult.observed).toBe(true);

    fixture.destroy();
    await download;

    expect(readResult.observed).toBe(false);
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    expect(showAlert).not.toHaveBeenCalled();
    expect(component.isDownloadingKubeConfig()).toBe(false);
  });

  it('should report the service error without attempting a download', async () => {
    const showAlertSpy = vi.fn();
    component.LuigiClient = (() => ({
      uxManager: () => ({ showAlert: showAlertSpy }),
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
      }),
      getActiveFeatureToggles: () => [],
    })) as any;
    kubeconfigSecretServiceMock.readKubeconfig.mockReturnValue(
      throwError(() => new Error('Kubeconfig Secret could not be read')),
    );
    global.URL.createObjectURL = vi.fn();

    await component.downloadKubeconfigFromSecretRef(
      secretAction.uiSettings.buttonSettings,
    );

    expect(showAlertSpy).toHaveBeenCalledWith({
      text: 'Failed to download kubeconfig: Kubeconfig Secret could not be read',
      type: 'error',
    });
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    expect(component.isDownloadingKubeConfig()).toBe(false);
  });

  it('should dispatch a configured Secret-backed action to the download flow', () => {
    mockResourceService.read.mockReturnValueOnce(
      of({
        metadata: { name: 'cluster-1', namespace: 'default' },
        status: {
          kubeconfig: {
            secretRef: { name: 'cluster-kubeconfig', namespace: 'default' },
          },
        },
      }),
    );
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: { detailView: { fields: [], actions: [secretAction] } },
      },
    }) as any;
    newComponent.LuigiClient = component.LuigiClient;
    newFixture.detectChanges();
    const downloadSpy = vi
      .spyOn(newComponent, 'downloadKubeconfigFromSecretRef')
      .mockResolvedValue(undefined);

    newComponent.onActionButtonClick({
      event: new MouseEvent('click'),
      action: secretAction.uiSettings.buttonSettings,
    } as any);

    expect(downloadSpy).toHaveBeenCalledWith(
      secretAction.uiSettings.buttonSettings,
    );
  });

  it('should dispatch repeated generic actions independently', () => {
    const actions = [
      {
        value: '/clusters/one',
        uiSettings: {
          buttonSettings: { action: 'navigate', text: 'Cluster one' },
        },
      },
      {
        value: '/clusters/two',
        uiSettings: {
          buttonSettings: { action: 'navigate', text: 'Cluster two' },
        },
      },
    ];
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: { detailView: { fields: [], actions } },
      },
    }) as any;
    newComponent.LuigiClient = component.LuigiClient;
    newFixture.detectChanges();

    expect(newComponent.customActions()).toContain(
      actions[0].uiSettings.buttonSettings,
    );
    expect(newComponent.customActions()).toContain(
      actions[1].uiSettings.buttonSettings,
    );

    newComponent.onActionButtonClick({
      event: new MouseEvent('click'),
      action: actions[1].uiSettings.buttonSettings,
    } as any);

    expect(luigiClientLinkManagerNavigate).toHaveBeenCalledWith(
      '/clusters/two',
    );
  });

  it('should render an unsupported generic action and alert when it is clicked', () => {
    const showAlert = vi.fn();
    mockResourceService.read.mockClear();
    const unsupportedAction = {
      property: 'status.console.url',
      uiSettings: {
        buttonSettings: {
          action: 'providerSpecificAction',
          text: 'Provider action',
        },
      },
    };
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: { detailView: { fields: [], actions: [unsupportedAction] } },
      },
    }) as any;
    newComponent.LuigiClient = (() => ({
      linkManager: () => ({ navigate: vi.fn(), openAsModal: vi.fn() }),
      uxManager: () => ({ showAlert }),
      getActiveFeatureToggles: () => [],
    })) as any;
    newFixture.detectChanges();

    expect(newComponent.customActions()).toContain(
      unsupportedAction.uiSettings.buttonSettings,
    );
    expect(mockResourceService.read.mock.calls[0][2]).toEqual([
      { metadata: ['deletionTimestamp'] },
    ]);

    newComponent.onActionButtonClick({
      event: new MouseEvent('click'),
      action: unsupportedAction.uiSettings.buttonSettings,
    } as any);

    expect(showAlert).toHaveBeenCalledWith({
      text: 'Configured action could not be executed',
      type: 'error',
    });
  });

  it('should render a generic action without a target and alert on click', () => {
    const showAlert = vi.fn();
    mockResourceService.read.mockClear();
    const missingTargetAction = {
      uiSettings: {
        buttonSettings: { action: 'navigate', text: 'Console' },
      },
    };
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: { detailView: { fields: [], actions: [missingTargetAction] } },
      },
    }) as any;
    newComponent.LuigiClient = (() => ({
      linkManager: () => ({ navigate: vi.fn(), openAsModal: vi.fn() }),
      uxManager: () => ({ showAlert }),
      getActiveFeatureToggles: () => [],
    })) as any;
    newFixture.detectChanges();

    expect(newComponent.customActions()).toContain(
      missingTargetAction.uiSettings.buttonSettings,
    );

    newComponent.onActionButtonClick({
      event: new MouseEvent('click'),
      action: missingTargetAction.uiSettings.buttonSettings,
    } as any);

    expect(showAlert).toHaveBeenCalledWith({
      text: 'Configured action could not be executed',
      type: 'error',
    });
  });

  it('should not add a generic action with an invalid JSONPath to the query', () => {
    mockResourceService.read.mockClear();
    mockResourceService.read.mockReturnValueOnce(
      of({
        metadata: { name: 'cluster-1' },
        status: { console: { url: '/console' } },
      }),
    );
    const invalidJsonPathAction = {
      property: 'status.console.url',
      jsonPathExpression: '$[?(',
      uiSettings: {
        buttonSettings: { action: 'navigate', text: 'Console' },
      },
    };
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: {
          detailView: { fields: [], actions: [invalidJsonPathAction] },
        },
      },
    }) as any;
    newComponent.LuigiClient = component.LuigiClient;
    newFixture.detectChanges();

    expect(() => newComponent.customActions()).not.toThrow();
    expect(mockResourceService.read.mock.calls[0][2]).toEqual([
      { metadata: ['deletionTimestamp'] },
    ]);
  });

  it('should neither render nor query a Secret action when its required permission is denied', () => {
    mockResourceService.read.mockClear();
    kubeconfigSecretServiceMock.secretReferenceQueryFields.mockClear();
    mockResourceService.read.mockReturnValueOnce(
      of({
        metadata: { name: 'cluster-1', namespace: 'default' },
      }),
    );
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      namespaceId: 'default',
      portalPermissions: { 'clusters/default/cluster-1': ['get'] },
      resourceDefinition: {
        ...component.context().resourceDefinition,
        permissionsDefinition: { resource: 'clusters' },
        ui: {
          detailView: {
            fields: [],
            actions: [
              {
                ...secretAction,
                requirePermission: 'update',
              },
            ],
          },
        },
      },
    }) as any;
    newComponent.LuigiClient = component.LuigiClient;
    newFixture.detectChanges();

    expect(
      newComponent.customActions().map((action) => action.text),
    ).not.toContain('Download cluster access');
    expect(newComponent.configuredActions()).toEqual([]);
    expect(
      kubeconfigSecretServiceMock.secretReferenceQueryFields,
    ).not.toHaveBeenCalled();
    expect(mockResourceService.read.mock.calls[0][2]).toEqual([
      { metadata: ['deletionTimestamp'] },
    ]);
  });

  it('should use the effective route namespace before querying a permission-gated Secret reference', () => {
    mockResourceService.read.mockClear();
    kubeconfigSecretServiceMock.secretReferenceQueryFields.mockClear();
    mockResourceService.getNamespace.mockReturnValue('route-namespace');
    mockResourceService.read.mockReturnValueOnce(
      of({
        metadata: { name: 'cluster-1', namespace: 'route-namespace' },
      }),
    );
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      namespaceId: undefined,
      portalPermissions: {
        'clusters/route-namespace/cluster-1': ['get'],
      },
      resourceDefinition: {
        ...component.context().resourceDefinition,
        permissionsDefinition: { resource: 'clusters' },
        ui: {
          detailView: {
            fields: [],
            actions: [
              {
                ...secretAction,
                requirePermission: 'update',
              },
            ],
          },
        },
      },
    }) as any;
    newComponent.LuigiClient = component.LuigiClient;
    newFixture.detectChanges();

    expect(mockResourceService.getNamespace).toHaveBeenCalledWith(
      newComponent.context(),
    );
    expect(newComponent.configuredActions()).toEqual([]);
    expect(
      kubeconfigSecretServiceMock.secretReferenceQueryFields,
    ).not.toHaveBeenCalled();
    expect(mockResourceService.read.mock.calls[0][2]).toEqual([
      { metadata: ['deletionTimestamp'] },
    ]);
  });

  it('should restore configured modal actions', () => {
    const openAsModal = vi.fn();
    const modalAction = {
      value: '/help',
      uiSettings: {
        buttonSettings: {
          action: 'openInModal',
          text: 'Help',
          modalSettings: { title: 'Help', size: 'm' },
        },
      },
    };
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    newComponent.context = signal({
      ...component.context(),
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: { detailView: { fields: [], actions: [modalAction] } },
      },
    }) as any;
    newComponent.LuigiClient = (() => ({
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
        openAsModal,
      }),
      uxManager: () => ({ showAlert: vi.fn() }),
      getActiveFeatureToggles: () => [],
    })) as any;
    newFixture.detectChanges();

    newComponent.onActionButtonClick({
      event: new MouseEvent('click'),
      action: modalAction.uiSettings.buttonSettings,
    } as any);

    expect(openAsModal).toHaveBeenCalledWith('/help', {
      title: 'Help',
      size: 'm',
    });
  });

  it('should call resource service with correct parameters for account kind', () => {
    vi.clearAllMocks();
    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;

    newComponent.context = signal({
      resourceId: 'test-account',
      token: 'abc123',
      resourceDefinition: {
        entity: 'Account',
        entityCollection: 'accounts',
        apiGroup: 'core_k8s_io',
        version: 'v1alpha1',
        ui: {
          detailView: {
            fields: [],
          },
        },
      },
      entityName: 'test-account',
      parentNavigationContexts: ['project'],
    }) as any;

    newComponent.LuigiClient = (() => ({
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
        withParams: vi.fn().mockReturnThis(),
      }),
      uxManager: () => ({
        showAlert: vi.fn(),
      }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
    })) as any;

    newFixture.detectChanges();

    expect(mockResourceService.read).toHaveBeenCalled();
    const readCall = mockResourceService.read.mock.calls[0];
    const fieldsArg = readCall[2];
    const fieldsStr = JSON.stringify(fieldsArg);

    expect(readCall[0]).toBe('test-account');
    expect(readCall[1]).toEqual(
      expect.objectContaining({
        entity: 'Account',
        apiGroup: 'core_k8s_io',
        version: 'v1alpha1',
      }),
    );
    expect(fieldsStr).toContain('metadata');
    expect(fieldsStr).toContain('deletionTimestamp');
    expect(readCall[3]).toEqual(expect.any(Object));
    expect(readCall[4]).toBe(true);
  });

  it('should handle resource service read error', () => {
    vi.clearAllMocks();
    mockResourceService.read.mockReturnValueOnce(
      throwError(() => new Error('Read failed')),
    );

    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;

    newComponent.context = signal({
      resourceId: 'cluster-1',
      token: 'abc123',
      resourceDefinition: {
        entity: 'Cluster',
        entityCollection: 'clusters',
        apiGroup: 'core_k8s_io',
        ui: {
          detailView: {
            fields: [],
          },
        },
      },
      entityName: 'test-resource',
      parentNavigationContexts: ['project'],
    }) as any;

    newComponent.LuigiClient = (() => ({
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
        withParams: vi.fn().mockReturnThis(),
      }),
      uxManager: () => ({
        showAlert: vi.fn(),
      }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
    })) as any;

    newFixture.detectChanges();

    // Component should still be created even if read fails
    expect(newComponent).toBeTruthy();
  });

  it('should clear the old resource and ignore a stale read after the context changes', () => {
    vi.clearAllMocks();
    const oldRead = new Subject<any>();
    const newRead = new Subject<any>();
    mockResourceService.read.mockReset();
    mockResourceService.read
      .mockReturnValueOnce(oldRead)
      .mockReturnValueOnce(newRead);

    const newFixture = TestBed.createComponent(DetailView);
    const newComponent = newFixture.componentInstance;
    const oldContext = {
      ...component.context(),
      resourceId: 'old-cluster',
      kcpPath: 'root:orgs:showroom:old-account',
      resourceDefinition: {
        ...component.context().resourceDefinition,
        ui: { detailView: { fields: [], actions: [secretAction] } },
      },
    };
    const newContext = {
      ...oldContext,
      resourceId: 'new-cluster',
      kcpPath: 'root:orgs:showroom:new-account',
    };
    newFixture.componentRef.setInput('context', oldContext);
    newFixture.componentRef.setInput('LuigiClient', component.LuigiClient());
    newFixture.detectChanges();

    oldRead.next({
      metadata: { name: 'old-cluster', namespace: 'default' },
      status: {
        kubeconfig: {
          secretRef: { name: 'old-secret', namespace: 'default' },
        },
      },
    });
    newFixture.detectChanges();
    expect(newComponent.resource()?.metadata?.name).toBe('old-cluster');

    newFixture.componentRef.setInput('context', newContext);
    newFixture.detectChanges();

    expect(mockResourceService.read).toHaveBeenCalledTimes(2);
    expect(newComponent.resource()).toBeUndefined();

    newRead.next({
      metadata: { name: 'new-cluster', namespace: 'default' },
    });
    oldRead.next({
      metadata: { name: 'old-cluster', namespace: 'default' },
      status: {
        kubeconfig: {
          secretRef: { name: 'old-secret', namespace: 'default' },
        },
      },
    });
    newFixture.detectChanges();

    expect(newComponent.resource()?.metadata?.name).toBe('new-cluster');
    newFixture.destroy();
  });

  describe('Null and undefined checks', () => {
    let mockUxManager: any;

    beforeEach(() => {
      mockUxManager = {
        showAlert: vi.fn(),
      };
    });

    it('should handle undefined resourceId in readResource method', () => {
      vi.clearAllMocks();
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      newComponent.context = signal({
        entityName: undefined,
        token: 'abc123',
        resourceDefinition: {
          entity: 'Cluster',
          entityCollection: 'clusters',
          apiGroup: 'core_k8s_io',
          ui: {
            detailView: {
              fields: [],
            },
          },
        },
        parentNavigationContexts: ['project'],
      }) as any;

      newComponent.LuigiClient = (() => ({
        linkManager: () => ({
          fromContext: vi.fn().mockReturnThis(),
          navigate: vi.fn(),
          withParams: vi.fn().mockReturnThis(),
        }),
        uxManager: () => mockUxManager,
        getNodeParams: vi.fn(),
        getActiveFeatureToggles: () => [],
      })) as any;

      expect(() => {
        newFixture.detectChanges();
      }).toThrow('Resource ID is not defined');

      expect(mockUxManager.showAlert).toHaveBeenCalledWith({
        text: 'Resource ID is not defined',
        type: 'error',
      });
    });

    it('should call handleResourcePendingDeletionError during readResource if resource has deletionTimestamp', () => {
      const terminatingResource = {
        metadata: {
          name: 'test-resource',
          deletionTimestamp: '2026-02-04T12:00:00Z',
        },
      };

      mockResourceService.read.mockReturnValue(of(terminatingResource));

      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      newComponent.context = component.context;
      newComponent.LuigiClient = component.LuigiClient;

      newFixture.detectChanges();

      expect(
        errorHandlerServiceMock.handleResourcePendingDeletion,
      ).toHaveBeenCalledWith(terminatingResource);
    });

    it('should handle undefined parentNavigationContext in navigateToParent method', () => {
      vi.clearAllMocks();
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      newComponent.context = signal({
        resourceId: 'cluster-1',
        token: 'abc123',
        resourceDefinition: {
          entity: 'Cluster',
          entityCollection: 'clusters',
          apiGroup: 'core_k8s_io',
          ui: {
            detailView: {
              fields: [],
            },
          },
        },
        entityName: 'test-resource',
        parentNavigationContexts: undefined, // undefined parentNavigationContexts
      }) as any;

      newComponent.LuigiClient = (() => ({
        linkManager: () => ({
          fromContext: vi.fn().mockReturnThis(),
          navigate: vi.fn(),
          withParams: vi.fn().mockReturnThis(),
        }),
        uxManager: () => mockUxManager,
        getNodeParams: vi.fn(),
        getActiveFeatureToggles: () => [],
      })) as any;

      newFixture.detectChanges();

      expect(() => {
        newComponent.navigateToParent();
      }).toThrow('Parent navigation context is not defined');

      expect(mockUxManager.showAlert).toHaveBeenCalledWith({
        text: 'Parent navigation context is not defined',
        type: 'error',
      });
    });

    it('should handle empty parentNavigationContexts array in navigateToParent method', () => {
      vi.clearAllMocks();
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      newComponent.context = signal({
        resourceId: 'cluster-1',
        token: 'abc123',
        resourceDefinition: {
          entity: 'Cluster',
          entityCollection: 'clusters',
          apiGroup: 'core_k8s_io',
          ui: {
            detailView: {
              fields: [],
            },
          },
        },
        entityName: 'test-resource',
        parentNavigationContexts: [], // empty array
      }) as any;

      newComponent.LuigiClient = (() => ({
        linkManager: () => ({
          fromContext: vi.fn().mockReturnThis(),
          navigate: vi.fn(),
          withParams: vi.fn().mockReturnThis(),
        }),
        uxManager: () => mockUxManager,
        getNodeParams: vi.fn(),
        getActiveFeatureToggles: () => [],
      })) as any;

      newFixture.detectChanges();

      expect(() => {
        newComponent.navigateToParent();
      }).toThrow('Parent navigation context is not defined');

      expect(mockUxManager.showAlert).toHaveBeenCalledWith({
        text: 'Parent navigation context is not defined',
        type: 'error',
      });
    });

    it('should handle undefined resourceDefinition in getResourceDefinition method', () => {
      vi.clearAllMocks();
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      newComponent.context = signal({
        resourceId: 'cluster-1',
        token: 'abc123',
        resourceDefinition: undefined, // undefined resourceDefinition
        entityName: 'test-resource',
        parentNavigationContexts: ['project'],
      }) as any;

      newComponent.LuigiClient = (() => ({
        linkManager: () => ({
          fromContext: vi.fn().mockReturnThis(),
          navigate: vi.fn(),
          withParams: vi.fn().mockReturnThis(),
        }),
        uxManager: () => mockUxManager,
        getNodeParams: vi.fn(),
        getActiveFeatureToggles: () => [],
      })) as any;

      expect(() => {
        newFixture.detectChanges();
      }).toThrow('Resource definition is not defined');

      expect(mockUxManager.showAlert).toHaveBeenCalledWith({
        text: 'Resource definition is not defined',
        type: 'error',
      });
    });
  });

  describe('Resource description definition', () => {
    it('should include resourceDescription in query fields', () => {
      vi.clearAllMocks();
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      newComponent.context = signal({
        resourceId: 'cluster-1',
        token: 'abc123',
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'Cluster',
          entityCollection: 'clusters',
          apiGroup: 'core_k8s_io',
          ui: {
            detailView: {
              fields: [{ property: 'metadata.name' }],
              resourceDescription: {
                property: 'spec.description',
              },
            },
          },
        },
        entityName: 'test-resource',
        parentNavigationContexts: ['project'],
      }) as any;

      newComponent.LuigiClient = (() => ({
        linkManager: () => ({
          fromContext: vi.fn().mockReturnThis(),
          navigate: vi.fn(),
          withParams: vi.fn().mockReturnThis(),
        }),
        uxManager: () => ({
          showAlert: vi.fn(),
        }),
        getNodeParams: vi.fn(),
        getActiveFeatureToggles: () => [],
      })) as any;

      newFixture.detectChanges();

      expect(mockResourceService.read).toHaveBeenCalled();
      const readCall = mockResourceService.read.mock.calls[0];
      const fieldsArg = readCall[2];
      const fieldsStr = JSON.stringify(fieldsArg);
      expect(fieldsStr).toContain('spec');
      expect(fieldsStr).toContain('description');
      expect(fieldsStr).toContain('metadata');
      expect(fieldsStr).toContain('deletionTimestamp');
    });
  });

  describe('Resource title definition', () => {
    it('should include resourceTitle in query fields', () => {
      vi.clearAllMocks();
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      newComponent.context = signal({
        resourceId: 'cluster-1',
        token: 'abc123',
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'Cluster',
          entityCollection: 'clusters',
          apiGroup: 'core_k8s_io',
          ui: {
            detailView: {
              fields: [{ property: 'metadata.name' }],
              resourceTitle: {
                property: 'spec.displayName',
              },
            },
          },
        },
        entityName: 'test-resource',
        parentNavigationContexts: ['project'],
      }) as any;

      newComponent.LuigiClient = (() => ({
        linkManager: () => ({
          fromContext: vi.fn().mockReturnThis(),
          navigate: vi.fn(),
          withParams: vi.fn().mockReturnThis(),
        }),
        uxManager: () => ({
          showAlert: vi.fn(),
        }),
        getNodeParams: vi.fn(),
        getActiveFeatureToggles: () => [],
      })) as any;

      newFixture.detectChanges();

      expect(mockResourceService.read).toHaveBeenCalled();
      const readCall = mockResourceService.read.mock.calls[0];
      const fieldsArg = readCall[2];
      const fieldsStr = JSON.stringify(fieldsArg);
      expect(fieldsStr).toContain('spec');
      expect(fieldsStr).toContain('displayName');
      expect(fieldsStr).toContain('metadata');
      expect(fieldsStr).toContain('deletionTimestamp');
    });

    it('should include both resourceTitle and resourceDescription in query fields', () => {
      vi.clearAllMocks();
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      newComponent.context = signal({
        resourceId: 'cluster-1',
        token: 'abc123',
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'Cluster',
          entityCollection: 'clusters',
          apiGroup: 'core_k8s_io',
          ui: {
            detailView: {
              fields: [{ property: 'metadata.name' }],
              resourceTitle: {
                property: 'spec.displayName',
              },
              resourceDescription: {
                property: 'spec.description',
              },
            },
          },
        },
        entityName: 'test-resource',
        parentNavigationContexts: ['project'],
      }) as any;

      newComponent.LuigiClient = (() => ({
        linkManager: () => ({
          fromContext: vi.fn().mockReturnThis(),
          navigate: vi.fn(),
          withParams: vi.fn().mockReturnThis(),
        }),
        uxManager: () => ({
          showAlert: vi.fn(),
        }),
        getNodeParams: vi.fn(),
        getActiveFeatureToggles: () => [],
      })) as any;

      newFixture.detectChanges();

      expect(mockResourceService.read).toHaveBeenCalled();
      const readCall = mockResourceService.read.mock.calls[0];
      const fieldsArg = readCall[2];
      const fieldsStr = JSON.stringify(fieldsArg);
      expect(fieldsStr).toContain('spec');
      expect(fieldsStr).toContain('displayName');
      expect(fieldsStr).toContain('description');
      expect(fieldsStr).toContain('metadata');
      expect(fieldsStr).toContain('deletionTimestamp');
    });
  });

  describe('dashboardConfig', () => {
    it('should include download-kubeconfig action when showDownloadKubeconfig is true', () => {
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;

      newComponent.context = signal({
        resourceId: 'cluster-1',
        token: 'abc123',
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'Cluster',
          entityCollection: 'clusters',
          apiGroup: 'core_k8s_io',
          ui: {
            detailView: {
              fields: [],
              showDownloadKubeconfig: true,
            },
          },
        },
        entityName: 'test-resource',
        parentNavigationContexts: ['project'],
      }) as any;

      newComponent.LuigiClient = (() => ({
        linkManager: () => ({
          fromContext: vi.fn().mockReturnThis(),
          navigate: vi.fn(),
        }),
        uxManager: () => ({ showAlert: vi.fn() }),
        getNodeParams: vi.fn(),
        getActiveFeatureToggles: () => [],
      })) as any;

      newFixture.detectChanges();

      const actions = newComponent.customActions();
      expect(actions.some((a) => a.action === 'download-kubeconfig')).toBe(
        true,
      );
    });

    it('should not include edit/delete actions when resource is not loaded', () => {
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;
      mockResourceService.read = vi.fn().mockReturnValue(of(undefined));
      newComponent.context = signal({
        resourceId: 'cluster-1',
        token: 'abc123',
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'Cluster',
          entityCollection: 'clusters',
          apiGroup: 'core_k8s_io',
          ui: { detailView: { fields: [] } },
        },
        entityName: 'test-resource',
        parentNavigationContexts: ['project'],
      }) as any;
      newComponent.LuigiClient = (() => ({
        linkManager: () => ({
          fromContext: vi.fn().mockReturnThis(),
          navigate: vi.fn(),
        }),
        uxManager: () => ({ showAlert: vi.fn() }),
        getNodeParams: vi.fn(),
        getActiveFeatureToggles: () => [],
      })) as any;
      newFixture.detectChanges();
      const actions = newComponent.customActions();
      expect(actions.some((a) => a.action === 'edit')).toBe(false);
      expect(actions.some((a) => a.action === 'delete')).toBe(false);
    });
  });

  describe('onActionButtonClick', () => {
    it('should call downloadKubeConfig for download-kubeconfig action', () => {
      const downloadSpy = vi
        .spyOn(component, 'downloadKubeConfig')
        .mockResolvedValue(undefined);
      component.onActionButtonClick({
        event: new MouseEvent('click'),
        action: { action: 'download-kubeconfig' },
      } as any);
      expect(downloadSpy).toHaveBeenCalled();
    });

    it('should call openEditResourceModal for edit action when resource exists', () => {
      const resource = { metadata: { name: 'cluster-1' } } as any;
      component.resource.set(resource);
      const openEditSpy = vi.spyOn(component, 'openEditResourceModal');
      const event = new MouseEvent('click');
      component.onActionButtonClick({
        event,
        action: { action: 'edit' },
      } as any);
      expect(openEditSpy).toHaveBeenCalledWith(event);
    });

    it('should call openDeleteResourceModal for delete action when resource exists', () => {
      const resource = { metadata: { name: 'cluster-1' } } as any;
      component.resource.set(resource);
      const openDeleteSpy = vi.spyOn(component, 'openDeleteResourceModal');
      const event = new MouseEvent('click');
      component.onActionButtonClick({
        event,
        action: { action: 'delete' },
      } as any);
      expect(openDeleteSpy).toHaveBeenCalledWith(event);
    });

    it('should not call openEditResourceModal for edit action when resource is undefined', () => {
      component.resource.set(undefined);
      const openEditSpy = vi.spyOn(component, 'openEditResourceModal');
      component.onActionButtonClick({
        event: new MouseEvent('click'),
        action: { action: 'edit' },
      } as any);
      expect(openEditSpy).not.toHaveBeenCalled();
    });

    it('should not call openDeleteResourceModal for delete action when resource is undefined', () => {
      component.resource.set(undefined);
      const openDeleteSpy = vi.spyOn(component, 'openDeleteResourceModal');
      component.onActionButtonClick({
        event: new MouseEvent('click'),
        action: { action: 'delete' },
      } as any);
      expect(openDeleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('dashboardConfigurationChanged', () => {
    it('should write config to localStorage', () => {
      const writeConfigSpy = vi.spyOn(localStorage, 'setItem');
      const config = { cards: [], sections: [] };
      (component as any).dashboardConfigurationChanged(config);
      expect(writeConfigSpy).toHaveBeenCalled();
    });
  });

  describe('Computed branches', () => {
    it('should use spec.displayName for defaultTitle when present', () => {
      component.resource.set({
        metadata: { name: 'cluster-1' },
        spec: { displayName: 'My Cluster' },
      } as any);
      expect(component.defaultTitle()).toBe('My Cluster');
    });

    it('should fall back to resourceId for defaultTitle when spec.displayName is absent', () => {
      component.resource.set({ metadata: { name: 'cluster-1' } } as any);
      expect(component.defaultTitle()).toBe('cluster-1');
    });

    it('should return empty string for defaultTitle when resource has no displayName and resourceId is undefined', () => {
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;
      newComponent.context = signal({
        resourceId: undefined,
        token: 'abc123',
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'Cluster',
          entityCollection: 'clusters',
          apiGroup: 'core_k8s_io',
          ui: { detailView: { fields: [] } },
        },
        entityName: 'test-resource',
        parentNavigationContexts: ['project'],
      }) as any;
      newComponent.LuigiClient = (() => ({
        linkManager: () => ({
          fromContext: vi.fn().mockReturnThis(),
          navigate: vi.fn(),
        }),
        uxManager: () => ({ showAlert: vi.fn() }),
        getNodeParams: vi.fn(),
        getActiveFeatureToggles: () => [],
      })) as any;
      newComponent.resource.set({ metadata: { name: 'cluster-1' } } as any);
      expect(newComponent.defaultTitle()).toBe('');
    });

    it('should read saved sections from localStorage via sections computed', () => {
      const savedConfig = {
        cards: [
          { id: 'card-1', component: 'pm-card', type: 'angular', w: 6, h: 10 },
        ],
        sections: [{ id: 'section-1', label: 'Section 1', cards: [] }],
      };
      localStorage.setItem(
        `pm.workspace:https://example.com.resourceType:Cluster.resourceId:cluster-1.user:undefined`,
        JSON.stringify(savedConfig),
      );

      expect(component.sections().length).toBe(1);
      expect(component.sections()[0].id).toBe('section-1');

      localStorage.removeItem(
        `pm.workspace:https://example.com.resourceType:Cluster.resourceId:cluster-1.user:undefined`,
      );
    });

    it('should read saved cards from localStorage via cards computed', () => {
      const savedConfig = {
        cards: [
          { id: 'card-1', component: 'pm-card', type: 'angular', w: 6, h: 10 },
        ],
        sections: [],
      };
      localStorage.setItem(
        `pm.workspace:https://example.com.resourceType:Cluster.resourceId:cluster-1.user:undefined`,
        JSON.stringify(savedConfig),
      );

      expect(component.cards().length).toBe(1);
      expect(component.cards()[0].id).toBe('card-1');

      localStorage.removeItem(
        `pm.workspace:https://example.com.resourceType:Cluster.resourceId:cluster-1.user:undefined`,
      );
    });
  });
  describe('Luigi page-dirty shim', () => {
    it('should not post luigi.set-page-dirty on init', () => {
      const postSpy = vi.spyOn(window, 'postMessage');

      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;
      newComponent.context = component.context;
      newComponent.LuigiClient = component.LuigiClient;
      newFixture.detectChanges();

      expect(
        postSpy.mock.calls.some(
          (call) => (call[0] as any)?.msg === 'luigi.set-page-dirty',
        ),
      ).toBe(false);
    });

    it('should post luigi.set-page-dirty when the dashboard emits unsavedChangesChange', () => {
      const postSpy = vi.spyOn(window, 'postMessage');

      // Drive the template handler directly — this is what the
      // (unsavedChangesChange)="setLuigiPageDirty($event)" binding does.
      (component as any).setLuigiPageDirty(true);

      const dirtyCalls = postSpy.mock.calls.filter(
        (call) => (call[0] as any)?.msg === 'luigi.set-page-dirty',
      );
      expect(dirtyCalls.length).toBe(1);
      expect(dirtyCalls[0][0]).toEqual({
        msg: 'luigi.set-page-dirty',
        dirty: true,
      });

      (component as any).setLuigiPageDirty(false);

      const finalCalls = postSpy.mock.calls.filter(
        (call) => (call[0] as any)?.msg === 'luigi.set-page-dirty',
      );
      expect(finalCalls.length).toBe(2);
      expect(finalCalls[1][0]).toEqual({
        msg: 'luigi.set-page-dirty',
        dirty: false,
      });
    });

    it('should post dirty=false when the component is destroyed', () => {
      const newFixture = TestBed.createComponent(DetailView);
      const newComponent = newFixture.componentInstance;
      newComponent.context = component.context;
      newComponent.LuigiClient = component.LuigiClient;

      newFixture.detectChanges();

      // Reset spy so we only assert what destroy emits.
      const postSpy = vi.spyOn(window, 'postMessage');
      newFixture.destroy();

      const dirtyCalls = postSpy.mock.calls.filter(
        (call) => (call[0] as any)?.msg === 'luigi.set-page-dirty',
      );
      expect(dirtyCalls.length).toBe(1);
      expect(dirtyCalls[0][0]).toEqual({
        msg: 'luigi.set-page-dirty',
        dirty: false,
      });
    });
  });

  describe('getDetailViewQueryFields', () => {
    it('should build the read query from detailView fields', () => {
      mockResourceService.read.mockClear();

      const localFixture = TestBed.createComponent(DetailView);
      const localComponent = localFixture.componentInstance;
      localComponent.context = signal({
        ...component.context(),
        resourceDefinition: {
          version: 'v1alpha1',
          entity: 'Cluster',
          entityCollection: 'clusters',
          apiGroup: 'core_k8s_io',
          ui: {
            createView: {
              fields: [{ property: 'spec.createOnlyField' }],
            },
            detailView: {
              fields: [
                { property: 'metadata.name' },
                { property: 'spec.detailOnlyField' },
              ],
            },
          },
        },
      }) as any;
      localComponent.LuigiClient = component.LuigiClient;
      localFixture.detectChanges();

      expect(mockResourceService.read).toHaveBeenCalled();
      const fields = JSON.stringify(mockResourceService.read.mock.calls[0][2]);
      expect(fields).toContain('detailOnlyField');
      expect(fields).toContain('name');
      expect(fields).not.toContain('createOnlyField');
    });
  });
});

describe('DetailViewComponent template', () => {
  let mockResourceService: any;
  let mockGatewayService: any;
  let envConfigServiceMock: MockedObject<EnvConfigService>;
  let accountInfoServiceMock: MockedObject<AccountInfoService>;
  let errorHandlerServiceMock: MockedObject<ErrorHandlerService>;
  let addCoreSearchParams: ReturnType<typeof vi.fn>;
  let configChanged: ReturnType<typeof vi.fn>;
  let namespaceServiceMock: MockedObject<NamespaceService>;

  beforeEach(() => {
    envConfigServiceMock = mock();
    accountInfoServiceMock = mock();
    errorHandlerServiceMock = mock();
    mockResourceService = {
      read: vi.fn().mockReturnValue(of({ name: 'test-resource' })),
      readAccountInfo: vi.fn().mockReturnValue(of('mock-ca-data')),
      getNamespace: vi.fn((context) => context.namespaceId),
    };
    mockGatewayService = {
      resolveKcpPath: vi.fn().mockReturnValue('https://example.com'),
    };
    addCoreSearchParams = vi.fn();
    configChanged = vi.fn();
    namespaceServiceMock = mock();

    TestBed.configureTestingModule({
      providers: [
        { provide: ResourceService, useValue: mockResourceService },
        { provide: GatewayService, useValue: mockGatewayService },
        { provide: EnvConfigService, useValue: envConfigServiceMock },
        { provide: AccountInfoService, useValue: accountInfoServiceMock },
        { provide: ErrorHandlerService, useValue: errorHandlerServiceMock },
        {
          provide: LuigiCoreService,
          useValue: { configChanged },
        },
        { provide: NamespaceService, useValue: namespaceServiceMock },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).overrideComponent(DetailView, {
      set: { imports: [NgTemplateOutlet], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
  });

  const loadedResource = { metadata: { name: 'cluster-1' } };

  function createReactiveDetail(contextOverrides: object = {}) {
    const fixture = TestBed.createComponent(DetailView);
    const context = {
      resourceId: 'cluster-1',
      kcpPath: 'root:orgs:example:first',
      resourceDefinition: {
        version: 'v1',
        entity: 'Cluster',
        entityCollection: 'clusters',
        apiGroup: 'core_k8s_io',
        ui: { detailView: { fields: [], showDownloadKubeconfig: true } },
      },
      parentNavigationContexts: ['project'],
      ...contextOverrides,
    };
    const navigate = vi.fn();
    const showAlert = vi.fn();
    fixture.componentRef.setInput('context', context);
    fixture.componentRef.setInput('LuigiClient', {
      addCoreSearchParams,
      linkManager: () => ({ fromContext: () => ({ navigate }) }),
      uxManager: () => ({ showAlert }),
      getActiveFeatureToggles: () => [],
    });
    fixture.detectChanges();
    const find = (selector: string) =>
      fixture.nativeElement.querySelector(selector);
    return {
      fixture,
      component: fixture.componentInstance,
      context,
      navigate,
      showAlert,
      find,
    };
  }

  it('renders loading without resource actions, then recovers through the retry button', () => {
    const initial = new Subject<any>();
    const retry = new Subject<any>();
    mockResourceService.read
      .mockReturnValueOnce(initial)
      .mockReturnValueOnce(retry);
    const { fixture, component, find } = createReactiveDetail();

    expect(find('mfp-dashboard').loading).toBe(true);
    expect(component.customActions()).toEqual([]);
    expect(find('[data-testid="generic-detail-view-read-state"]')).toBeNull();
    initial.error(new Error('Gateway unavailable'));
    fixture.detectChanges();

    expect(find('mfp-dashboard')).toBeNull();
    expect(find('ui5-illustrated-message').titleText).toBe(
      'Could not load resource',
    );
    expect(errorHandlerServiceMock.handleError).not.toHaveBeenCalled();
    find('[data-testid="generic-detail-view-retry"]').click();
    component.retryRead();
    fixture.detectChanges();
    expect(mockResourceService.read).toHaveBeenCalledTimes(2);
    expect(find('mfp-dashboard').loading).toBe(true);
    expect(find('[data-testid="generic-detail-view-retry"]')).toBeNull();
    expect(component.resource()).toBeUndefined();

    retry.next(loadedResource);
    retry.complete();
    fixture.detectChanges();
    expect(find('mfp-dashboard').loading).toBe(false);
    expect(component.resource()).toEqual(loadedResource);
    expect(component.customActions().map((action) => action.action)).toContain(
      'download-kubeconfig',
    );
    component.retryRead();
    expect(mockResourceService.read).toHaveBeenCalledTimes(2);
  });

  it.each([
    { name: 'null', response: of(null) },
    { name: 'undefined', response: of(undefined) },
    { name: 'no emission', response: EMPTY },
  ])(
    'renders a distinct not-found state for $name and lets the user retry',
    ({ response }) => {
      mockResourceService.read
        .mockReturnValueOnce(response)
        .mockReturnValueOnce(of(loadedResource));
      const { fixture, component, find, navigate } = createReactiveDetail();

      expect(find('mfp-dashboard')).toBeNull();
      expect(find('ui5-illustrated-message').name).toBe('NoEntries');
      expect(find('ui5-illustrated-message').titleText).toBe(
        'Resource not found',
      );
      expect(component.resource()).toBeUndefined();
      expect(component.customActions()).toEqual([]);
      find('ui5-button:last-child').click();
      expect(navigate).toHaveBeenCalledWith('/');
      find('[data-testid="generic-detail-view-retry"]').click();
      fixture.detectChanges();
      expect(component.resource()).toEqual(loadedResource);
      expect(find('ui5-illustrated-message')).toBeNull();
    },
  );

  it('preserves authorization handling without presenting a retryable error', () => {
    const error = new Error('Forbidden');
    errorHandlerServiceMock.redirectToErrorPage.mockReturnValue(true);
    mockResourceService.read.mockReturnValue(throwError(() => error));
    const { component, find } = createReactiveDetail();

    expect(errorHandlerServiceMock.redirectToErrorPage).toHaveBeenCalledWith(
      error,
    );
    expect(find('mfp-dashboard')).toBeNull();
    expect(find('ui5-illustrated-message')).toBeNull();
    expect(component.customActions()).toEqual([]);
    component.retryRead();
    expect(mockResourceService.read).toHaveBeenCalledTimes(1);
  });

  it('preserves the pending-deletion redirect and keeps resource actions hidden', () => {
    const pending = {
      metadata: {
        name: 'cluster-1',
        deletionTimestamp: '2026-09-07T12:00:00Z',
      },
    };
    mockResourceService.read.mockReturnValue(of(pending));
    const { component, find } = createReactiveDetail();

    expect(
      errorHandlerServiceMock.handleResourcePendingDeletion,
    ).toHaveBeenCalledWith(pending);
    expect(component.resource()).toBeUndefined();
    expect(component.customActions()).toEqual([]);
    expect(find('mfp-dashboard')).toBeNull();
  });

  it('hides old actions immediately and cancels the active retry when context changes', () => {
    const initial = new Subject<any>();
    const retry = new Subject<any>();
    const current = new Subject<any>();
    mockResourceService.read
      .mockReturnValueOnce(initial)
      .mockReturnValueOnce(retry)
      .mockReturnValueOnce(current);
    const { fixture, component, context, find } = createReactiveDetail();
    initial.error(new Error('Gateway unavailable'));
    component.retryRead();
    retry.next(loadedResource);
    expect(component.customActions()).not.toEqual([]);
    const download = vi.spyOn(component, 'downloadKubeConfig');

    fixture.componentRef.setInput('context', {
      ...context,
      resourceId: 'cluster-2',
      kcpPath: 'root:orgs:example:second',
    });
    expect(component.customActions()).toEqual([]);
    component.onActionButtonClick({
      event: new MouseEvent('click'),
      action: { action: 'download-kubeconfig' },
    });
    expect(download).not.toHaveBeenCalled();
    retry.next({ metadata: { name: 'stale' } });
    expect(component.resource()).toEqual(loadedResource);
    fixture.detectChanges();

    expect(retry.observed).toBe(false);
    expect(current.observed).toBe(true);
    expect(component.resource()).toBeUndefined();
    expect(find('mfp-dashboard').loading).toBe(true);
    current.next({ metadata: { name: 'cluster-2' } });
    current.complete();
    fixture.detectChanges();
    expect(component.resource()?.metadata.name).toBe('cluster-2');
    expect(find('mfp-dashboard').loading).toBe(false);
  });

  it.each([false, true])(
    'ignores a stale read error before cleanup (forbidden=%s)',
    (forbidden) => {
      const oldRead = new Subject<any>();
      const current = new Subject<any>();
      mockResourceService.read
        .mockReturnValueOnce(oldRead)
        .mockReturnValueOnce(current);
      errorHandlerServiceMock.redirectToErrorPage.mockReturnValue(forbidden);
      const { fixture, component, context, find } = createReactiveDetail();

      fixture.componentRef.setInput('context', {
        ...context,
        resourceId: 'cluster-2',
      });
      oldRead.error(new Error('Forbidden'));
      expect(
        errorHandlerServiceMock.redirectToErrorPage,
      ).not.toHaveBeenCalled();
      expect(component.customActions()).toEqual([]);
      fixture.detectChanges();
      expect(find('mfp-dashboard').loading).toBe(true);
      expect(find('ui5-illustrated-message')).toBeNull();
    },
  );

  it('cancels a retry on destruction', () => {
    const retry = new Subject<any>();
    mockResourceService.read
      .mockReturnValueOnce(throwError(() => new Error('Gateway unavailable')))
      .mockReturnValueOnce(retry);
    const { fixture, component } = createReactiveDetail();
    component.retryRead();
    expect(retry.observed).toBe(true);
    fixture.destroy();
    expect(retry.observed).toBe(false);
    retry.next(loadedResource);
    expect(component.resource()).toBeUndefined();
  });

  describe('namespaced resource', () => {
    const namespacedDefinition = {
      version: 'v1alpha1',
      entity: 'HttpBin',
      entityCollection: 'HttpBins',
      apiGroup: 'orchestrate_platform_mesh_io',
      scope: 'Namespaced',
      ui: { detailView: { fields: [] } },
    };
    const missingNamespaceError = new Error(
      'missing required argument: namespace',
    );

    function selectNamespace(
      find: (selector: string) => any,
      namespace: string,
    ) {
      find(
        '[data-testid="generic-detail-view-namespace-select"]',
      ).dispatchEvent(
        new CustomEvent('ui5Change', {
          detail: { selectedOption: { value: namespace } },
        }),
      );
    }

    it('asks for a namespace and disables retry until one is selected when the namespace is missing', () => {
      mockResourceService.read.mockReturnValue(
        throwError(() => missingNamespaceError),
      );
      const { fixture, component, find } = createReactiveDetail({
        resourceDefinition: namespacedDefinition,
        namespaces: ['team-a', 'team-b'],
      });
      fixture.detectChanges();

      expect(find('ui5-illustrated-message').subtitleText).toBe(
        'Select a namespace and try again.',
      );
      expect(
        [
          ...fixture.nativeElement.querySelectorAll(
            '[data-testid^="generic-detail-view-namespace-option-"]',
          ),
        ].map((option: any) => option.value),
      ).toEqual(['team-a', 'team-b']);
      expect(find('[data-testid="generic-detail-view-retry"]').disabled).toBe(
        true,
      );

      component.retryRead();
      expect(configChanged).not.toHaveBeenCalled();

      selectNamespace(find, 'team-b');
      fixture.detectChanges();
      expect(addCoreSearchParams).toHaveBeenCalledWith(
        { namespace: 'team-b' },
        false,
        true,
      );
      expect(configChanged).not.toHaveBeenCalled();
      expect(mockResourceService.read).toHaveBeenCalledTimes(1);
      expect(find('[data-testid="generic-detail-view-retry"]').disabled).toBe(
        false,
      );

      find('[data-testid="generic-detail-view-retry"]').click();
      expect(configChanged).toHaveBeenCalledTimes(1);
      expect(mockResourceService.read).toHaveBeenCalledTimes(1);
    });

    it('removes the namespace parameter and disables retry again when the placeholder is selected', () => {
      mockResourceService.read.mockReturnValue(
        throwError(() => missingNamespaceError),
      );
      const { fixture, find } = createReactiveDetail({
        resourceDefinition: namespacedDefinition,
        namespaces: ['team-a'],
      });
      fixture.detectChanges();

      selectNamespace(find, 'team-a');
      selectNamespace(find, '');
      fixture.detectChanges();

      expect(find('[data-testid="generic-detail-view-retry"]').disabled).toBe(
        true,
      );
      expect(addCoreSearchParams).toHaveBeenLastCalledWith(
        { namespace: undefined },
        false,
        true,
      );
    });

    it('renders the namespace select without options when the context has no namespaces', () => {
      mockResourceService.read.mockReturnValue(
        throwError(() => missingNamespaceError),
      );
      const { fixture, find } = createReactiveDetail({
        resourceDefinition: namespacedDefinition,
      });
      fixture.detectChanges();

      expect(
        find('[data-testid="generic-detail-view-namespace-select"]'),
      ).not.toBeNull();
      expect(
        find('[data-testid^="generic-detail-view-namespace-option-"]'),
      ).toBeNull();
    });

    it('replaces the namespace options with the refreshed namespaces', () => {
      mockResourceService.read.mockReturnValue(
        throwError(() => missingNamespaceError),
      );
      namespaceServiceMock.list.mockReturnValue(of(['team-a', 'team-c']));
      const { fixture, context, find } = createReactiveDetail({
        resourceDefinition: namespacedDefinition,
      });
      fixture.detectChanges();

      find('[data-testid="generic-detail-view-namespace-refresh"]').click();
      fixture.detectChanges();

      expect(namespaceServiceMock.list).toHaveBeenCalledWith(
        expect.objectContaining({ kcpPath: context.kcpPath }),
      );
      expect(
        [
          ...fixture.nativeElement.querySelectorAll(
            '[data-testid^="generic-detail-view-namespace-option-"]',
          ),
        ].map((option: any) => option.value),
      ).toEqual(['team-a', 'team-c']);
      expect(errorHandlerServiceMock.showError).not.toHaveBeenCalled();
    });

    it('alerts a failed namespace refresh and keeps the namespace options', () => {
      const error = new Error('list failed');
      mockResourceService.read.mockReturnValue(
        throwError(() => missingNamespaceError),
      );
      namespaceServiceMock.list.mockReturnValue(throwError(() => error));
      const { fixture, find } = createReactiveDetail({
        resourceDefinition: namespacedDefinition,
        namespaces: ['team-a'],
      });
      fixture.detectChanges();

      find('[data-testid="generic-detail-view-namespace-refresh"]').click();
      fixture.detectChanges();

      expect(errorHandlerServiceMock.showError).toHaveBeenCalledWith(
        error,
        'Failed to read namespaces.',
      );
      expect(
        find('[data-testid="generic-detail-view-namespace-option-team-a"]'),
      ).not.toBeNull();
    });

    it('retries the read without a namespace select when the namespace is known', () => {
      mockResourceService.read
        .mockReturnValueOnce(throwError(() => new Error('Gateway unavailable')))
        .mockReturnValueOnce(of(loadedResource));
      const { fixture, component, find } = createReactiveDetail({
        resourceDefinition: namespacedDefinition,
        namespaceId: 'team-b',
        namespaces: ['team-a', 'team-b'],
      });
      fixture.detectChanges();

      expect(find('ui5-illustrated-message').subtitleText).toBe(
        'Please try again.',
      );
      expect(
        find('[data-testid="generic-detail-view-namespace-select"]'),
      ).toBeNull();
      expect(find('[data-testid="generic-detail-view-retry"]').disabled).toBe(
        false,
      );

      find('[data-testid="generic-detail-view-retry"]').click();
      fixture.detectChanges();

      expect(configChanged).not.toHaveBeenCalled();
      expect(mockResourceService.read).toHaveBeenCalledTimes(2);
      expect(component.resource()).toEqual(loadedResource);
    });
  });

  it('should not render download button when disabled', () => {
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;

    component.context = signal({
      resourceId: 'cluster-1',
      token: 'abc123',
      accountPath: 'account-123',
      accountId: 'account-123',
      organization: 'org-123',
      kcpCA: 'kcp-ca-data',
      resourceDefinition: {
        version: 'v1alpha1',
        entity: 'Cluster',
        entityCollection: 'clusters',
        apiGroup: 'core_k8s_io',
        ui: {
          detailView: {
            fields: [],
          },
        },
      },
      portalContext: { kcpWorkspaceUrl: 'https://example.com' },
      entityName: 'test-resource',
      parentNavigationContexts: ['project'],
    }) as any;

    component.LuigiClient = (() => ({
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
        withParams: vi.fn().mockReturnThis(),
      }),
      uxManager: () => ({
        showAlert: vi.fn(),
      }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
    })) as any;

    fixture.detectChanges();

    const el = fixture.nativeElement.shadowRoot?.querySelector(
      '[data-testid="generic-detail-view-download"]',
    );
    expect(el).toBeFalsy();
  });
});

describe('DetailViewComponent — instancePermissions and canDoAction', () => {
  let mockResourceService: any;
  let mockGatewayService: any;
  let envConfigServiceMock: MockedObject<EnvConfigService>;
  let accountInfoServiceMock: MockedObject<AccountInfoService>;
  let errorHandlerServiceMock: MockedObject<ErrorHandlerService>;

  const makeContextWithPermissions = (
    resource: string | undefined,
    name: string,
    portalPermissions: Record<string, string[]>,
  ) =>
    signal({
      resourceId: name,
      token: 'abc123',
      portalPermissions,
      resourceDefinition: {
        version: 'v1alpha1',
        entity: 'Cluster',
        entityCollection: 'clusters',
        apiGroup: 'core_k8s_io',
        ...(resource
          ? {
              permissionsDefinition: {
                group: 'core.k8s.io',
                resource,
                entityActions: ['get', 'update', 'delete'],
                resourceActions: [],
                entityContextKey: 'entityName',
              },
            }
          : {}),
        ui: { detailView: { fields: [] } },
      },
      entityName: name,
      parentNavigationContexts: ['project'],
    }) as any;

  const makeLuigiClient = () =>
    (() => ({
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
        withParams: vi.fn().mockReturnThis(),
      }),
      uxManager: () => ({ showAlert: vi.fn() }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
    })) as any;

  beforeEach(() => {
    envConfigServiceMock = mock();
    accountInfoServiceMock = mock();
    errorHandlerServiceMock = mock();
    mockResourceService = {
      read: vi.fn().mockReturnValue(of({ metadata: { name: 'c1' } })),
      readAccountInfo: vi.fn().mockReturnValue(of('mock-ca-data')),
      delete: vi.fn().mockReturnValue(of({})),
      update: vi.fn().mockReturnValue(of({})),
      getNamespace: vi.fn((context) => context.namespaceId),
    };
    mockGatewayService = {
      resolveKcpPath: vi.fn().mockReturnValue('https://example.com'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ResourceService, useValue: mockResourceService },
        { provide: AccountInfoService, useValue: accountInfoServiceMock },
        { provide: GatewayService, useValue: mockGatewayService },
        { provide: EnvConfigService, useValue: envConfigServiceMock },
        { provide: ErrorHandlerService, useValue: errorHandlerServiceMock },
      ],
    }).overrideComponent(DetailView, {
      set: { template: '<div></div>' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show edit and delete when instancePermissions allows update and delete', () => {
    // permissionKey({ resource: 'clusters', name: 'c1' }) = 'clusters/c1'
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContextWithPermissions('clusters', 'c1', {
      'clusters/c1': ['get', 'update', 'delete'],
    });
    component.LuigiClient = makeLuigiClient();
    fixture.detectChanges();
    component.resource.set({ metadata: { name: 'c1' } } as any);
    const actions = component.customActions();
    expect(actions.some((a) => a.action === 'edit')).toBe(true);
    expect(actions.some((a) => a.action === 'delete')).toBe(true);
  });

  it('should hide edit action when instancePermissions does not include update', () => {
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContextWithPermissions('clusters', 'c1', {
      'clusters/c1': ['get', 'delete'],
    });
    component.LuigiClient = makeLuigiClient();
    fixture.detectChanges();
    component.resource.set({ metadata: { name: 'c1' } } as any);
    const actions = component.customActions();
    expect(actions.some((a) => a.action === 'edit')).toBe(false);
    expect(actions.some((a) => a.action === 'delete')).toBe(true);
  });

  it('should hide delete action when instancePermissions does not include delete', () => {
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContextWithPermissions('clusters', 'c1', {
      'clusters/c1': ['get', 'update'],
    });
    component.LuigiClient = makeLuigiClient();
    fixture.detectChanges();
    component.resource.set({ metadata: { name: 'c1' } } as any);
    const actions = component.customActions();
    expect(actions.some((a) => a.action === 'edit')).toBe(true);
    expect(actions.some((a) => a.action === 'delete')).toBe(false);
  });

  it('should show edit and delete when no permissionsDefinition (defaults to allowed)', () => {
    // No permissionsDefinition — instancePermissions returns undefined → canDoAction returns true
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContextWithPermissions(undefined, 'c1', {});
    component.LuigiClient = makeLuigiClient();
    fixture.detectChanges();
    component.resource.set({ metadata: { name: 'c1' } } as any);
    const actions = component.customActions();
    expect(actions.some((a) => a.action === 'edit')).toBe(true);
    expect(actions.some((a) => a.action === 'delete')).toBe(true);
  });

  it('should include namespace in permissionKey lookup for namespaced resource', () => {
    // permissionKey({ resource: 'clusters', namespace: 'ns1', name: 'pod-1' }) = 'clusters/ns1/pod-1'
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContextWithPermissions('clusters', 'pod-1', {
      'clusters/ns1/pod-1': ['get', 'update', 'delete'],
    });
    component.LuigiClient = makeLuigiClient();
    fixture.detectChanges();
    component.resource.set({
      metadata: { name: 'pod-1', namespace: 'ns1' },
    } as any);
    const actions = component.customActions();
    expect(actions.some((a) => a.action === 'edit')).toBe(true);
    expect(actions.some((a) => a.action === 'delete')).toBe(true);
  });

  it('should default to allowed when portalPermissions key does not match (fail-open)', () => {
    // Key mismatch: portalPermissions has cluster-scoped key but resource has namespace
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContextWithPermissions('clusters', 'pod-1', {
      'clusters/pod-1': ['get', 'update', 'delete'],
    });
    component.LuigiClient = makeLuigiClient();
    fixture.detectChanges();
    // resource with namespace: key becomes 'clusters/ns1/pod-1' — not found in map
    component.resource.set({
      metadata: { name: 'pod-1', namespace: 'ns1' },
    } as any);
    const actions = component.customActions();
    // instancePermissions() returns undefined → canDoAction defaults to true (fail-open)
    expect(actions.some((a) => a.action === 'edit')).toBe(true);
  });
});

describe('DetailViewComponent — namespace repair from route path params', () => {
  let mockResourceService: any;
  let mockGatewayService: any;
  let envConfigServiceMock: MockedObject<EnvConfigService>;
  let accountInfoServiceMock: MockedObject<AccountInfoService>;
  let errorHandlerServiceMock: MockedObject<ErrorHandlerService>;
  let kubeconfigSecretServiceMock: MockedObject<KubeconfigSecretService>;

  const makeContext = (overrides: Record<string, unknown> = {}) =>
    signal({
      resourceId: 'claim-1',
      token: 'abc123',
      resourceDefinition: {
        version: 'v1',
        entity: 'ShootClaim',
        entityCollection: 'shootclaims',
        apiGroup: 'gardener_t_systems_com',
        scope: 'Namespaced',
        ui: { detailView: { fields: [] } },
      },
      entityName: 'claim-1',
      parentNavigationContexts: ['project'],
      ...overrides,
    }) as any;

  const makeLuigiClient = (getPathParams?: () => Record<string, string>) =>
    (() => ({
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
        withParams: vi.fn().mockReturnThis(),
      }),
      uxManager: () => ({ showAlert: vi.fn() }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
      ...(getPathParams ? { getPathParams } : {}),
    })) as any;

  beforeEach(() => {
    envConfigServiceMock = mock();
    accountInfoServiceMock = mock();
    errorHandlerServiceMock = mock();
    kubeconfigSecretServiceMock = mock();
    mockResourceService = {
      read: vi.fn().mockReturnValue(of({ metadata: { name: 'claim-1' } })),
      readAccountInfo: vi.fn().mockReturnValue(of('mock-ca-data')),
      delete: vi.fn().mockReturnValue(of({})),
      update: vi.fn().mockReturnValue(of({})),
      getNamespace: vi.fn((context) => context.namespaceId),
    };
    mockGatewayService = {
      resolveKcpPath: vi.fn().mockReturnValue('https://example.com'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ResourceService, useValue: mockResourceService },
        { provide: AccountInfoService, useValue: accountInfoServiceMock },
        { provide: GatewayService, useValue: mockGatewayService },
        {
          provide: KubeconfigSecretService,
          useValue: kubeconfigSecretServiceMock,
        },
        { provide: EnvConfigService, useValue: envConfigServiceMock },
        { provide: ErrorHandlerService, useValue: errorHandlerServiceMock },
      ],
    }).overrideComponent(DetailView, {
      set: { template: '<div></div>' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should read with the namespaceId recovered from the path params when nothing else resolves', () => {
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContext();
    component.LuigiClient = makeLuigiClient(() => ({
      namespaceId: 'team-a',
      shootclaimId: 'claim-1',
    }));
    fixture.detectChanges();

    expect(mockResourceService.read).toHaveBeenCalled();
    const readContext = mockResourceService.read.mock.calls[0][3];
    expect(readContext.namespaceId).toBe('team-a');
  });

  it('should not adopt the -all- sentinel from the path params', () => {
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContext();
    component.LuigiClient = makeLuigiClient(() => ({ namespaceId: '-all-' }));
    fixture.detectChanges();

    const readContext = mockResourceService.read.mock.calls[0][3];
    expect(readContext.namespaceId).toBeUndefined();
  });

  it('should tolerate a Luigi client without getPathParams', () => {
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContext();
    component.LuigiClient = makeLuigiClient();
    fixture.detectChanges();

    expect(mockResourceService.read).toHaveBeenCalled();
    const readContext = mockResourceService.read.mock.calls[0][3];
    expect(readContext.namespaceId).toBeUndefined();
  });

  it('should keep the original context when it already resolves a namespace', () => {
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContext({ namespaceId: 'ns1' });
    component.LuigiClient = makeLuigiClient(() => ({ namespaceId: 'team-a' }));
    fixture.detectChanges();

    const readContext = mockResourceService.read.mock.calls[0][3];
    expect(readContext).toBe(component.context());
  });

  it('should keep the original context for cluster-scoped resources', () => {
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    const context = makeContext();
    context.set({
      ...context(),
      resourceDefinition: {
        ...context().resourceDefinition,
        scope: 'Cluster',
      },
    });
    component.context = context;
    component.LuigiClient = makeLuigiClient(() => ({ namespaceId: 'team-a' }));
    fixture.detectChanges();

    const readContext = mockResourceService.read.mock.calls[0][3];
    expect(readContext).toBe(component.context());
  });

  it('should keep the permission lookup keyed on the raw context in the repaired flow', () => {
    // The host seeds portalPermissions with the namespace it resolved itself
    // (none on a bare deep link), so the lookup key must not adopt the
    // route-recovered namespace — otherwise gating silently falls open.
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContext({
      portalPermissions: { 'shootclaims/claim-1': ['get'] },
      resourceDefinition: {
        version: 'v1',
        entity: 'ShootClaim',
        entityCollection: 'shootclaims',
        apiGroup: 'gardener_t_systems_com',
        scope: 'Namespaced',
        permissionsDefinition: {
          group: 'gardener.t-systems.com',
          resource: 'shootclaims',
          entityActions: ['get', 'update', 'delete'],
          resourceActions: [],
          entityContextKey: 'entityName',
        },
        ui: { detailView: { fields: [] } },
      },
    });
    component.LuigiClient = makeLuigiClient(() => ({ namespaceId: 'team-a' }));
    fixture.detectChanges();
    component.resource.set({ metadata: { name: 'claim-1' } } as any);

    const actions = component.customActions();
    expect(actions.some((a) => a.action === 'edit')).toBe(false);
    expect(actions.some((a) => a.action === 'delete')).toBe(false);
  });

  it('should pass the repaired context to delete', () => {
    const fixture = TestBed.createComponent(DetailView);
    const component = fixture.componentInstance;
    component.context = makeContext();
    component.LuigiClient = makeLuigiClient(() => ({ namespaceId: 'team-a' }));
    fixture.detectChanges();

    component.delete({ metadata: { name: 'claim-1' } } as any);

    expect(mockResourceService.delete).toHaveBeenCalled();
    const deleteContext = mockResourceService.delete.mock.calls[0][2];
    expect(deleteContext.namespaceId).toBe('team-a');
  });
});
