import { PortalLuigiNode } from '../models/luigi-node';
import { PersistentPanelService } from '../persistent-panel/persistent-panel.service';
import { CrdGatewayKcpPatchResolver } from './crd-gateway-kcp-patch-resolver.service';
import { NamespacedResourceSelectionService } from './namespaced-resource-selection.service';
import { Injectable, inject } from '@angular/core';
import {
  LuigiCoreService,
  NodeChangeHookConfigService,
  NodeContext,
} from '@openmfp/portal-ui-lib';

@Injectable({ providedIn: 'root' })
export class NodeChangeHookConfigServiceImpl implements NodeChangeHookConfigService {
  private luigiCoreService = inject(LuigiCoreService);
  private crdGatewayKcpPatchResolver = inject(CrdGatewayKcpPatchResolver);
  private persistentPanelService = inject(PersistentPanelService);
  private namespacedResourceSelectionService = inject(
    NamespacedResourceSelectionService,
  );

  async nodeChangeHook(
    prevNode: PortalLuigiNode,
    nextNode: PortalLuigiNode,
    currentContext: NodeContext,
  ) {
    this.namespacedResourceSelectionService.restoreNamespaceSearchParam(
      nextNode,
      currentContext,
    );

    const updatePersistentPanelTarget =
      this.persistentPanelService.beginTargetUpdate();

    if (nextNode.initialRoute && nextNode.virtualTree) {
      this.luigiCoreService.navigation().navigate(nextNode.initialRoute);
    }

    this.accumulatePortalPermissions(prevNode, nextNode, currentContext);
    await this.crdGatewayKcpPatchResolver.resolveCrdGatewayKcpPath(nextNode);
    updatePersistentPanelTarget({
      ...currentContext,
      ...(nextNode.context ?? {}),
    });
  }

  private accumulatePortalPermissions(
    prevNode: PortalLuigiNode,
    nextNode: PortalLuigiNode,
    currentContext: NodeContext,
  ) {
    const portalPermissions =
      prevNode?.context?.portalPermissions ??
      currentContext?.portalPermissions ??
      {};

    nextNode.context?.nodesPermissions?.forEach((permission) => {
      portalPermissions[permission.resource] = permission.actions;
    });

    currentContext.portalPermissions = portalPermissions;

    if (nextNode.context) {
      nextNode.context.portalPermissions = portalPermissions;
    }
  }
}
