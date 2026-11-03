import { PortalLuigiNode } from '../models/luigi-node';
import {
  createEntityErrorNode,
  errorComponentConfig,
  errorView,
  toEntityErrorNode,
} from './entity-error-node.util';
import { EntityType } from '@openmfp/portal-ui-lib';

describe('entity error node', () => {
  describe('toEntityErrorNode', () => {
    const node = {
      pathSegment: 'dashboard',
      label: 'Dashboard',
      hideSideNav: true,
      viewUrl: '/assets/other.js#other-view',
      viewGroup: 'group',
      compound: { children: [] },
      context: { kcpPath: 'root:orgs:test-org' },
    } as unknown as PortalLuigiNode;

    it('renders the error view instead of the view of the node', () => {
      const errorNode = toEntityErrorNode(node, 404);

      expect(errorNode.viewUrl).toBe(errorView.viewUrl);
      expect(errorNode.webcomponent).toEqual(errorView.webcomponent);
      expect(errorNode.compound).toBeUndefined();
      expect(errorNode.viewGroup).toBeUndefined();
    });

    it('keeps the navigation properties and the context of the node', () => {
      const errorNode = toEntityErrorNode(node, 404);

      expect(errorNode.pathSegment).toBe('dashboard');
      expect(errorNode.label).toBe('Dashboard');
      expect(errorNode.hideSideNav).toBe(true);
      expect(errorNode.context).toEqual({
        kcpPath: 'root:orgs:test-org',
        entityErrorCode: 404,
      });
    });

    it('matches the deeper paths of a virtual tree node with error nodes and keeps it selected', () => {
      const virtualTreeNode = {
        ...node,
        virtualTree: true,
      } as PortalLuigiNode;

      const errorNode = toEntityErrorNode(virtualTreeNode, 404);

      expect(errorNode.virtualTree).toBeUndefined();
      expect(errorNode.keepSelectedForChildren).toBe(true);
      const [child] = (errorNode.children as () => PortalLuigiNode[])();
      expect(child.pathSegment).toBe(':errorPath');
      expect(child.context.entityErrorCode).toBe(404);
    });

    it('keeps the children and the selection of other nodes', () => {
      const children = vi.fn();
      const errorNode = toEntityErrorNode(
        { ...node, children, keepSelectedForChildren: false },
        404,
      );

      expect(errorNode.children).toBe(children);
      expect(errorNode.keepSelectedForChildren).toBe(false);
    });

    it('does not change the given node', () => {
      toEntityErrorNode(node, 404);

      expect(node.viewUrl).toBe('/assets/other.js#other-view');
      expect(node.context.entityErrorCode).toBeUndefined();
    });
  });

  describe('createEntityErrorNode', () => {
    it('creates a hidden dynamic error view node', () => {
      const errorNode = createEntityErrorNode(500);

      expect(errorNode.pathSegment).toBe(':errorPath');
      expect(errorNode.entityType).toBe(EntityType.ENTITY_ERROR);
      expect(errorNode.hideFromNav).toBe(true);
      expect(errorNode.viewUrl).toBe(errorView.viewUrl);
      expect(errorNode.context.entityErrorCode).toBe(500);
    });

    it('matches every deeper path segment with a new node', () => {
      const errorNode = createEntityErrorNode(500);

      const [child] = (errorNode.children as () => PortalLuigiNode[])();

      expect(child).not.toBe(errorNode);
      expect(child.pathSegment).toBe(':errorPath');
      expect(child.context.entityErrorCode).toBe(500);
    });
  });

  describe('errorComponentConfig', () => {
    it('answers a failed entity retrieval with an error node for the status', () => {
      const [errorNode] = errorComponentConfig.handleEntityRetrievalError!(
        { id: 'core_platform-mesh_io_account' },
        403,
      );

      expect(errorNode.entityType).toBe(EntityType.ENTITY_ERROR);
      expect((errorNode.context as any).entityErrorCode).toBe(403);
    });
  });
});
