import { PortalNodeContext } from '../models/luigi-context';
import { PortalLuigiNode } from '../models/luigi-node';
import { CrdGatewayKcpPatchResolver } from './crd-gateway-kcp-patch-resolver.service';
import { NodeContextProcessingServiceImpl } from './node-context-processing.service';
import { TestBed } from '@angular/core/testing';
import { LuigiCoreService } from '@openmfp/portal-ui-lib';
import {
  AccountInfo,
  PermissionsDefinition,
} from '@platform-mesh/portal-ui-lib/models';
import {
  AccountInfoService,
  ErrorHandlerService,
  InstancePermissionsService,
  NamespaceService,
  OrganizationReadyService,
} from '@platform-mesh/portal-ui-lib/services';
import { of, throwError } from 'rxjs';
import { MockedObject } from 'vitest';
import { mock } from 'vitest-mock-extended';

describe('NodeContextProcessingServiceImpl', () => {
  let service: NodeContextProcessingServiceImpl;
  let crdGatewayKcpPatchResolver: MockedObject<CrdGatewayKcpPatchResolver>;
  let accountInfoService: MockedObject<AccountInfoService>;
  let organizationReadyService: MockedObject<OrganizationReadyService>;
  let instancePermissionsService: MockedObject<InstancePermissionsService>;
  let luigiCoreService: MockedObject<LuigiCoreService>;
  let errorHandlerService: MockedObject<ErrorHandlerService>;
  let namespaceService: MockedObject<NamespaceService>;

  const mockEntityId = 'entity-123';
  const mockKind = 'account';
  const mockKcpPath = 'root:orgs:test-org:entity-123';
  const mockAccountPath = '/test-org/entity-123';
  const mockToken = 'test-token';

  let mockEntityNode: PortalLuigiNode;
  let mockContext: PortalNodeContext;

  const mockAccountInfo: AccountInfo = {
    spec: {
      organization: {
        originClusterId: 'cluster-org-1',
        name: 'test-org',
      },
      clusterInfo: {
        ca: 'certificate-data',
      },
      account: {
        originClusterId: 'cluster-acc-1',
      },
    },
  } as AccountInfo;

  beforeEach(() => {
    crdGatewayKcpPatchResolver = mock<CrdGatewayKcpPatchResolver>();
    accountInfoService = mock<AccountInfoService>();
    organizationReadyService = mock<OrganizationReadyService>();
    instancePermissionsService = mock<InstancePermissionsService>();
    luigiCoreService = mock<LuigiCoreService>();
    errorHandlerService = mock<ErrorHandlerService>();
    namespaceService = mock<NamespaceService>();

    // Default: checkInstance returns an empty array
    instancePermissionsService.checkInstance.mockReturnValue(of([]));
    // Default: routing().getSearchParams() returns empty object
    luigiCoreService.routing.mockReturnValue({
      getSearchParams: () => ({}),
    } as any);

    mockEntityNode = {
      defineEntity: {
        type: 'account',
      },
      context: {},
    } as PortalLuigiNode;

    mockContext = {
      portalContext: {
        crdGatewayApiUrl: 'https://api.example.com',
      },
      token: mockToken,
    } as PortalNodeContext;

    TestBed.configureTestingModule({
      providers: [
        NodeContextProcessingServiceImpl,
        {
          provide: CrdGatewayKcpPatchResolver,
          useValue: crdGatewayKcpPatchResolver,
        },
        { provide: AccountInfoService, useValue: accountInfoService },
        {
          provide: OrganizationReadyService,
          useValue: organizationReadyService,
        },
        {
          provide: InstancePermissionsService,
          useValue: instancePermissionsService,
        },
        { provide: LuigiCoreService, useValue: luigiCoreService },
        { provide: ErrorHandlerService, useValue: errorHandlerService },
        { provide: NamespaceService, useValue: namespaceService },
      ],
    });

    service = TestBed.inject(NodeContextProcessingServiceImpl);

    crdGatewayKcpPatchResolver.resolveCrdGatewayKcpPath.mockResolvedValue({
      kcpPath: mockKcpPath,
      accountPath: mockAccountPath,
    });
    accountInfoService.read.mockReturnValue(of(mockAccountInfo));
    organizationReadyService.isOrganizationReady.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('processNodeContext', () => {
    it('should return early when entityId is missing', async () => {
      await service.processNodeContext('', mockEntityNode, mockContext);

      expect(
        crdGatewayKcpPatchResolver.resolveCrdGatewayKcpPath,
      ).not.toHaveBeenCalled();
      expect(accountInfoService.read).not.toHaveBeenCalled();
    });

    it('should return early when entityId is null', async () => {
      await service.processNodeContext(
        null as any,
        mockEntityNode,
        mockContext,
      );

      expect(
        crdGatewayKcpPatchResolver.resolveCrdGatewayKcpPath,
      ).not.toHaveBeenCalled();
    });

    it('should call resolveCrdGatewayKcpPath with correct parameters', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(
        crdGatewayKcpPatchResolver.resolveCrdGatewayKcpPath,
      ).toHaveBeenCalledWith(mockEntityNode, mockEntityId, mockKind);
    });

    it('should update context with kcpPath', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(mockContext.kcpPath).toBe(mockKcpPath);
    });

    it('should update context with entityName', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(mockContext.entityName).toBe(mockEntityId);
    });

    it('should update context with entityKind', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(mockContext.entityKind).toBe(mockKind);
    });

    it('should update context with accountPath', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(mockContext.accountPath).toBe(mockAccountPath);
    });

    it('should update entityNode context with same fields', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(mockEntityNode.context.kcpPath).toBe(mockKcpPath);
      expect(mockEntityNode.context.entityName).toBe(mockEntityId);
      expect(mockEntityNode.context.entityKind).toBe(mockKind);
      expect(mockEntityNode.context.accountPath).toBe(mockAccountPath);
    });

    it('should call accountInfoService.read with correct parameters', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(accountInfoService.read).toHaveBeenCalledWith({
        portalContext: {
          crdGatewayApiUrl: 'https://api.example.com',
        },
        token: mockToken,
        accountId: mockEntityId,
      });
    });

    it('should update context with organizationId from accountInfo', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(mockContext.organizationId).toBe('cluster-org-1/test-org');
    });

    it('should update context with base64 encoded kcpCA', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      const expectedCA = btoa('certificate-data');
      expect(mockContext.kcpCA).toBe(expectedCA);
    });

    it('should update context with entityId from accountInfo', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(mockContext.entityId).toBe(`cluster-acc-1/${mockEntityId}`);
    });

    it('should not update accountInfo fields when read fails', async () => {
      const mockContext = {
        portalContext: {
          crdGatewayApiUrl: 'https://api.example.com',
        },
        token: mockToken,
      } as any as PortalNodeContext;
      accountInfoService.read.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(mockContext.organizationId).toBeUndefined();
      expect(mockContext.kcpCA).toBeUndefined();
      expect(mockContext.entityId).toBeUndefined();
    });

    it('should update entityNode context with accountInfo fields', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(mockEntityNode.context.organizationId).toBe(
        'cluster-org-1/test-org',
      );
      expect(mockEntityNode.context.kcpCA).toBe(btoa('certificate-data'));
      expect(mockEntityNode.context.entityId).toBe(
        `cluster-acc-1/${mockEntityId}`,
      );
    });

    it('should check the organization when accountInfo is retrieved', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(organizationReadyService.isOrganizationReady).toHaveBeenCalled();
      expect(mockContext.entityErrorCode).toBeUndefined();
    });

    it('should record 503 on the context when the organization is not ready', async () => {
      organizationReadyService.isOrganizationReady.mockResolvedValue(false);

      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(mockContext.entityErrorCode).toBe(503);
    });

    it('should record the code of an accountInfoService error on the context and resolve', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('API error');
      accountInfoService.read.mockReturnValue(throwError(() => error));
      errorHandlerService.errorCode.mockReturnValue(404);

      await expect(
        service.processNodeContext(mockEntityId, mockEntityNode, mockContext),
      ).resolves.not.toThrow();

      expect(errorHandlerService.errorCode).toHaveBeenCalledWith(error);
      expect(mockContext.entityErrorCode).toBe(404);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to read account info.',
        error,
      );
      expect(
        organizationReadyService.isOrganizationReady,
      ).not.toHaveBeenCalled();
    });

    it('should not alert or keep the failure on the entity node when the accountInfoService fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      accountInfoService.read.mockReturnValue(
        throwError(() => new Error('API error')),
      );
      errorHandlerService.errorCode.mockReturnValue(500);

      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(errorHandlerService.handleError).not.toHaveBeenCalled();
      expect(mockEntityNode.context.entityErrorCode).toBeUndefined();
    });

    it('should not process an entity below an already failed entity', async () => {
      await service.processNodeContext(mockEntityId, mockEntityNode, {
        ...mockContext,
        entityErrorCode: 404,
      });

      expect(
        crdGatewayKcpPatchResolver.resolveCrdGatewayKcpPath,
      ).not.toHaveBeenCalled();
      expect(accountInfoService.read).not.toHaveBeenCalled();
    });

    it('should handle special characters in CA certificate', async () => {
      const specialCA = 'cert+with/special=chars';
      const accountInfoWithSpecialCA: AccountInfo = {
        spec: {
          organization: {
            originClusterId: 'cluster-org-1',
          },
          clusterInfo: {
            ca: specialCA,
          },
          account: {
            originClusterId: 'cluster-acc-1',
          },
        },
      } as AccountInfo;

      accountInfoService.read.mockReturnValue(of(accountInfoWithSpecialCA));

      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(mockContext.kcpCA).toBe(btoa(specialCA));
    });

    it('should process all steps in sequence', async () => {
      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        mockContext,
      );

      expect(
        crdGatewayKcpPatchResolver.resolveCrdGatewayKcpPath,
      ).toHaveBeenCalled();
      expect(accountInfoService.read).toHaveBeenCalled();
      expect(organizationReadyService.isOrganizationReady).toHaveBeenCalled();
    });

    it('should handle empty entityNode context', async () => {
      const nodeWithEmptyContext: PortalLuigiNode = {
        defineEntity: {
          type: mockKind,
        },
        context: {},
      } as PortalLuigiNode;

      await service.processNodeContext(
        mockEntityId,
        nodeWithEmptyContext,
        mockContext,
      );

      expect(nodeWithEmptyContext.context.kcpPath).toBe(mockKcpPath);
    });

    it('should preserve existing context fields', async () => {
      const contextWithExistingFields = {
        ...mockContext,
        customField: 'custom-value',
      };

      await service.processNodeContext(
        mockEntityId,
        mockEntityNode,
        contextWithExistingFields,
      );

      expect((contextWithExistingFields as any).customField).toBe(
        'custom-value',
      );
    });

    it('should handle different kind values', async () => {
      const differentKind = 'Organization';
      const nodeWithDifferentKind: PortalLuigiNode = {
        defineEntity: {
          type: differentKind,
        },
        context: {},
      } as PortalLuigiNode;

      await service.processNodeContext(
        mockEntityId,
        nodeWithDifferentKind,
        mockContext,
      );

      expect(mockContext.entityKind).toBe(differentKind);
    });
  });

  describe('accamulatePortalPermissions', () => {
    it('uses ctx.portalPermissions as base when it already exists', async () => {
      const ctx: PortalNodeContext = {
        ...mockContext,
        portalPermissions: { pods: ['get'] },
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(ctx.portalPermissions?.pods).toEqual(['get']);
    });

    it('falls back to empty object when ctx.portalPermissions is absent', async () => {
      const ctx: PortalNodeContext = { ...mockContext };
      delete ctx.portalPermissions;

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(ctx.portalPermissions).toBeDefined();
    });

    it('merges ctx.nodesPermissions into portalPermissions', async () => {
      const ctx: PortalNodeContext = {
        ...mockContext,
        nodesPermissions: [
          { resource: 'pods', actions: ['get', 'list'] },
          { resource: 'services', actions: ['get'] },
        ],
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(ctx.portalPermissions).toEqual({
        pods: ['get', 'list'],
        services: ['get'],
      });
    });

    it('leaves portalPermissions as empty object when ctx.nodesPermissions is absent', async () => {
      const ctx: PortalNodeContext = { ...mockContext };
      delete ctx.nodesPermissions;
      delete ctx.portalPermissions;

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(ctx.portalPermissions).toEqual({});
    });

    it('sets ctx.portalPermissions with the merged result', async () => {
      const ctx: PortalNodeContext = {
        ...mockContext,
        portalPermissions: { secrets: ['get'] },
        nodesPermissions: [{ resource: 'pods', actions: ['list'] }],
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(ctx.portalPermissions).toEqual({
        secrets: ['get'],
        pods: ['list'],
      });
    });

    it('overrides an existing resource entry with new actions', async () => {
      const ctx: PortalNodeContext = {
        ...mockContext,
        portalPermissions: { pods: ['get'] },
        nodesPermissions: [
          { resource: 'pods', actions: ['get', 'list', 'create'] },
        ],
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(ctx.portalPermissions?.pods).toEqual(['get', 'list', 'create']);
    });

    it('processNodeContext sets portalPermissions on ctx when nodesPermissions is present', async () => {
      const ctx: PortalNodeContext = {
        ...mockContext,
        nodesPermissions: [{ resource: 'namespaces', actions: ['list'] }],
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(ctx.portalPermissions).toEqual({ namespaces: ['list'] });
    });
  });

  describe('getEntityPermissions', () => {
    const makePermissionsDefinition = (
      overrides: Partial<PermissionsDefinition> = {},
    ): PermissionsDefinition => ({
      group: 'core.k8s.io',
      resource: 'clusters',
      entityActions: ['get', 'update', 'delete'],
      resourceActions: ['create'],
      entityContextKey: 'entityName',
      ...overrides,
    });

    it('does nothing when ctx has no resourceDefinition', async () => {
      const ctx: PortalNodeContext = { ...mockContext };
      delete (ctx as any).resourceDefinition;

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(instancePermissionsService.checkInstance).not.toHaveBeenCalled();
    });

    it('does nothing when resourceDefinition has no permissionsDefinition', async () => {
      const ctx: PortalNodeContext = {
        ...mockContext,
        resourceDefinition: {
          entity: 'Cluster',
          entityCollection: 'clusters',
          version: 'v1alpha1',
        } as any,
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(instancePermissionsService.checkInstance).not.toHaveBeenCalled();
    });

    it('does nothing when ctx[entityContextKey] resolves to a falsy value', async () => {
      // Use a key that processNodeContext does NOT populate ('customKey'),
      // so it remains undefined when getEntityPermissions reads it.
      const ctx: PortalNodeContext = {
        ...mockContext,
        resourceDefinition: {
          entity: 'Cluster',
          entityCollection: 'clusters',
          version: 'v1alpha1',
          permissionsDefinition: makePermissionsDefinition({
            entityContextKey: 'customKey' as any,
          }),
        } as any,
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(instancePermissionsService.checkInstance).not.toHaveBeenCalled();
    });

    it('calls checkInstance with permissionsDefinition and the resolved name', async () => {
      // entityContextKey = 'entityName'; processNodeContext sets ctx.entityName = mockEntityId
      // before getEntityPermissions runs, so name resolves to mockEntityId
      const pd = makePermissionsDefinition({ entityContextKey: 'entityName' });
      const ctx: PortalNodeContext = {
        ...mockContext,
        resourceDefinition: {
          entity: 'Cluster',
          entityCollection: 'clusters',
          version: 'v1alpha1',
          permissionsDefinition: pd,
        } as any,
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(instancePermissionsService.checkInstance).toHaveBeenCalledWith(
        expect.objectContaining({ entityName: mockEntityId }),
        pd,
        expect.objectContaining({ name: mockEntityId }),
      );
    });

    it('passes namespace from routing().getSearchParams() to checkInstance', async () => {
      luigiCoreService.routing.mockReturnValue({
        getSearchParams: () => ({ namespace: 'default' }),
      } as any);

      const pd = makePermissionsDefinition({ entityContextKey: 'entityName' });
      const ctx: PortalNodeContext = {
        ...mockContext,
        resourceDefinition: {
          entity: 'Cluster',
          entityCollection: 'clusters',
          version: 'v1alpha1',
          permissionsDefinition: pd,
        } as any,
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(instancePermissionsService.checkInstance).toHaveBeenCalledWith(
        expect.any(Object),
        pd,
        { name: mockEntityId, namespace: 'default' },
      );
    });

    it('treats the all-namespaces selection as no namespace', async () => {
      luigiCoreService.routing.mockReturnValue({
        getSearchParams: () => ({ namespace: '-all-' }),
      } as any);

      const pd = makePermissionsDefinition({ entityContextKey: 'entityName' });
      const ctx: PortalNodeContext = {
        ...mockContext,
        resourceDefinition: {
          entity: 'Cluster',
          entityCollection: 'clusters',
          version: 'v1alpha1',
          permissionsDefinition: pd,
        } as any,
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(ctx.namespaceId).toBeUndefined();
      expect(instancePermissionsService.checkInstance).toHaveBeenCalledWith(
        expect.any(Object),
        pd,
        { name: mockEntityId, namespace: undefined },
      );
    });

    it('sets ctx.namespaceId from the selected namespace', async () => {
      luigiCoreService.routing.mockReturnValue({
        getSearchParams: () => ({ namespace: 'team-a' }),
      } as any);

      const ctx: PortalNodeContext = {
        ...mockContext,
        resourceDefinition: {
          entity: 'HttpBin',
          entityCollection: 'HttpBins',
          version: 'v1alpha1',
        } as any,
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(ctx.namespaceId).toBe('team-a');
    });

    describe('namespaces', () => {
      const namespacedResourceDefinition = {
        entity: 'HttpBin',
        entityCollection: 'HttpBins',
        version: 'v1alpha1',
        scope: 'Namespaced',
      } as any;

      it('puts the namespaces of the workspace into ctx.namespaces when a namespaced resource has no namespace', async () => {
        namespaceService.list.mockReturnValue(of(['team-a', 'team-b']));
        const ctx: PortalNodeContext = {
          ...mockContext,
          resourceDefinition: namespacedResourceDefinition,
        };

        await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

        expect(namespaceService.list).toHaveBeenCalledWith(
          expect.objectContaining({ kcpPath: mockKcpPath, token: mockToken }),
        );
        expect(ctx.namespaces).toEqual(['team-a', 'team-b']);
        expect(mockEntityNode.context.namespaces).toBeUndefined();
      });

      it('does not list namespaces when a namespace is selected', async () => {
        luigiCoreService.routing.mockReturnValue({
          getSearchParams: () => ({ namespace: 'team-a' }),
        } as any);
        const ctx: PortalNodeContext = {
          ...mockContext,
          resourceDefinition: namespacedResourceDefinition,
        };

        await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

        expect(namespaceService.list).not.toHaveBeenCalled();
        expect(ctx.namespaces).toBeUndefined();
      });

      it('does not list namespaces for a cluster scoped resource', async () => {
        const ctx: PortalNodeContext = {
          ...mockContext,
          resourceDefinition: {
            ...namespacedResourceDefinition,
            scope: 'Cluster',
          },
        };

        await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

        expect(namespaceService.list).not.toHaveBeenCalled();
      });

      it('alerts the error, leaves ctx.namespaces unset and still reads the account info when listing fails', async () => {
        const error = new Error('list failed');
        namespaceService.list.mockReturnValue(throwError(() => error));
        const ctx: PortalNodeContext = {
          ...mockContext,
          resourceDefinition: namespacedResourceDefinition,
        };

        await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

        expect(ctx.namespaces).toBeUndefined();
        expect(errorHandlerService.handleError).toHaveBeenCalledWith(
          error,
          'Failed to read namespaces.',
        );
        expect(accountInfoService.read).toHaveBeenCalled();
      });
    });

    it('merges returned permissions into ctx.portalPermissions keyed by permissionKey', async () => {
      instancePermissionsService.checkInstance.mockReturnValue(
        of([
          {
            resource: 'clusters',
            name: mockEntityId,
            actions: ['get', 'update'],
          },
        ]),
      );

      const pd = makePermissionsDefinition({ entityContextKey: 'entityName' });
      const ctx: PortalNodeContext = {
        ...mockContext,
        resourceDefinition: {
          entity: 'Cluster',
          entityCollection: 'clusters',
          version: 'v1alpha1',
          permissionsDefinition: pd,
        } as any,
      };

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      // permissionKey({ resource: 'clusters', name: mockEntityId }) = 'clusters/entity-123'
      expect(ctx.portalPermissions?.[`clusters/${mockEntityId}`]).toEqual([
        'get',
        'update',
      ]);
    });

    it('initialises portalPermissions to {} when undefined before merging instance permissions', async () => {
      instancePermissionsService.checkInstance.mockReturnValue(
        of([{ resource: 'clusters', name: mockEntityId, actions: ['get'] }]),
      );

      const pd = makePermissionsDefinition({ entityContextKey: 'entityName' });
      const ctx: PortalNodeContext = {
        ...mockContext,
        resourceDefinition: {
          entity: 'Cluster',
          entityCollection: 'clusters',
          version: 'v1alpha1',
          permissionsDefinition: pd,
        } as any,
      };
      delete (ctx as any).portalPermissions;

      await service.processNodeContext(mockEntityId, mockEntityNode, ctx);

      expect(ctx.portalPermissions).toBeDefined();
      expect(ctx.portalPermissions?.[`clusters/${mockEntityId}`]).toEqual([
        'get',
      ]);
    });
  });
});
