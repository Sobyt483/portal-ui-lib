import { NodeContext } from '@openmfp/portal-ui-lib';
import {
  Permission,
  ResourceDefinition,
} from '@platform-mesh/portal-ui-lib/models';

export interface PortalContext extends Record<string, any> {
  crdGatewayApiUrl: string;
}

interface PortalEntityContext {
  account: {
    id: string;
  };
}

export interface PortalNodeContext extends NodeContext {
  portalContext: PortalContext;
  organizationId?: string;
  kcpCA?: string;
  kcpPath?: string;
  accountPath?: string;
  translationTable?: any;
  namespaceId?: string;
  namespaces?: string[];
  entityErrorCode?: number;
  entityName?: string;
  entityKind?: string;
  entityId?: string;
  entityContext?: PortalEntityContext;
  resourceDefinition?: ResourceDefinition;
  nodesPermissions?: Permission[];
  portalPermissions?: { [key: string]: string[] };
}
