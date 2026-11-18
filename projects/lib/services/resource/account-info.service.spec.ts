import { TestBed } from '@angular/core/testing';
import { LuigiCoreService } from '@openmfp/portal-ui-lib';
import {
  AccountInfoService,
  ApolloFactory,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import { firstValueFrom, of, throwError } from 'rxjs';
import { MockedObject } from 'vitest';
import { mock } from 'vitest-mock-extended';

describe(AccountInfoService, () => {
  let service: AccountInfoService;
  let mockApollo: any;
  let mockApolloFactory: any;
  let mockLuigiCoreService: MockedObject<LuigiCoreService>;

  const namespacedNodeContext: any = {
    cluster: 'test',
    portalContext: { crdGatewayApiUrl: 'https://api.example.com/graphql' },
    token: 'token-1',
    kcpPath: 'root:orgs:test',
    namespaceId: 'test-namespace',
    resourceDefinition: {
      group: 'core.k8s.io',
      kind: 'TestKind',
      version: 'v1',
      scope: 'Namespaced',
      namespace: 'default',
      plural: 'testkinds',
    },
  };

  beforeEach(() => {
    mockLuigiCoreService = mock();
    mockApollo = {
      query: vi.fn(),
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

    service = TestBed.inject(AccountInfoService);
  });

  describe('read', () => {
    it('should read account info', async () => {
      const ca = 'cert-data';
      const accountInfo = {
        spec: {
          clusterInfo: { ca },
          oidc: {
            issuerUrl: 'issuer',
            clients: '{ "kubectl": { "clientId": "cIdD" } }',
          },
        },
      };
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_platform_mesh_io: {
              v1alpha1: {
                AccountInfo: accountInfo,
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(service.read(namespacedNodeContext));
      expect(res.spec.oidc?.clients).toStrictEqual({
        kubectl: { clientId: 'cIdD' },
      });
      expect(mockApolloFactory.apollo).toHaveBeenCalledWith(
        namespacedNodeContext,
      );
    });

    it('should pass on the scopes and the CA of the issuer', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_platform_mesh_io: {
              v1alpha1: {
                AccountInfo: {
                  spec: {
                    oidc: {
                      issuerUrl: 'issuer',
                      clients: '{ "kubectl": { "clientId": "cIdD" } }',
                      scopes: ['email', 'groups'],
                      ca: 'issuer-ca',
                    },
                  },
                },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(service.read(namespacedNodeContext));

      expect(res.spec.oidc).toStrictEqual({
        issuerUrl: 'issuer',
        clients: { kubectl: { clientId: 'cIdD' } },
        scopes: ['email', 'groups'],
        ca: 'issuer-ca',
      });
    });

    it('should read account info without an identity provider', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_platform_mesh_io: {
              v1alpha1: {
                AccountInfo: {
                  spec: { clusterInfo: { ca: 'cert-data' }, oidc: null },
                },
              },
            },
          },
        }),
      );

      const res = await firstValueFrom(service.read(namespacedNodeContext));

      expect(res.spec.oidc).toBeUndefined();
      expect(res.spec.clusterInfo.ca).toBe('cert-data');
    });

    it('should handle read account info error', async () => {
      const error = new Error('fail');
      mockApollo.query.mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(service.read(namespacedNodeContext)),
      ).rejects.toThrowError(error);
    });

    it('should cache reads by context key', async () => {
      const accountInfo = {
        spec: {
          clusterInfo: { ca: 'cert-data' },
          oidc: {
            issuerUrl: 'issuer',
            clients: '{ "kubectl": { "clientId": "cIdD" } }',
          },
        },
      };
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_platform_mesh_io: {
              v1alpha1: {
                AccountInfo: accountInfo,
              },
            },
          },
        }),
      );

      await firstValueFrom(service.read(namespacedNodeContext));
      await firstValueFrom(service.read(namespacedNodeContext));

      expect(mockApollo.query).toHaveBeenCalledTimes(1);
    });

    it('should create separate cache entries for different keys', async () => {
      const accountInfo = {
        spec: {
          clusterInfo: { ca: 'cert-data' },
          oidc: {
            issuerUrl: 'issuer',
            clients: '{ "kubectl": { "clientId": "cIdD" } }',
          },
        },
      };
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_platform_mesh_io: {
              v1alpha1: {
                AccountInfo: accountInfo,
              },
            },
          },
        }),
      );

      await firstValueFrom(service.read(namespacedNodeContext));
      await firstValueFrom(
        service.read({
          ...namespacedNodeContext,
          kcpPath: 'root:orgs:another',
        }),
      );

      expect(mockApollo.query).toHaveBeenCalledTimes(2);
    });

    it('should create separate cache entries for different gateway urls without kcpPath', async () => {
      mockApollo.query.mockReturnValue(
        of({
          data: {
            core_platform_mesh_io: {
              v1alpha1: {
                AccountInfo: {
                  spec: {
                    clusterInfo: { ca: 'cert-data' },
                    oidc: {
                      issuerUrl: 'issuer',
                      clients: '{ "kubectl": { "clientId": "cIdD" } }',
                    },
                  },
                },
              },
            },
          },
        }),
      );
      const accountContext = (account: string): any => ({
        portalContext: {
          crdGatewayApiUrl: `https://gateway.example.com/api/clusters/root:orgs:sub:${account}/graphql`,
        },
        token: 'token-1',
        accountId: account,
      });

      await firstValueFrom(service.read(accountContext('a21')));
      await firstValueFrom(service.read(accountContext('a11')));

      expect(mockApollo.query).toHaveBeenCalledTimes(2);
    });

    it('should keep a newer cache entry when a stale failed read is subscribed later', async () => {
      const error = new Error('temporary fail');
      mockApollo.query
        .mockReturnValueOnce(throwError(() => error))
        .mockReturnValueOnce(
          of({
            data: {
              core_platform_mesh_io: {
                v1alpha1: {
                  AccountInfo: {
                    spec: {
                      clusterInfo: { ca: 'cert-data' },
                      oidc: {
                        issuerUrl: 'issuer',
                        clients: '{ "kubectl": { "clientId": "cIdD" } }',
                      },
                    },
                  },
                },
              },
            },
          }),
        );

      const staleRead$ = service.read(namespacedNodeContext);
      await expect(firstValueFrom(staleRead$)).rejects.toThrowError(error);
      await firstValueFrom(service.read(namespacedNodeContext));
      await expect(firstValueFrom(staleRead$)).rejects.toThrowError(error);
      await firstValueFrom(service.read(namespacedNodeContext));

      expect(mockApollo.query).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache after error and retry next call', async () => {
      const error = new Error('temporary fail');
      const accountInfo = {
        spec: {
          clusterInfo: { ca: 'cert-data' },
          oidc: {
            issuerUrl: 'issuer',
            clients: '{ "kubectl": { "clientId": "cIdD" } }',
          },
        },
      };
      mockApollo.query
        .mockReturnValueOnce(throwError(() => error))
        .mockReturnValueOnce(
          of({
            data: {
              core_platform_mesh_io: {
                v1alpha1: {
                  AccountInfo: accountInfo,
                },
              },
            },
          }),
        );

      await expect(
        firstValueFrom(service.read(namespacedNodeContext)),
      ).rejects.toThrowError(error);

      await expect(
        firstValueFrom(service.read(namespacedNodeContext)),
      ).resolves.toMatchObject({
        spec: {
          oidc: { clients: { kubectl: { clientId: 'cIdD' } } },
        },
      });

      expect(mockApollo.query).toHaveBeenCalledTimes(2);
    });
  });
});
