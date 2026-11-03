import { LogicalClusterService } from './resource';
import { Injectable, inject } from '@angular/core';
import {
  AuthService,
  ConfigService,
  EnvConfigService,
} from '@openmfp/portal-ui-lib';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrganizationReadyService {
  private configService = inject(ConfigService);
  private envConfigService = inject(EnvConfigService);
  private logicalClusterService = inject(LogicalClusterService);
  private authService = inject(AuthService);

  private isReady = false;
  private pendingCheck?: Promise<boolean>;

  public isOrganizationReady(): Promise<boolean> {
    if (this.isReady) {
      return Promise.resolve(true);
    }

    this.pendingCheck ??= this.readOrganizationReady().finally(() => {
      this.pendingCheck = undefined;
    });

    return this.pendingCheck;
  }

  private async readOrganizationReady(): Promise<boolean> {
    const portalConfig = await this.configService.getPortalConfig();
    const { idpName } = await this.envConfigService.getEnvConfig();

    if (idpName === 'welcome') {
      return true;
    }

    try {
      const logicalCluster = await firstValueFrom(
        this.logicalClusterService.read({
          portalContext: {
            crdGatewayApiUrl: portalConfig.portalContext['crdGatewayApiUrl'],
          },
          token: this.authService.getToken(),
          accountId: idpName,
        }),
      );
      this.isReady = logicalCluster.status.phase === 'Ready';
      return this.isReady;
    } catch (error) {
      console.error('Org check failed', error);
      return true;
    }
  }
}
