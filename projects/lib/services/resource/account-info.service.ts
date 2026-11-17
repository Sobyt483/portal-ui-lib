import { accountInfoRead } from './account-info.queries';
import { ApolloFactory } from './apollo-factory';
import { GatewayService } from './gateway.service';
import { ResourceNodeContext } from './resource-node-context';
import { Injectable, inject } from '@angular/core';
import { AccountInfo } from '@platform-mesh/portal-ui-lib/models';
import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AccountInfoService {
  private apolloFactory = inject(ApolloFactory);
  private gatewayService = inject(GatewayService);
  private readCache = new Map<string, Observable<AccountInfo>>();

  read(nodeContext: ResourceNodeContext): Observable<AccountInfo> {
    const cacheKey = this.gatewayService.getGatewayUrl(nodeContext);
    const cachedRead = this.readCache.get(cacheKey);
    if (cachedRead) {
      return cachedRead;
    }

    const request$ = this.apolloFactory
      .apollo(nodeContext)
      .query<AccountInfo>({
        query: accountInfoRead,
      })
      .pipe(
        map((res: any) => {
          const rawAccountInfo =
            res.data.core_platform_mesh_io.v1alpha1.AccountInfo;
          const rawOidc = rawAccountInfo.spec.oidc;

          return {
            ...rawAccountInfo,
            spec: {
              ...rawAccountInfo.spec,
              oidc: rawOidc
                ? { ...rawOidc, clients: JSON.parse(rawOidc.clients) }
                : undefined,
            },
          };
        }),
        shareReplay(1),
        catchError((error) => {
          if (this.readCache.get(cacheKey) === request$) {
            this.readCache.delete(cacheKey);
          }
          return throwError(() => error);
        }),
      );

    this.readCache.set(cacheKey, request$);
    return request$;
  }
}
