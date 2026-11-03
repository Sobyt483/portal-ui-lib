import { PortalNodeContext } from '../models/luigi-context';
import { PortalLuigiNode } from '../models/luigi-node';
import { CrdGatewayKcpPatchResolver } from './crd-gateway-kcp-patch-resolver.service';
import { NamespacedResourceSelectionService } from './namespaced-resource-selection.service';
import { Injectable, inject } from '@angular/core';
import { NodeContextProcessingService } from '@openmfp/portal-ui-lib';
import { AccountInfo } from '@platform-mesh/portal-ui-lib/models';
import {
  AccountInfoService,
  ErrorHandlerService,
  InstancePermissionsService,
  NamespaceService,
  OrganizationReadyService,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import {
  isNamespacedResource,
  permissionKey,
} from '@platform-mesh/portal-ui-lib/utils';
import { firstValueFrom } from 'rxjs';

const ORGANIZATION_NOT_READY_ERROR_CODE = 503;

@Injectable({
  providedIn: 'root',
})
export class NodeContextProcessingServiceImpl implements NodeContextProcessingService {
  private crdGatewayKcpPatchResolver = inject(CrdGatewayKcpPatchResolver);
  private accountInfoService = inject(AccountInfoService);
  private instancePermissionsService = inject(InstancePermissionsService);
  private organizationReadyService = inject(OrganizationReadyService);
  private errorHandlerService = inject(ErrorHandlerService);
  private namespaceService = inject(NamespaceService);
  private namespacedResourceSelectionService = inject(
    NamespacedResourceSelectionService,
  );

  public async processNodeContext(
    dynamicEntityId: string,
    entityNode: PortalLuigiNode,
    ctx: PortalNodeContext,
  ) {
    const kind = entityNode.defineEntity?.type;
    const entityId =
      dynamicEntityId || entityNode.context.resourceDefinition?.name;

    if (!entityId || ctx.entityErrorCode) {
      return;
    }

    const { kcpPath, accountPath } =
      await this.crdGatewayKcpPatchResolver.resolveCrdGatewayKcpPath(
        entityNode,
        entityId,
        kind,
      );

    const namespace = this.namespacedResourceSelectionService.resolveNamespace(
      entityNode,
      entityId,
      kcpPath,
      ctx,
    );

    // update the current already calculated by Luigi context for a node
    this.addFieldsToContext(
      ctx,
      entityId,
      kcpPath,
      accountPath,
      kind,
      namespace,
    );

    // update the node context of sa node to contain the entity for future context calculations
    this.addFieldsToContext(
      entityNode.context,
      entityId,
      kcpPath,
      accountPath,
      kind,
      namespace,
    );

    await this.addNamespacesToContext(ctx, namespace);

    this.accamulatePortalPermissions(ctx);
    this.getEntityPermissions(ctx, namespace);
    try {
      const accountInfo = await firstValueFrom(
        this.accountInfoService.read({
          portalContext: {
            crdGatewayApiUrl: ctx.portalContext.crdGatewayApiUrl,
          },
          token: ctx.token,
          accountId: entityId,
        }),
      );

      // update the current already calculated by Luigi context for a node
      this.addFieldsToContextFromAccountInfo(ctx, entityId, accountInfo);

      // update the node context of sa node to contain the entity for future context calculations
      this.addFieldsToContextFromAccountInfo(
        entityNode.context,
        entityId,
        accountInfo,
      );

      // we were able to ready the account info so on this kcpPath we can query for the organization ready state
      if (!(await this.organizationReadyService.isOrganizationReady())) {
        ctx.entityErrorCode = ORGANIZATION_NOT_READY_ERROR_CODE;
      }
    } catch (e) {
      ctx.entityErrorCode = this.errorHandlerService.errorCode(e);
      console.error('Failed to read account info.', e);
    }
  }

  private addFieldsToContext(
    ctx: PortalNodeContext,
    entityId: string | undefined,
    kcpPath: string,
    accountPath: string | undefined,
    kind: string | undefined,
    namespace: string | undefined,
  ) {
    ctx.kcpPath = kcpPath;
    ctx.entityName = entityId;
    ctx.entityKind = kind;
    ctx.accountPath = accountPath;
    ctx.namespaceId = namespace;
  }

  private async addNamespacesToContext(
    ctx: PortalNodeContext,
    namespace: string | undefined,
  ) {
    if (!isNamespacedResource(ctx) || namespace) {
      return;
    }

    try {
      ctx.namespaces = await firstValueFrom(this.namespaceService.list(ctx));
    } catch (e) {
      this.errorHandlerService.handleError(e, 'Failed to read namespaces.');
    }
  }

  private addFieldsToContextFromAccountInfo(
    ctx: PortalNodeContext,
    entityId: string,
    accountInfo: AccountInfo,
  ) {
    const accountOriginClusterId = accountInfo.spec.account.originClusterId;
    const organizationOriginClusterId =
      accountInfo.spec.organization.originClusterId;
    const organization = accountInfo.spec.organization.name;

    ctx.organizationId = `${organizationOriginClusterId}/${organization}`;
    ctx.entityId = `${accountOriginClusterId}/${entityId}`;
    ctx.kcpCA = btoa(accountInfo.spec.clusterInfo.ca);
  }

  private getEntityPermissions(
    ctx: PortalNodeContext,
    namespace: string | undefined,
  ) {
    const resourceDefinition = ctx.resourceDefinition;

    if (!resourceDefinition || !resourceDefinition?.permissionsDefinition) {
      return;
    }

    const name = ctx[resourceDefinition.permissionsDefinition.entityContextKey];

    if (!name) {
      return;
    }

    return this.instancePermissionsService
      .checkInstance(ctx, resourceDefinition.permissionsDefinition!, {
        name,
        namespace,
      })
      .subscribe((result) => {
        const portalPermissions = ctx.portalPermissions ?? {};

        result.forEach((permission) => {
          portalPermissions[`${permissionKey(permission)}`] =
            permission.actions;
        });

        ctx.portalPermissions = portalPermissions;
      });
  }

  private accamulatePortalPermissions(ctx: PortalNodeContext) {
    const portalPermissions = ctx.portalPermissions ?? {};

    ctx.nodesPermissions?.forEach((permission) => {
      portalPermissions[permission.resource] = permission.actions;
    });

    ctx.portalPermissions = portalPermissions;
  }
}
