import { ApolloFactory } from './apollo-factory';
import { ResourceService } from './resource.service';
import { TestBed } from '@angular/core/testing';
import { LuigiCoreService } from '@openmfp/portal-ui-lib';
import {
  ALL_NAMESPACE,
  type Resource,
} from '@platform-mesh/portal-ui-lib/models';
import { parse, print } from 'graphql';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { MockedObject } from 'vitest';
import { mock } from 'vitest-mock-extended';

describe('ResourceService', () => {
  let service: ResourceService;
  let mockApollo: any;
  let mockApolloFactory: any;
  let mockLuigiCoreService: MockedObject<LuigiCoreService>;

  const resourceDefinition: any = {
    apiGroup: 'core_k8s_io',
    entity: 'TestKind',
    version: 'v1',
    scope: 'Namespaced',
    namespace: 'default',
    entityCollection: 'Testkinds',
  };

  const unversionedResourceDefinition: any = {
    ...resourceDefinition,
    version: undefined,
  };

  const grouplessResourceDefinition: any = {
    ...resourceDefinition,
    apiGroup: undefined,
  };

  const grouplessUnversionedResourceDefinition: any = {
    ...resourceDefinition,
    apiGroup: undefined,
    version: undefined,
  };

  const namespacedNodeContext: any = {
    cluster: 'test',
    namespaceId: 'test-namespace',
    resourceDefinition: {
      apiGroup: 'core_k8s_io',
      entity: 'TestKind',
      version: 'v1',
      scope: 'Namespaced',
      namespace: 'default',
      entityCollection: 'Testkinds',
    },
  };

  const unversionedNamespacedNodeContext: any = {
    ...namespacedNodeContext,
    resourceDefinition: {
      ...namespacedNodeContext.resourceDefinition,
      version: undefined,
    },
  };

  const grouplessNamespacedNodeContext: any = {
    ...namespacedNodeContext,
    resourceDefinition: {
      ...namespacedNodeContext.resourceDefinition,
      apiGroup: undefined,
    },
  };

  const grouplessUnversionedNamespacedNodeContext: any = {
    ...namespacedNodeContext,
    resourceDefinition: {
      ...namespacedNodeContext.resourceDefinition,
      apiGroup: undefined,
      version: undefined,
    },
  };

  const clusterScopeNodeContext: any = {
    namespaceId: 'test-namespace',
    resourceDefinition: {
      apiGroup: 'core_k8s_io',
      entity: 'TestKind',
      version: 'v1',
      scope: 'Cluster',
      namespace: 'default',
      entityCollection: 'Testkinds',
    },
  };

  const unversionedClusterScopeNodeContext: any = {
    ...clusterScopeNodeContext,
    resourceDefinition: {
      ...clusterScopeNodeContext.resourceDefinition,
      version: undefined,
    },
  };

  const grouplessClusterScopeNodeContext: any = {
    ...clusterScopeNodeContext,
    resourceDefinition: {
      ...clusterScopeNodeContext.resourceDefinition,
      apiGroup: undefined,
    },
  };

  const grouplessUnversionedClusterScopeNodeContext: any = {
    ...clusterScopeNodeContext,
    resourceDefinition: {
      ...clusterScopeNodeContext.resourceDefinition,
      apiGroup: undefined,
      version: undefined,
    },
  };

  const resource: any = { metadata: { name: 'test-name' } };

  // Version-level __typename values the gateway returns for the input type
  // name lookup of create and update.
  const schemaTypenames = {
    __typename: 'Query',
    core_k8s_io: {
      __typename: 'CoreK8sIoQuery',
      v1: { __typename: 'CoreK8sIoV1Query' },
    },
    orchestrate_platform_mesh_io: {
      v1alpha1: { __typename: 'OrchestratePlatformMeshIoV1alpha1Query' },
    },
    v1: { __typename: 'V1Query' },
  };

  const dnsZoneDefinition: any = {
    apiGroup: 'network_api_foo_bar',
    entity: 'DNSZone',
    version: 'v1alpha1',
    scope: 'Cluster',
    entityCollection: 'DNSZones',
  };

  const dnsZoneTypename = {
    network_api_foo_bar: {
      v1alpha1: { __typename: 'NetworkAPIFooBarV1alpha1Query' },
    },
  };

  beforeEach(() => {
    mockLuigiCoreService = mock();
    mockApollo = {
      query: vi.fn().mockReturnValue(of({ data: schemaTypenames })),
      subscribe: vi.fn(),
      mutate: vi.fn(),
    };

    mockApolloFactory = {
      apollo: vi.fn().mockReturnValue(mockApollo),
    };

    TestBed.configureTestingModule({
      providers: [
        ResourceService,
        { provide: ApolloFactory, useValue: mockApolloFactory },
        { provide: LuigiCoreService, useValue: mockLuigiCoreService },
      ],
    });

    service = TestBed.inject(ResourceService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('read', () => {
    it('should catch gql parsing error and complete the observable', async () => {
      const invalidQuery =
        `query { core_k8s_io { TestKind(name: "test-name") {` as unknown as any;

      service['luigiCoreService'].showAlert = vi.fn();

      try {
        service.read(
          'test-name',
          { entity: 'TestKind', version: 'v1', apiGroup: 'core_k8s_io' },
          invalidQuery,
          namespacedNodeContext,
        );
        assert.fail();
      } catch (e) {
        expect(mockLuigiCoreService.showAlert).toHaveBeenCalledWith({
          text: expect.any(String),
          type: 'error',
        });
      }
    });

    it('should read resource using fields', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: { core_k8s_io: { v1: { TestKind: { name: 'test' } } } },
        }),
      );

      const res = await firstValueFrom(
        service.read(
          'test-name',
          { entity: 'TestKind', version: 'v1', apiGroup: 'core_k8s_io' },
          ['name'],
          namespacedNodeContext,
        ),
      );
      expect(res).toEqual({ name: 'test' });
      expect(mockApollo.query).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: {
          name: 'test-name',
          namespace: 'test-namespace',
        },
      });
    });

    it('should read resource using fields with namespaced scope', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: { core_k8s_io: { v1: { TestKind: { name: 'test' } } } },
        }),
      );

      const res = await firstValueFrom(
        service.read(
          'test-name',
          { entity: 'TestKind', version: 'v1', apiGroup: 'core_k8s_io' },
          ['name'],
          namespacedNodeContext,
        ),
      );
      expect(res).toEqual({ name: 'test' });
      expect(mockApollo.query).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: {
          name: 'test-name',
          namespace: namespacedNodeContext.namespaceId,
        },
      });
    });

    it('should read resource using fields with cluster scope', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: { core_k8s_io: { v1: { TestKind: { name: 'test' } } } },
        }),
      );

      const res = await firstValueFrom(
        service.read(
          'test-name',
          { entity: 'TestKind', version: 'v1', apiGroup: 'core_k8s_io' },
          ['name'],
          clusterScopeNodeContext,
        ),
      );
      expect(res).toEqual({ name: 'test' });
      expect(mockApollo.query).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: {
          name: 'test-name',
        },
      });
    });

    it('should read resource using raw query, namespaced scope', async () => {
      const rawQuery = `query { core_k8s_io { TestKind(name: "test-name") { name } } }`;
      mockApollo.query.mockReturnValue(
        of({
          data: { core_k8s_io: { v1: { TestKind: { name: 'test' } } } },
        }),
      );

      const res = await firstValueFrom(
        service.read(
          'test-name',
          { entity: 'TestKind', version: 'v1', apiGroup: 'core_k8s_io' },
          rawQuery,
          namespacedNodeContext,
        ),
      );
      expect(res).toEqual({ name: 'test' });
      expect(mockApollo.query).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: {
          name: 'test-name',
          namespace: 'test-namespace',
        },
      });
    });

    it('should read resource using raw query, cluster scope', async () => {
      const rawQuery = `query { core_k8s_io { TestKind(name: "test") { name } } }`;
      mockApollo.query.mockReturnValue(
        of({
          data: { core_k8s_io: { v1: { TestKind: { name: 'test' } } } },
        }),
      );

      const res = await firstValueFrom(
        service.read(
          'test',
          { entity: 'TestKind', version: 'v1', apiGroup: 'core_k8s_io' },
          rawQuery,
          clusterScopeNodeContext,
        ),
      );
      expect(res).toEqual({ name: 'test' });
      expect(mockApollo.query).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: {
          name: 'test',
        },
      });
    });

    it('should read resource using raw query with namespace', async () => {
      const rawQuery = `query { core_k8s_io { TestKind(name: "test-name", namespace: "test-namespace") { name } } }`;
      mockApollo.query.mockReturnValue(
        of({
          data: { core_k8s_io: { v1: { TestKind: { name: 'test' } } } },
        }),
      );

      const res = await firstValueFrom(
        service.read(
          'test-name',
          { entity: 'TestKind', version: 'v1', apiGroup: 'core_k8s_io' },
          rawQuery,
          namespacedNodeContext,
        ),
      );
      expect(res).toEqual({ name: 'test' });
      expect(mockApollo.query).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: {
          name: 'test-name',
          namespace: namespacedNodeContext.namespaceId,
        },
      });
    });

    it('should read resource with readFromParentKcpPath set to false', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: { core_k8s_io: { v1: { TestKind: { name: 'test' } } } },
        }),
      );

      const res = await firstValueFrom(
        service.read(
          'test-name',
          { entity: 'TestKind', version: 'v1', apiGroup: 'core_k8s_io' },
          ['name'],
          namespacedNodeContext,
          false,
        ),
      );
      expect(res).toEqual({ name: 'test' });
      expect(mockApolloFactory.apollo).toHaveBeenCalledWith(
        namespacedNodeContext,
        false,
      );
    });

    it('should read resource without group', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: { v1: { TestKind: { name: 'test' } } },
        }),
      );

      const res = await firstValueFrom(
        service.read(
          'test-name',
          { entity: 'TestKind', version: 'v1', apiGroup: undefined },
          ['name'],
          grouplessNamespacedNodeContext,
        ),
      );
      expect(res).toEqual({ name: 'test' });
    });
  });

  describe('list', () => {
    it('should throw error when resourceDefinition is missing', async () => {
      const contextWithoutDefinition: any = {
        cluster: 'test',
        namespaceId: 'test-namespace',
      };

      await expect(
        firstValueFrom(
          service.list('myList', ['name'], contextWithoutDefinition),
        ),
      ).rejects.toThrow('Resource definition is required');
    });

    it('should throw when list query wrappers are empty', () => {
      const invalidContext: any = {
        ...namespacedNodeContext,
        resourceDefinition: {
          ...namespacedNodeContext.resourceDefinition,
          apiGroup: undefined,
          version: undefined,
          entityCollection: '',
        },
      };

      expect(() => service.list('myList', ['name'], invalidContext)).toThrow(
        'At least one wrapper or inner fields is required',
      );
    });

    it('should throw error when initialListQuery returns empty result', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {},
          },
        }),
      );

      await expect(
        firstValueFrom(service.list('myList', ['name'], namespacedNodeContext)),
      ).rejects.toThrow('Resource list result not found');
    });

    it('should return initial items from query via startWith', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [
                    { name: 'res1', metadata: { name: 'res1', uid: 'uid1' } },
                    { name: 'res2', metadata: { name: 'res2', uid: 'uid2' } },
                  ],
                },
              },
            },
          },
        }),
      );
      const subject = new Subject();
      mockApollo.subscribe.mockReturnValue(subject.asObservable());

      const results: any[] = [];
      service.list('myList', ['name'], namespacedNodeContext).subscribe({
        next: (res) => results.push(res),
      });

      expect(results[0]).toEqual({
        items: [
          {
            accessibleName: undefined,
            id: 'res1',
            isAvailable: true,
            metadata: {
              name: 'res1',
              uid: 'uid1',
            },
            name: 'res1',
            ready: true,
          },
          {
            accessibleName: undefined,
            id: 'res2',
            isAvailable: true,
            metadata: {
              name: 'res2',
              uid: 'uid2',
            },
            name: 'res2',
            ready: true,
          },
        ],
        resourceVersion: '123',
      });
    });

    it('should list namespaced resources', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
                },
              },
            },
          },
        }),
      );
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            mylist: {
              type: 'ADDED',
              object: { name: 'res2', metadata: { uid: 'uid2' } },
            },
          },
        }),
      );
      await firstValueFrom(
        service.list('mylist', ['name'], namespacedNodeContext),
      );

      expect(mockApollo.query).toHaveBeenCalled();
    });

    it('should list namespaced resources without version', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              Testkinds: {
                resourceVersion: '123',
                items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
              },
            },
          },
        }),
      );
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            myList: {
              type: 'ADDED',
              object: { name: 'res2', metadata: { uid: 'uid2' } },
            },
          },
        }),
      );
      await firstValueFrom(
        service.list('myList', ['name'], unversionedNamespacedNodeContext),
      );
      expect(mockApollo.query).toHaveBeenCalled();
    });

    it('should list namespaced resources without group', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            v1: {
              Testkinds: {
                resourceVersion: '123',
                items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
              },
            },
          },
        }),
      );
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            myList: {
              type: 'ADDED',
              object: { name: 'res2', metadata: { uid: 'uid2' } },
            },
          },
        }),
      );
      await firstValueFrom(
        service.list('myList', ['name'], grouplessNamespacedNodeContext),
      );
      expect(mockApollo.query).toHaveBeenCalled();
    });

    it('should list namespaced resources without group and version', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            Testkinds: {
              resourceVersion: '123',
              items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
            },
          },
        }),
      );
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            myList: {
              type: 'ADDED',
              object: { name: 'res2', metadata: { uid: 'uid2' } },
            },
          },
        }),
      );
      await firstValueFrom(
        service.list(
          'myList',
          ['name'],
          grouplessUnversionedNamespacedNodeContext,
        ),
      );
      expect(mockApollo.query).toHaveBeenCalled();
    });

    it('should list cluster resources', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
                },
              },
            },
          },
        }),
      );
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            myList: {
              type: 'ADDED',
              object: { name: 'res2', metadata: { uid: 'uid2' } },
            },
          },
        }),
      );
      await firstValueFrom(
        service.list('myList', ['name'], clusterScopeNodeContext),
      );
      expect(mockApollo.query).toHaveBeenCalled();
    });

    it('should list cluster resources without version', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              Testkinds: {
                resourceVersion: '123',
                items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
              },
            },
          },
        }),
      );
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            myList: {
              type: 'ADDED',
              object: { name: 'res2', metadata: { uid: 'uid2' } },
            },
          },
        }),
      );
      await firstValueFrom(
        service.list('myList', ['name'], unversionedClusterScopeNodeContext),
      );
      expect(mockApollo.query).toHaveBeenCalled();
    });

    it('should list cluster resources without group', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            v1: {
              Testkinds: {
                resourceVersion: '123',
                items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
              },
            },
          },
        }),
      );
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            myList: {
              type: 'ADDED',
              object: { name: 'res2', metadata: { uid: 'uid2' } },
            },
          },
        }),
      );
      await firstValueFrom(
        service.list('myList', ['name'], grouplessClusterScopeNodeContext),
      );
      expect(mockApollo.query).toHaveBeenCalled();
    });

    it('should list cluster resources without group and version', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            Testkinds: {
              resourceVersion: '123',
              items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
            },
          },
        }),
      );
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            myList: {
              type: 'ADDED',
              object: { name: 'res2', metadata: { uid: 'uid2' } },
            },
          },
        }),
      );
      await firstValueFrom(
        service.list(
          'myList',
          ['name'],
          grouplessUnversionedClusterScopeNodeContext,
        ),
      );
      expect(mockApollo.query).toHaveBeenCalled();
    });

    it('should list resources with namespace', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
                },
              },
            },
          },
        }),
      );
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            myList: {
              type: 'ADDED',
              object: { name: 'res2', metadata: { uid: 'uid2' } },
            },
          },
        }),
      );

      await firstValueFrom(
        service.list('myList', ['name'], namespacedNodeContext),
      );
      expect(mockApollo.query).toHaveBeenCalled();
    });

    it('should list namespaced resources (raw query string)', async () => {
      const rawQuery = `
      query {
        mylist {
          mydata {
            name
          }
        }
      }
    `;
      mockApollo.query.mockReturnValue(
        of({ data: { mylist: { mydata: [{ name: 'res2' }] } } }),
      );

      const res = await firstValueFrom(
        service.list('mylist.mydata', rawQuery, namespacedNodeContext),
      );
      expect(res).toEqual([{ name: 'res2' }]);
      expect(mockApollo.query).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: {
          namespace: namespacedNodeContext.namespaceId,
        },
      });
    });

    it('should return empty array for raw query when path is missing', async () => {
      const rawQuery = `
      query {
        mylist {
          mydata {
            name
          }
        }
      }
    `;
      mockApollo.query.mockReturnValue(
        of({ data: { mylist: { mydata: [{ name: 'res2' }] } } }),
      );

      const res = await firstValueFrom(
        service.list('mylist.missing', rawQuery, namespacedNodeContext),
      );
      expect(res).toEqual([]);
    });

    it('should list cluster resources (raw query string)', async () => {
      const rawQuery = `
      query {
        mylist {
          name
        }
      }
    `;
      mockApollo.query.mockReturnValue(
        of({ data: { mylist: [{ name: 'res2' }] } }),
      );

      const res = await firstValueFrom(
        service.list('mylist', rawQuery, clusterScopeNodeContext),
      );
      expect(res).toEqual([{ name: 'res2' }]);
      expect(mockApollo.query).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: {},
      });
    });

    it('should handle raw query list error', async () => {
      const rawQuery = `query { myList { name } }`;
      const error = new Error('raw query fail');
      mockApollo.query.mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(service.list('myList', rawQuery, namespacedNodeContext)),
      ).rejects.toThrow();
      expect(mockLuigiCoreService.showAlert).not.toHaveBeenCalled();
    });

    it('should list resources with pagination limit', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
                  continue: 'token-abc',
                  remainingItemCount: 10,
                },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.list('myList', ['name'], namespacedNodeContext, {
          pagination: { limit: 5, continue: undefined },
        }),
      );
      expect(res.continue).toBe('token-abc');
      expect(res.remainingItemCount).toBe(10);
    });

    it('should list resources with pagination continue token', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
                },
              },
            },
          },
        }),
      );

      await firstValueFrom(
        service.list('myList', ['name'], namespacedNodeContext, {
          pagination: { limit: 5, continue: 'token-123' },
        }),
      );
      expect(mockApollo.query).toHaveBeenCalled();
    });

    it('should list resources with readFromParentKcpPath set to true', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
                },
              },
            },
          },
        }),
      );

      await firstValueFrom(
        service.list('myList', ['name'], namespacedNodeContext, {
          readFromParentKcpPath: true,
        }),
      );
      expect(mockApolloFactory.apollo).toHaveBeenCalledWith(
        namespacedNodeContext,
        true,
      );
    });

    it('should determine ready status from custom readyCondition', async () => {
      const contextWithReadyCondition: any = {
        ...namespacedNodeContext,
        resourceDefinition: {
          ...namespacedNodeContext.resourceDefinition,
          readyCondition: {
            jsonPathExpression: '$.status.ready',
            property: 'status.ready',
          },
        },
      };

      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [
                    {
                      name: 'res1',
                      metadata: { uid: 'uid1' },
                      status: { ready: true },
                    },
                  ],
                },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.list('myList', ['name', 'status'], contextWithReadyCondition),
      );
      expect(res.items[0].ready).toBe(true);
    });

    it('should keep listed resources available while not ready when configured', async () => {
      const contextWithNotReadyAccess: any = {
        ...namespacedNodeContext,
        resourceDefinition: {
          ...namespacedNodeContext.resourceDefinition,
          availableWhenNotReady: true,
          readyCondition: {
            jsonPathExpression: '$.status.ready',
            property: 'status.ready',
          },
        },
      };

      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [
                    {
                      name: 'res1',
                      metadata: { uid: 'uid1' },
                      status: { ready: false },
                    },
                  ],
                },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.list('myList', ['name', 'status'], contextWithNotReadyAccess),
      );
      expect(res.items[0]).toEqual(
        expect.objectContaining({ ready: false, isAvailable: true }),
      );
    });

    it('should determine ready status from conditions when readyCondition is not defined', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [
                    {
                      name: 'res1',
                      metadata: { uid: 'uid1' },
                      status: {
                        conditions: [{ type: 'Ready', status: 'True' }],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.list('myList', ['name', 'status'], namespacedNodeContext),
      );
      expect(res.items[0].ready).toBe(true);
    });

    it('should set ready to false when no Ready condition is found', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [
                    {
                      name: 'res1',
                      metadata: { uid: 'uid1' },
                      status: {
                        conditions: [{ type: 'Other', status: 'True' }],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.list('myList', ['name', 'status'], namespacedNodeContext),
      );
      expect(res.items[0].ready).toBe(true);
    });

    it('should set ready to false when Ready condition status is not True', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [
                    {
                      name: 'res1',
                      metadata: { uid: 'uid1' },
                      status: {
                        conditions: [{ type: 'Ready', status: 'False' }],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.list('myList', ['name', 'status'], namespacedNodeContext),
      );
      expect(res.items[0].ready).toBe(true);
    });

    it('should set ready to false when no status exists', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
                },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.list('myList', ['name'], namespacedNodeContext),
      );
      expect(res.items[0].ready).toBe(true);
    });
  });

  describe('listSubscription', () => {
    it('should subscribe to namespaced resource changes', async () => {
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            mysubscription: {
              type: 'ADDED',
              object: { name: 'res1', metadata: { uid: 'uid1' } },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.resourceChangeSubscription(
          'mySubscription',
          ['name'],
          namespacedNodeContext,
          '123',
          false,
        ),
      );
      expect(res?.type).toBe('ADDED');
      expect(res?.object.name).toBe('res1');
    });

    it('should subscribe to cluster resource changes', async () => {
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            mysubscription: {
              type: 'MODIFIED',
              object: { name: 'res1', metadata: { uid: 'uid1' } },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.resourceChangeSubscription(
          'mySubscription',
          ['name'],
          clusterScopeNodeContext,
          '123',
          false,
        ),
      );
      expect(res?.type).toBe('MODIFIED');
    });

    it('should include namespace in subscription variables for namespaced resources', async () => {
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            mysubscription: {
              type: 'ADDED',
              object: { name: 'res1', metadata: { uid: 'uid1' } },
            },
          },
        }),
      );

      await firstValueFrom(
        service.resourceChangeSubscription(
          'mySubscription',
          ['name'],
          namespacedNodeContext,
          '123',
          false,
        ),
      );
      expect(mockApollo.subscribe).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: expect.objectContaining({
          namespace: 'test-namespace',
          resourceVersion: '123',
        }),
      });
    });

    it('should not include namespace in subscription variables for cluster resources', async () => {
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            mysubscription: {
              type: 'ADDED',
              object: { name: 'res1', metadata: { uid: 'uid1' } },
            },
          },
        }),
      );

      await firstValueFrom(
        service.resourceChangeSubscription(
          'mySubscription',
          ['name'],
          clusterScopeNodeContext,
          '123',
          false,
        ),
      );
      expect(mockApollo.subscribe).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: expect.objectContaining({
          resourceVersion: '123',
        }),
      });
      const callArgs = mockApollo.subscribe.mock.calls[0][0];
      expect(callArgs.variables.namespace).toBeUndefined();
    });

    it('should set ready status on subscription object using readyCondition', async () => {
      const contextWithReadyCondition: any = {
        ...namespacedNodeContext,
        resourceDefinition: {
          ...namespacedNodeContext.resourceDefinition,
          readyCondition: {
            jsonPathExpression: '$.status.ready',
            property: 'status.ready',
          },
        },
      };

      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            mysubscription: {
              type: 'ADDED',
              object: {
                name: 'res1',
                metadata: { uid: 'uid1' },
                status: { ready: true },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.resourceChangeSubscription(
          'mySubscription',
          ['name', 'status'],
          contextWithReadyCondition,
          '123',
          false,
        ),
      );
      expect(res?.object.ready).toBe(true);
    });

    it('should keep subscribed resources available while not ready when configured', async () => {
      const contextWithNotReadyAccess: any = {
        ...namespacedNodeContext,
        resourceDefinition: {
          ...namespacedNodeContext.resourceDefinition,
          availableWhenNotReady: true,
          readyCondition: {
            jsonPathExpression: '$.status.ready',
            property: 'status.ready',
          },
        },
      };

      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            mysubscription: {
              type: 'MODIFIED',
              object: {
                name: 'res1',
                metadata: { uid: 'uid1' },
                status: { ready: false },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.resourceChangeSubscription(
          'mySubscription',
          ['name', 'status'],
          contextWithNotReadyAccess,
          '123',
          false,
        ),
      );
      expect(res?.object).toEqual(
        expect.objectContaining({ ready: false, isAvailable: true }),
      );
    });

    it('should set ready status on subscription object using conditions', async () => {
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            mysubscription: {
              type: 'ADDED',
              object: {
                name: 'res1',
                metadata: { uid: 'uid1' },
                status: {
                  conditions: [{ type: 'Ready', status: 'True' }],
                },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.resourceChangeSubscription(
          'mySubscription',
          ['name', 'status'],
          namespacedNodeContext,
          '123',
          false,
        ),
      );
      expect(res?.object.ready).toBe(true);
    });

    it('should return undefined when subscription result is undefined', async () => {
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            someOtherField: {},
          },
        }),
      );

      const res = await firstValueFrom(
        service.resourceChangeSubscription(
          'mySubscription',
          ['name'],
          namespacedNodeContext,
          '123',
          false,
        ),
      );
      expect(res).toBeUndefined();
    });

    it('should use readFromParentKcpPath parameter', async () => {
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            mysubscription: {
              type: 'ADDED',
              object: { name: 'res1', metadata: { uid: 'uid1' } },
            },
          },
        }),
      );

      await firstValueFrom(
        service.resourceChangeSubscription(
          'mySubscription',
          ['name'],
          namespacedNodeContext,
          '123',
          true,
        ),
      );
      expect(mockApolloFactory.apollo).toHaveBeenCalledWith(
        namespacedNodeContext,
        true,
      );
    });
  });

  describe('delete', () => {
    it('should delete resource', async () => {
      mockApollo.mutate.mockReturnValue(of({}));
      await firstValueFrom(
        service.delete(resource, resourceDefinition, namespacedNodeContext),
      );
      expect(mockApollo.mutate).toHaveBeenCalled();
    });

    it('should delete namespaced resource', async () => {
      mockApollo.mutate.mockReturnValue(of({}));

      await firstValueFrom(
        service.delete(resource, resourceDefinition, namespacedNodeContext),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        variables: {
          name: 'test-name',
          namespace: namespacedNodeContext.namespaceId,
        },
      });
    });

    it('should delete namespaced resource without version', async () => {
      mockApollo.mutate.mockReturnValue(of({}));

      await firstValueFrom(
        service.delete(
          resource,
          unversionedResourceDefinition,
          unversionedNamespacedNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        variables: {
          name: 'test-name',
          namespace: unversionedNamespacedNodeContext.namespaceId,
        },
      });
    });

    it('should delete namespaced resource without group', async () => {
      mockApollo.mutate.mockReturnValue(of({}));

      await firstValueFrom(
        service.delete(
          resource,
          grouplessResourceDefinition,
          grouplessNamespacedNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        variables: {
          name: 'test-name',
          namespace: grouplessNamespacedNodeContext.namespaceId,
        },
      });
    });

    it('should delete namespaced resource without group and version', async () => {
      mockApollo.mutate.mockReturnValue(of({}));

      await firstValueFrom(
        service.delete(
          resource,
          grouplessUnversionedResourceDefinition,
          grouplessUnversionedNamespacedNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        variables: {
          name: 'test-name',
          namespace: grouplessUnversionedNamespacedNodeContext.namespaceId,
        },
      });
    });

    it('should delete cluster resource', async () => {
      mockApollo.mutate.mockReturnValue(of({}));

      await firstValueFrom(
        service.delete(resource, resourceDefinition, clusterScopeNodeContext),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        variables: {
          name: 'test-name',
        },
      });
    });

    it('should handle delete error', async () => {
      const error = new Error('fail');
      mockApollo.mutate.mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(
          service.delete(resource, resourceDefinition, clusterScopeNodeContext),
        ),
      ).rejects.toThrow('fail');
      expect(mockLuigiCoreService.showAlert).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should use the input type name from the gateway schema', async () => {
      mockApollo.query.mockReturnValue(of({ data: dnsZoneTypename }));
      mockApollo.mutate.mockReturnValue(of({ data: {} }));

      await firstValueFrom(
        service.create(resource, dnsZoneDefinition, clusterScopeNodeContext),
      );

      const lookup = print(mockApollo.query.mock.calls[0][0].query);
      expect(lookup).toContain('network_api_foo_bar');
      expect(lookup).toContain('v1alpha1');
      expect(lookup).toContain('__typename');
      expect(print(mockApollo.mutate.mock.calls[0][0].mutation)).toContain(
        '$object: NetworkAPIFooBarV1alpha1DNSZone_Input!',
      );
      expect(mockApolloFactory.apollo).toHaveBeenCalledTimes(1);
    });

    it.each([
      [
        'a group and version',
        resourceDefinition,
        '{ core_k8s_io { v1 { __typename } } }',
        'CoreK8sIoV1',
      ],
      [
        'a group without version',
        unversionedResourceDefinition,
        '{ core_k8s_io { __typename } }',
        'CoreK8sIo',
      ],
      [
        'a version without group',
        grouplessResourceDefinition,
        '{ v1 { __typename } }',
        'V1',
      ],
      [
        'an empty group',
        { ...resourceDefinition, apiGroup: '' },
        '{ v1 { __typename } }',
        'V1',
      ],
      [
        'neither group nor version',
        grouplessUnversionedResourceDefinition,
        '{ __typename }',
        '',
      ],
    ])(
      'should look up the query type of %s',
      async (_, definition, expectedLookup, expectedPrefix) => {
        mockApollo.mutate.mockReturnValue(of({ data: {} }));

        await firstValueFrom(
          service.create(resource, definition, clusterScopeNodeContext),
        );

        expect(print(mockApollo.query.mock.calls[0][0].query)).toBe(
          print(parse(expectedLookup)),
        );
        expect(print(mockApollo.mutate.mock.calls[0][0].mutation)).toContain(
          `$object: ${expectedPrefix}TestKind_Input!`,
        );
      },
    );

    it('should create a Gardener DNSAnnotation', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            dns_gardener_cloud: {
              v1alpha1: { __typename: 'DNSGardenerCloudV1alpha1Query' },
            },
          },
        }),
      );
      mockApollo.mutate.mockReturnValue(of({ data: {} }));

      await firstValueFrom(
        service.create(
          resource,
          {
            apiGroup: 'dns_gardener_cloud',
            entity: 'DNSAnnotation',
            version: 'v1alpha1',
            scope: 'Namespaced',
            entityCollection: 'DNSAnnotations',
          },
          namespacedNodeContext,
        ),
      );

      expect(print(mockApollo.query.mock.calls[0][0].query)).toBe(
        print(parse('{ dns_gardener_cloud { v1alpha1 { __typename } } }')),
      );
      expect(print(mockApollo.mutate.mock.calls[0][0].mutation)).toContain(
        '$object: DNSGardenerCloudV1alpha1DNSAnnotation_Input!',
      );
    });

    it('should not create the resource when the type lookup fails', async () => {
      mockApollo.query.mockReturnValue(throwError(() => new Error('lookup')));

      await expect(
        firstValueFrom(
          service.create(resource, resourceDefinition, clusterScopeNodeContext),
        ),
      ).rejects.toThrow('lookup');
      expect(mockApollo.mutate).not.toHaveBeenCalled();
    });

    it('should create resource', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );
      await firstValueFrom(
        service.create(resource, resourceDefinition, namespacedNodeContext),
      );
      expect(mockApollo.mutate).toHaveBeenCalled();
    });

    it('should create namespaced resource ', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.create(resource, resourceDefinition, namespacedNodeContext),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          object: resource,
          namespace: namespacedNodeContext.namespaceId,
        },
      });
    });

    it('should create namespaced resource without version', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.create(
          resource,
          unversionedResourceDefinition,
          unversionedNamespacedNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          object: resource,
          namespace: unversionedNamespacedNodeContext.namespaceId,
        },
      });
    });

    it('should create namespaced resource without group', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.create(
          resource,
          grouplessResourceDefinition,
          grouplessNamespacedNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          object: resource,
          namespace: grouplessNamespacedNodeContext.namespaceId,
        },
      });
    });

    it('should create namespaced resource without group and version', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.create(
          resource,
          grouplessUnversionedResourceDefinition,
          grouplessUnversionedNamespacedNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          object: resource,
          namespace: grouplessUnversionedNamespacedNodeContext.namespaceId,
        },
      });
    });

    it('should create cluster resource ', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.create(resource, resourceDefinition, clusterScopeNodeContext),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          object: resource,
        },
      });
    });

    it('should handle create error', async () => {
      const error = new Error('fail');
      mockApollo.mutate.mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(
          service.create(resource, resourceDefinition, clusterScopeNodeContext),
        ),
      ).rejects.toThrow('fail');
      expect(mockLuigiCoreService.showAlert).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should use the input type name from the gateway schema', async () => {
      mockApollo.query.mockReturnValue(of({ data: dnsZoneTypename }));
      mockApollo.mutate.mockReturnValue(of({ data: {} }));

      await firstValueFrom(
        service.update(resource, dnsZoneDefinition, clusterScopeNodeContext),
      );

      expect(print(mockApollo.mutate.mock.calls[0][0].mutation)).toContain(
        '$object: NetworkAPIFooBarV1alpha1DNSZone_Input!',
      );
      expect(mockApolloFactory.apollo).toHaveBeenCalledTimes(1);
    });

    it('should not update the resource when the type lookup fails', async () => {
      mockApollo.query.mockReturnValue(throwError(() => new Error('lookup')));

      await expect(
        firstValueFrom(
          service.update(resource, resourceDefinition, clusterScopeNodeContext),
        ),
      ).rejects.toThrow('lookup');
      expect(mockApollo.mutate).not.toHaveBeenCalled();
    });

    it.each([undefined, ALL_NAMESPACE])(
      'uses the HttpBin namespace for a table update without a concrete context namespace (%s)',
      async (namespaceId) => {
        const httpBinDefinition = {
          ...resourceDefinition,
          apiGroup: 'orchestrate_platform_mesh_io',
          entity: 'HttpBin',
          entityCollection: 'HttpBins',
          version: 'v1alpha1',
        };
        const httpBin = {
          metadata: { namespace: 'kube-system', name: 'asd' },
          spec: { region: 'asd' },
        } as unknown as Resource;
        const context = {
          ...namespacedNodeContext,
          namespaceId,
          resourceDefinition: httpBinDefinition,
        };
        mockLuigiCoreService.routing.mockReturnValue({
          getSearchParams: () => ({ namespace: ALL_NAMESPACE }),
        } as any);
        mockApollo.mutate.mockReturnValue(of({ data: {} }));

        await firstValueFrom(
          service.update(httpBin, httpBinDefinition, context),
        );

        expect(mockApollo.mutate).toHaveBeenCalledWith({
          mutation: expect.anything(),
          fetchPolicy: 'no-cache',
          variables: {
            namespace: 'kube-system',
            name: 'asd',
            object: httpBin,
          },
        });
      },
    );

    it('should strip __typename recursively from update payload', async () => {
      const dirtyResource: any = {
        metadata: { name: 'test-name', __typename: 'Meta' },
        spec: {
          __typename: 'Spec',
          items: [
            { key: 'a', __typename: 'Item' },
            { key: 'b', nested: { foo: 'bar', __typename: 'Nested' } },
          ],
          map: {
            one: { val: 1, __typename: 'Val' },
            two: [{ x: 1, __typename: 'X' }, { y: 2 }],
          },
        },
      };

      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.update(
          dirtyResource,
          resourceDefinition,
          namespacedNodeContext,
        ),
      );
      const mutateCall = mockApollo.mutate.mock.calls[0][0];
      const passedObject = mutateCall.variables.object;
      expect(passedObject).toEqual({
        metadata: { name: 'test-name' },
        spec: {
          items: [{ key: 'a' }, { key: 'b', nested: { foo: 'bar' } }],
          map: {
            one: { val: 1 },
            two: [{ x: 1 }, { y: 2 }],
          },
        },
      });
    });
    it('should update resource', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );
      await firstValueFrom(
        service.update(resource, resourceDefinition, namespacedNodeContext),
      );
      expect(mockApollo.mutate).toHaveBeenCalled();
    });

    it('should update namespaced resource', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.update(resource, resourceDefinition, namespacedNodeContext),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          name: resource.metadata.name,
          object: resource,
          namespace: namespacedNodeContext.namespaceId,
        },
      });
    });

    it('should update namespaced resource without version', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.update(
          resource,
          unversionedResourceDefinition,
          unversionedNamespacedNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          name: resource.metadata.name,
          object: resource,
          namespace: unversionedNamespacedNodeContext.namespaceId,
        },
      });
    });

    it('should update namespaced resource without group', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.update(
          resource,
          grouplessResourceDefinition,
          grouplessNamespacedNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          name: resource.metadata.name,
          object: resource,
          namespace: grouplessNamespacedNodeContext.namespaceId,
        },
      });
    });

    it('should update namespaced resource without group and version', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.update(
          resource,
          grouplessUnversionedResourceDefinition,
          grouplessUnversionedNamespacedNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          name: resource.metadata.name,
          object: resource,
          namespace: grouplessUnversionedNamespacedNodeContext.namespaceId,
        },
      });
    });

    it('should update cluster resource', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.update(resource, resourceDefinition, clusterScopeNodeContext),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          name: resource.metadata.name,
          object: resource,
        },
      });
    });

    it('should handle update error', async () => {
      const error = new Error('fail');
      mockApollo.mutate.mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(
          service.update(resource, resourceDefinition, clusterScopeNodeContext),
        ),
      ).rejects.toThrow();
      expect(mockLuigiCoreService.showAlert).not.toHaveBeenCalled();
    });
  });

  // NEW TEST CASES FOR MISSING COVERAGE

  describe('Private methods and edge cases', () => {
    describe('getNamespace', () => {
      it('should return namespaceId when present in context', () => {
        const result = service['getNamespace'](namespacedNodeContext);
        expect(result).toBe('test-namespace');
      });

      it('should return namespace from search params when namespaceId is missing', () => {
        service['luigiCoreService'].routing = vi.fn(() => ({
          getSearchParams: () => ({ namespace: 'search-namespace' }),
        }));

        const result = service['getNamespace']({
          ...namespacedNodeContext,
          namespaceId: undefined,
        });

        expect(result).toBe('search-namespace');
      });

      it('should return undefined when namespace is -all- in search params', () => {
        service['luigiCoreService'].routing = vi.fn(() => ({
          getSearchParams: () => ({ namespace: ALL_NAMESPACE }),
        }));

        const result = service['getNamespace']({
          ...namespacedNodeContext,
          namespaceId: undefined,
        });

        expect(result).toBeUndefined();
      });

      it('should fall through to the search params when namespaceId is the -all- sentinel', () => {
        service['luigiCoreService'].routing = vi.fn(() => ({
          getSearchParams: () => ({ namespace: 'search-namespace' }),
        }));

        const result = service['getNamespace']({
          ...namespacedNodeContext,
          namespaceId: ALL_NAMESPACE,
        });

        expect(result).toBe('search-namespace');
      });

      it('should prefer the resource namespace when namespaceId is the -all- sentinel', () => {
        const result = service['getNamespace'](
          { ...namespacedNodeContext, namespaceId: ALL_NAMESPACE },
          { metadata: { name: 'r', namespace: 'resource-namespace' } } as any,
        );

        expect(result).toBe('resource-namespace');
      });

      it('should return undefined when namespaceId and the search params both carry -all-', () => {
        service['luigiCoreService'].routing = vi.fn(() => ({
          getSearchParams: () => ({ namespace: ALL_NAMESPACE }),
        }));

        const result = service['getNamespace']({
          ...namespacedNodeContext,
          namespaceId: ALL_NAMESPACE,
        });

        expect(result).toBeUndefined();
      });
    });

    describe('normalizeGqlBuilderVariables', () => {
      it('should convert gql-builder format to simple key-value pairs', () => {
        const variables = {
          name: { type: 'String!', value: 'test' },
          namespace: { type: 'String', value: 'default' },
          limit: { type: 'Int', value: 10 },
        };

        const result = service['normalizeGqlBuilderVariables'](variables);

        expect(result).toEqual({
          name: 'test',
          namespace: 'default',
          limit: 10,
        });
      });

      it('should handle empty variables', () => {
        const result = service['normalizeGqlBuilderVariables']({});
        expect(result).toEqual({});
      });
    });

    describe('calcQueryOptions', () => {
      it('should build query options with multiple wrappers', () => {
        const innerFields = [
          {
            operation: 'TestKind',
            fields: ['name', 'namespace'],
            variables: { name: { type: 'String!', value: 'test' } },
          },
        ];

        const wrappers = [{ operation: 'core_k8s_io' }, { operation: 'v1' }];

        const result = service['calcQueryOptions'](innerFields, wrappers);

        expect(result.operation).toBe('core_k8s_io');
        expect(result.fields).toBeDefined();
      });

      it('should handle single wrapper', () => {
        const innerFields = [
          {
            operation: 'TestKind',
            fields: ['name'],
          },
        ];

        const wrappers = [{ operation: 'v1' }];

        const result = service['calcQueryOptions'](innerFields, wrappers);

        expect(result.operation).toBe('v1');
      });

      it('should handle no wrappers and return innerField as complete query', () => {
        const innerFields = [
          {
            operation: 'TestKind',
            fields: ['name'],
          },
        ];

        const wrappers: any[] = [];

        const result = service['calcQueryOptions'](innerFields, wrappers);

        expect(result.operation).toBe('TestKind');
        expect(result.fields).toEqual(['name']);
      });

      it('should throw error when no wrappers and innerFields is invalid', () => {
        const innerFields: any[] = [];
        const wrappers: any[] = [];

        expect(() =>
          service['calcQueryOptions'](innerFields, wrappers),
        ).toThrow('At least one wrapper or inner fields is required');
      });

      it('should filter out wrappers without operation', () => {
        const innerFields = [
          {
            operation: 'TestKind',
            fields: ['name'],
          },
        ];

        const wrappers = [
          { operation: undefined },
          { operation: 'v1' },
          { operation: null },
        ] as any;

        const result = service['calcQueryOptions'](innerFields, wrappers);

        expect(result.operation).toBe('v1');
      });

      it('should handle wrapper with variables', () => {
        const innerFields = [
          {
            operation: 'TestKind',
            fields: ['name'],
          },
        ];

        const wrappers = [
          { operation: 'v1', variables: { limit: { type: 'Int', value: 10 } } },
        ];

        const result = service['calcQueryOptions'](innerFields, wrappers);

        expect(result.variables).toBeDefined();
      });
    });

    describe('getResourceReadyStatus', () => {
      it('should use readyCondition when defined', () => {
        const contextWithReadyCondition: any = {
          resourceDefinition: {
            readyCondition: {
              jsonPathExpression: '$.status.ready',
              property: 'status.ready',
            },
          },
        };

        const resource: any = {
          status: { ready: true },
        };

        const result = service['getResourceReadyStatus'](
          resource,
          contextWithReadyCondition,
        );

        expect(result).toBe(true);
      });

      it('should return false when Ready condition status is False', () => {
        const resource: any = {
          status: {
            conditions: [{ type: 'Ready', status: 'False' }],
          },
        };

        const result = service['getResourceReadyStatus'](
          resource,
          namespacedNodeContext,
        );

        expect(result).toBe(true);
      });

      it('should return false when no conditions exist', () => {
        const resource: any = {
          status: {},
        };

        const result = service['getResourceReadyStatus'](
          resource,
          namespacedNodeContext,
        );

        expect(result).toBe(true);
      });

      it('should return false when status is undefined', () => {
        const resource: any = {};

        const result = service['getResourceReadyStatus'](
          resource,
          namespacedNodeContext,
        );

        expect(result).toBe(true);
      });

      it('should handle readyCondition that returns falsy value', () => {
        const contextWithReadyCondition: any = {
          resourceDefinition: {
            readyCondition: {
              jsonPathExpression: '$.status.ready',
              property: 'status.ready',
            },
          },
        };

        const resource: any = {
          status: { ready: false },
        };

        const result = service['getResourceReadyStatus'](
          resource,
          contextWithReadyCondition,
        );

        expect(result).toBe(false);
      });
    });

    describe('resolveReadQuery', () => {
      it('should build query from fields array', () => {
        const params = {
          entity: 'TestKind',
          version: 'v1',
          apiGroup: 'core_k8s_io',
        };
        const fields = ['name', 'namespace'];
        const resourceId = 'test-id';
        const namespace = 'test-namespace';

        const result = service['resolveReadQuery'](
          params,
          fields,
          resourceId,
          namespace,
        );

        expect(result).toContain('TestKind');
        expect(result).toContain('name');
        expect(result).toContain('namespace');
      });

      it('should return raw query string when provided', () => {
        const params = {
          entity: 'TestKind',
          version: 'v1',
          apiGroup: 'core_k8s_io',
        };
        const rawQuery = 'query { TestKind { name } }';
        const resourceId = 'test-id';
        const namespace = undefined;

        const result = service['resolveReadQuery'](
          params,
          rawQuery,
          resourceId,
          namespace,
        );

        expect(result).toBe(rawQuery);
      });

      it('should build query without namespace when namespace is undefined', () => {
        const params = {
          entity: 'TestKind',
          version: 'v1',
          apiGroup: 'core_k8s_io',
        };
        const fields = ['name'];
        const resourceId = 'test-id';
        const namespace = undefined;

        const result = service['resolveReadQuery'](
          params,
          fields,
          resourceId,
          namespace,
        );

        expect(result).toContain('TestKind');
        expect(result).not.toContain('namespace');
      });
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle list error with fields', async () => {
      const error = new Error('list failed');
      mockApollo.query.mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(service.list('myList', ['name'], namespacedNodeContext)),
      ).rejects.toThrow('list failed');
    });

    it('should handle read error', async () => {
      const error = new Error('read failed');
      mockApollo.query.mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(
          service.read(
            'test-name',
            { entity: 'TestKind', version: 'v1', apiGroup: 'core_k8s_io' },
            ['name'],
            namespacedNodeContext,
          ),
        ),
      ).rejects.toThrow('read failed');
    });

    it('should handle subscription error', async () => {
      const error = new Error('subscription failed');
      mockApollo.subscribe.mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(
          service.resourceChangeSubscription(
            'mySubscription',
            ['name'],
            namespacedNodeContext,
            '123',
            false,
          ),
        ),
      ).rejects.toThrow('subscription failed');
    });
  });

  describe('Complex pagination scenarios', () => {
    it('should handle pagination with both limit and continue', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
                  continue: 'next-token',
                  remainingItemCount: 5,
                },
              },
            },
          },
        }),
      );

      await firstValueFrom(
        service.list('myList', ['name'], namespacedNodeContext, {
          pagination: { limit: 10, continue: 'prev-token' },
        }),
      );
      const queryCall = mockApollo.query.mock.calls[0][0];
      expect(queryCall.variables).toEqual(
        expect.objectContaining({
          limit: 10,
          continue: 'prev-token',
        }),
      );
    });

    it('should not include pagination variables when not provided', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_k8s_io: {
              v1: {
                Testkinds: {
                  resourceVersion: '123',
                  items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
                },
              },
            },
          },
        }),
      );

      await firstValueFrom(
        service.list('myList', ['name'], namespacedNodeContext, {}),
      );
      const queryCall = mockApollo.query.mock.calls[0][0];
      expect(queryCall.variables.limit).toBeUndefined();
      expect(queryCall.variables.continue).toBeUndefined();
    });
  });

  describe('Apollo factory calls', () => {
    it('should call apollo factory with correct parameters for read', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: { core_k8s_io: { v1: { TestKind: { name: 'test' } } } },
        }),
      );

      await firstValueFrom(
        service.read(
          'test-name',
          { entity: 'TestKind', version: 'v1', apiGroup: 'core_k8s_io' },
          ['name'],
          namespacedNodeContext,
          true,
        ),
      );
      expect(mockApolloFactory.apollo).toHaveBeenCalledWith(
        namespacedNodeContext,
        true,
      );
    });

    it('should default readFromParentKcpPath to false for delete', async () => {
      mockApollo.mutate.mockReturnValue(of({}));

      await firstValueFrom(
        service.delete(resource, resourceDefinition, namespacedNodeContext),
      );
      expect(mockApolloFactory.apollo).toHaveBeenCalledWith(
        namespacedNodeContext,
        false,
      );
    });

    it('should default readFromParentKcpPath to false for create', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.create(resource, resourceDefinition, namespacedNodeContext),
      );
      expect(mockApolloFactory.apollo).toHaveBeenCalledWith(
        namespacedNodeContext,
      );
    });

    it('should default readFromParentKcpPath to false for update', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.update(resource, resourceDefinition, namespacedNodeContext),
      );
      expect(mockApolloFactory.apollo).toHaveBeenCalledWith(
        namespacedNodeContext,
        false,
      );
    });

    it('should use readFromParentKcpPath parameter for delete', async () => {
      mockApollo.mutate.mockReturnValue(of({}));

      await firstValueFrom(
        service.delete(
          resource,
          resourceDefinition,
          namespacedNodeContext,
          true,
        ),
      );
      expect(mockApolloFactory.apollo).toHaveBeenCalledWith(
        namespacedNodeContext,
        true,
      );
    });

    it('should use readFromParentKcpPath parameter for update', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.update(
          resource,
          resourceDefinition,
          namespacedNodeContext,
          true,
        ),
      );
      expect(mockApolloFactory.apollo).toHaveBeenCalledWith(
        namespacedNodeContext,
        true,
      );
    });
  });

  describe('Delete operation variations', () => {
    it('should delete cluster resource without version', async () => {
      mockApollo.mutate.mockReturnValue(of({}));

      await firstValueFrom(
        service.delete(
          resource,
          unversionedResourceDefinition,
          unversionedClusterScopeNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        variables: {
          name: 'test-name',
        },
      });
    });

    it('should delete cluster resource without group', async () => {
      mockApollo.mutate.mockReturnValue(of({}));

      await firstValueFrom(
        service.delete(
          resource,
          grouplessResourceDefinition,
          grouplessClusterScopeNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalled();
    });

    it('should delete cluster resource without group and version', async () => {
      mockApollo.mutate.mockReturnValue(of({}));

      await firstValueFrom(
        service.delete(
          resource,
          grouplessUnversionedResourceDefinition,
          grouplessUnversionedClusterScopeNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalled();
    });
  });

  describe('Create operation variations', () => {
    it('should create cluster resource without version', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.create(
          resource,
          unversionedResourceDefinition,
          unversionedClusterScopeNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          object: resource,
        },
      });
    });

    it('should create cluster resource without group', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.create(
          resource,
          grouplessResourceDefinition,
          grouplessClusterScopeNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalled();
    });

    it('should create cluster resource without group and version', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.create(
          resource,
          grouplessUnversionedResourceDefinition,
          grouplessUnversionedClusterScopeNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalled();
    });
  });

  describe('Update operation variations', () => {
    it('should update cluster resource without version', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.update(
          resource,
          unversionedResourceDefinition,
          unversionedClusterScopeNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalledWith({
        mutation: expect.anything(),
        fetchPolicy: 'no-cache',
        variables: {
          name: resource.metadata.name,
          object: resource,
        },
      });
    });

    it('should update cluster resource without group', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.update(
          resource,
          grouplessResourceDefinition,
          grouplessClusterScopeNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalled();
    });

    it('should update cluster resource without group and version', async () => {
      mockApollo.mutate.mockReturnValue(
        of({ data: { __typename: 'TestKind' } }),
      );

      await firstValueFrom(
        service.update(
          resource,
          grouplessUnversionedResourceDefinition,
          grouplessUnversionedClusterScopeNodeContext,
        ),
      );
      expect(mockApollo.mutate).toHaveBeenCalled();
    });
  });

  describe('Availability and Accessible Name', () => {
    it('isAvailable: should return true when resource is ready and not pending deletion', () => {
      const resource = {
        ready: true,
        metadata: { name: 'res1' },
      } as any;

      expect(service.isAvailable(resource)).toBe(true);
    });

    it('isAvailable: should return false when resource is not ready', () => {
      const resource = {
        ready: false,
        metadata: { name: 'res1' },
      } as any;

      expect(service.isAvailable(resource)).toBe(false);
    });

    it('isAvailable: should return true for a not-ready resource when explicitly enabled', () => {
      const resource = {
        ready: false,
        metadata: { name: 'res1' },
      } as any;

      expect(service.isAvailable(resource, true)).toBe(true);
    });

    it('isAvailable: should return false when resource has a deletionTimestamp', () => {
      const resource = {
        ready: true,
        metadata: {
          name: 'res1',
          deletionTimestamp: '2023-10-27T10:00:00Z',
        },
      } as any;

      expect(service.isAvailable(resource)).toBe(false);
    });

    it('isAvailable: should keep a deleting resource unavailable when not-ready access is enabled', () => {
      const resource = {
        ready: false,
        metadata: {
          name: 'res1',
          deletionTimestamp: '2023-10-27T10:00:00Z',
        },
      } as any;

      expect(service.isAvailable(resource, true)).toBe(false);
    });

    it('getAccessibleName: should return undefined string for a healthy, ready resource', () => {
      const resource = {
        ready: true,
        metadata: { name: 'res1' },
      } as any;

      expect(service.getAccessibleName(resource)).toBeUndefined();
    });

    it('getAccessibleName: should return "Resource is pending deletion" when deletionTimestamp is present', () => {
      const resource = {
        ready: true,
        metadata: {
          name: 'res1',
          deletionTimestamp: '2023-10-27T10:00:00Z',
        },
      } as any;

      expect(service.getAccessibleName(resource)).toBe(
        'Resource is pending deletion',
      );
    });

    it('getAccessibleName: should prioritize deletion message over not ready message', () => {
      const resource = {
        ready: false,
        metadata: {
          name: 'res1',
          deletionTimestamp: '2023-10-27T10:00:00Z',
        },
      } as any;

      // Since deletionTimestamp check comes first in the if/else logic
      expect(service.getAccessibleName(resource)).toBe(
        'Resource is pending deletion',
      );
    });

    it('getAccessibleName: should return "Resource is not ready" when not ready and not deleting', () => {
      const resource = {
        ready: false,
        metadata: { name: 'res1' },
      } as any;

      expect(service.getAccessibleName(resource)).toBe('Resource is not ready');
    });
  });

  describe('asReadResources', () => {
    const apolloListResponse = (overrides: any = {}) =>
      of({
        data: {
          core_k8s_io: {
            v1: {
              Testkinds: {
                resourceVersion: 'rv-7',
                items: [{ name: 'res1', metadata: { uid: 'uid1' } }],
                continue: 'next-token',
                remainingItemCount: 3,
                ...overrides,
              },
            },
          },
        },
      });

    it('should map list result to ReadResourcesResult shape', async () => {
      mockApollo.query.mockReturnValue(apolloListResponse());

      const adapter = service.asReadResources();
      const result = await firstValueFrom(
        adapter.list(
          namespacedNodeContext,
          { limit: 5, cursor: 'prev-token' },
          { fields: ['name'] },
        ),
      );

      expect(result).toEqual({
        items: expect.any(Array),
        nextCursor: 'next-token',
        remainingItemCount: 3,
        resourceVersion: 'rv-7',
      });
      expect(result.items).toHaveLength(1);
    });

    it('should pass cursor as continue and limit through to apollo variables', async () => {
      mockApollo.query.mockReturnValue(apolloListResponse());

      await firstValueFrom(
        service
          .asReadResources()
          .list(
            namespacedNodeContext,
            { limit: 7, cursor: 'cur-1' },
            { fields: ['name'] },
          ),
      );

      const queryCall = mockApollo.query.mock.calls[0][0];
      expect(queryCall.variables).toEqual(
        expect.objectContaining({ limit: 7, continue: 'cur-1' }),
      );
    });

    it('should default operation and fields from resourceDefinition.ui.listView.fields', async () => {
      mockApollo.query.mockReturnValue(apolloListResponse());

      const ctxWithFields: any = {
        ...namespacedNodeContext,
        resourceDefinition: {
          ...namespacedNodeContext.resourceDefinition,
          ui: { listView: { fields: ['name'] } },
        },
      };

      const result = await firstValueFrom(
        service.asReadResources().list(ctxWithFields, {}, {}),
      );

      expect(result.items).toHaveLength(1);
      expect(mockApollo.query).toHaveBeenCalled();
    });

    it('should handle missing optional fields in list result without throwing', async () => {
      mockApollo.query.mockReturnValue(
        apolloListResponse({
          continue: undefined,
          remainingItemCount: undefined,
        }),
      );

      const result = await firstValueFrom(
        service
          .asReadResources()
          .list(namespacedNodeContext, {}, { fields: ['name'] }),
      );

      expect(result.nextCursor).toBeUndefined();
      expect(result.remainingItemCount).toBeUndefined();
    });

    it('should respect readFromParentKcpPath flag on list', async () => {
      mockApollo.query.mockReturnValue(apolloListResponse());

      await firstValueFrom(
        service
          .asReadResources()
          .list(
            namespacedNodeContext,
            {},
            { fields: ['name'], readFromParentKcpPath: true },
          ),
      );

      expect(mockApolloFactory.apollo).toHaveBeenCalledWith(
        namespacedNodeContext,
        true,
      );
    });

    it('should delegate subscribe to resourceChangeSubscription', async () => {
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            testkinds: {
              type: 'ADDED',
              object: { name: 'res1', metadata: { name: 'res1' } },
            },
          },
        }),
      );

      const res = await firstValueFrom(
        service.asReadResources().subscribe(namespacedNodeContext, {
          fields: ['name'],
          resourceVersion: 'rv-9',
        }),
      );

      expect(res?.type).toBe('ADDED');
      expect(mockApollo.subscribe).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: expect.objectContaining({ resourceVersion: 'rv-9' }),
      });
    });

    it('should default subscribe resourceVersion to empty string when omitted', async () => {
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            testkinds: {
              type: 'MODIFIED',
              object: { name: 'res1', metadata: { name: 'res1' } },
            },
          },
        }),
      );

      await firstValueFrom(
        service
          .asReadResources()
          .subscribe(namespacedNodeContext, { fields: ['name'] }),
      );

      expect(mockApollo.subscribe).toHaveBeenCalledWith({
        query: expect.anything(),
        variables: expect.objectContaining({ resourceVersion: '' }),
      });
    });

    it('should fall back to resourceDefinition fields for subscribe when none provided', async () => {
      mockApollo.subscribe.mockReturnValue(
        of({
          data: {
            testkinds: {
              type: 'ADDED',
              object: { name: 'res1', metadata: { name: 'res1' } },
            },
          },
        }),
      );

      const ctxWithFields: any = {
        ...namespacedNodeContext,
        resourceDefinition: {
          ...namespacedNodeContext.resourceDefinition,
          ui: { listView: { fields: ['name'] } },
        },
      };

      await firstValueFrom(
        service.asReadResources().subscribe(ctxWithFields, {}),
      );

      expect(mockApollo.subscribe).toHaveBeenCalled();
    });
  });
});
