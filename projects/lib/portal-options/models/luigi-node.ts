import { PortalNodeContext } from './luigi-context';
import type { EntityDefinition } from '@openmfp/portal-ui-lib';
import { LuigiNode } from '@openmfp/portal-ui-lib';

export interface PortalLuigiNode extends LuigiNode {
  defineEntity?: PMEntityDefinition;
  context: PortalNodeContext;
  parent?: PortalLuigiNode;
  keepSelectedForChildren?: boolean;
}

export interface PMEntityDefinition extends EntityDefinition {
  type?: string;
}
