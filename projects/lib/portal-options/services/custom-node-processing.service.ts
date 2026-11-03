import { PortalNodeContext } from '../models/luigi-context';
import { PortalLuigiNode } from '../models/luigi-node';
import {
  createEntityErrorNode,
  errorView,
  toEntityErrorNode,
} from '../utils/entity-error-node.util';
import { Injectable, inject } from '@angular/core';
import {
  CustomNodeProcessingService,
  EntityType,
  LuigiNodesService,
} from '@openmfp/portal-ui-lib';

type EntityChildren = (ctx: PortalNodeContext) => Promise<PortalLuigiNode[]>;
type FailedEntityNodeState = Pick<
  PortalLuigiNode,
  | 'keepSelectedForChildren'
  | 'viewUrl'
  | 'webcomponent'
  | 'compound'
  | 'context'
>;

@Injectable({ providedIn: 'root' })
export class CustomNodeProcessingServiceImpl implements CustomNodeProcessingService {
  private luigiNodesService = inject(LuigiNodesService);
  private entityChildrenWrappers = new WeakSet<EntityChildren>();
  private failedEntityNodeStates = new WeakMap<
    PortalLuigiNode,
    FailedEntityNodeState
  >();

  async processNode(
    ctx: PortalNodeContext,
    node: PortalLuigiNode,
  ): Promise<PortalLuigiNode> {
    this.wrapEntityChildren(node);
    return ctx?.entityErrorCode
      ? toEntityErrorNode(node, ctx.entityErrorCode)
      : node;
  }

  private wrapEntityChildren(node: PortalLuigiNode) {
    const children = node.children as EntityChildren | undefined;

    if (
      !node.defineEntity ||
      typeof children !== 'function' ||
      this.entityChildrenWrappers.has(children)
    ) {
      return;
    }

    const wrapper: EntityChildren = (ctx) =>
      this.resolveEntityChildren(node, children, ctx);
    this.entityChildrenWrappers.add(wrapper);
    node.children = wrapper;
  }

  private async resolveEntityChildren(
    node: PortalLuigiNode,
    children: EntityChildren,
    ctx: PortalNodeContext,
  ): Promise<PortalLuigiNode[]> {
    this.restoreEntityNode(node, ctx);
    const isBelowFailedEntity = !!ctx.entityErrorCode;
    const result = (await children(ctx)) ?? [];
    const retrievalFailure = result.find(
      (child) => child.entityType === EntityType.ENTITY_ERROR,
    );
    const code =
      ctx.entityErrorCode ?? retrievalFailure?.context.entityErrorCode;

    if (!code) {
      return result;
    }

    ctx.entityErrorCode = code;

    if (!isBelowFailedEntity) {
      this.luigiNodesService.clearNodeCache();
    }

    if (retrievalFailure || (!result.length && !isBelowFailedEntity)) {
      this.showErrorOnEntityNode(node, code);
      return [createEntityErrorNode(code)];
    }

    return result.map((child) => toEntityErrorNode(child, code));
  }

  private restoreEntityNode(node: PortalLuigiNode, ctx: PortalNodeContext) {
    const state = this.failedEntityNodeStates.get(node);

    if (state) {
      this.failedEntityNodeStates.delete(node);
      delete ctx.entityErrorCode;
      Object.assign(node, state);
    }
  }

  private showErrorOnEntityNode(node: PortalLuigiNode, code: number) {
    this.failedEntityNodeStates.set(node, {
      keepSelectedForChildren: node.keepSelectedForChildren,
      viewUrl: node.viewUrl,
      webcomponent: node.webcomponent,
      compound: node.compound,
      context: node.context,
    });
    Object.assign(node, errorView, {
      keepSelectedForChildren: undefined,
      compound: undefined,
      context: { ...node.context, entityErrorCode: code },
    });
  }
}
