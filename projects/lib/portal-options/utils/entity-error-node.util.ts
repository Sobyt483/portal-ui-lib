import { PortalNodeContext } from '../models/luigi-context';
import { PortalLuigiNode } from '../models/luigi-node';
import { EntityType, ErrorComponentConfig } from '@openmfp/portal-ui-lib';

export const errorView: Pick<PortalLuigiNode, 'viewUrl' | 'webcomponent'> = {
  viewUrl: '/assets/platform-mesh-portal-ui-wc.js#error-component',
  webcomponent: {
    selfRegistered: true,
    type: 'module',
  },
};

export function toEntityErrorNode(
  node: PortalLuigiNode,
  code: number,
): PortalLuigiNode {
  return {
    ...node,
    ...errorView,
    compound: undefined,
    viewGroup: undefined,
    virtualTree: undefined,
    ...(node.virtualTree && {
      keepSelectedForChildren: true,
      children: () => [createEntityErrorNode(code)],
    }),
    context: { ...node.context, entityErrorCode: code },
  };
}

export function createEntityErrorNode(code: number): PortalLuigiNode {
  return toEntityErrorNode(
    {
      pathSegment: ':errorPath',
      entityType: EntityType.ENTITY_ERROR,
      hideFromNav: true,
      context: {} as PortalNodeContext,
      children: () => [createEntityErrorNode(code)],
    },
    code,
  );
}

export const errorComponentConfig: ErrorComponentConfig = {
  handleEntityRetrievalError: (_entityDefinition, errorCode) => [
    createEntityErrorNode(errorCode),
  ],
};
