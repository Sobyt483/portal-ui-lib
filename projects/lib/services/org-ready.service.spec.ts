import { OrganizationReadyService } from './org-ready.service';
import { TestBed } from '@angular/core/testing';
import {
  AuthService,
  ConfigService,
  EnvConfigService,
} from '@openmfp/portal-ui-lib';
import { LogicalClusterService } from '@platform-mesh/portal-ui-lib/services';
import { Subject, of, throwError } from 'rxjs';
import { MockedObject } from 'vitest';
import { mock } from 'vitest-mock-extended';

describe('OrganizationReadyService', () => {
  let mockConfigService: MockedObject<ConfigService>;
  let mockEnvConfigService: MockedObject<EnvConfigService>;
  let mockAuthService: MockedObject<AuthService>;
  let mockLogicalClusterService: MockedObject<LogicalClusterService>;
  let service: OrganizationReadyService;

  const logicalClusterInPhase = (phase: string) => of({ status: { phase } });

  beforeEach(() => {
    mockConfigService = mock();
    mockEnvConfigService = mock();
    mockAuthService = mock();
    mockLogicalClusterService = mock();

    mockConfigService.getPortalConfig.mockResolvedValue({
      portalContext: { crdGatewayApiUrl: 'http://crd-gateway' },
    } as any);

    mockEnvConfigService.getEnvConfig.mockResolvedValue({
      idpName: 'account-1',
    } as any);

    mockAuthService.getToken.mockReturnValue('token-1');

    TestBed.configureTestingModule({
      providers: [
        OrganizationReadyService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EnvConfigService, useValue: mockEnvConfigService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: LogicalClusterService, useValue: mockLogicalClusterService },
      ],
    });

    service = TestBed.inject(OrganizationReadyService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the logical cluster with the expected context', async () => {
    mockLogicalClusterService.read.mockReturnValueOnce(
      logicalClusterInPhase('Ready'),
    );

    await service.isOrganizationReady();

    expect(mockLogicalClusterService.read).toHaveBeenCalledExactlyOnceWith({
      portalContext: {
        crdGatewayApiUrl: 'http://crd-gateway',
      },
      token: 'token-1',
      accountId: 'account-1',
    });
  });

  it('does not read again once the organization is ready', async () => {
    mockLogicalClusterService.read.mockReturnValueOnce(
      logicalClusterInPhase('Ready'),
    );

    expect(await service.isOrganizationReady()).toBe(true);
    expect(await service.isOrganizationReady()).toBe(true);

    expect(mockLogicalClusterService.read).toHaveBeenCalledTimes(1);
  });

  it('reports not ready and reads again until the organization is ready', async () => {
    mockLogicalClusterService.read
      .mockReturnValueOnce(logicalClusterInPhase('Initializing'))
      .mockReturnValueOnce(logicalClusterInPhase('Ready'));

    expect(await service.isOrganizationReady()).toBe(false);
    expect(await service.isOrganizationReady()).toBe(true);

    expect(mockLogicalClusterService.read).toHaveBeenCalledTimes(2);
  });

  it('shares one read between concurrent checks', async () => {
    const logicalCluster$ = new Subject<any>();
    mockLogicalClusterService.read.mockReturnValueOnce(logicalCluster$);

    const checks = Promise.all([
      service.isOrganizationReady(),
      service.isOrganizationReady(),
    ]);
    await vi.waitFor(() =>
      expect(mockLogicalClusterService.read).toHaveBeenCalled(),
    );
    logicalCluster$.next({ status: { phase: 'Ready' } });

    expect(await checks).toEqual([true, true]);
    expect(mockLogicalClusterService.read).toHaveBeenCalledTimes(1);
  });

  it('reports ready without reading when the env idpName is welcome', async () => {
    mockEnvConfigService.getEnvConfig.mockResolvedValueOnce({
      idpName: 'welcome',
    } as any);

    expect(await service.isOrganizationReady()).toBe(true);

    expect(mockLogicalClusterService.read).not.toHaveBeenCalled();
  });

  it('logs a failed read, reports ready and reads again on the next check', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('API error');
    mockLogicalClusterService.read
      .mockReturnValueOnce(throwError(() => error))
      .mockReturnValueOnce(logicalClusterInPhase('Initializing'));

    expect(await service.isOrganizationReady()).toBe(true);
    expect(await service.isOrganizationReady()).toBe(false);

    expect(consoleSpy).toHaveBeenCalledWith('Org check failed', error);
    expect(mockLogicalClusterService.read).toHaveBeenCalledTimes(2);
  });
});
