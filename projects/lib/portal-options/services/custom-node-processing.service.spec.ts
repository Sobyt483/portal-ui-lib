import { PortalNodeContext } from '../models/luigi-context';
import { PortalLuigiNode } from '../models/luigi-node';
import {
  createEntityErrorNode,
  errorView,
} from '../utils/entity-error-node.util';
import { CustomNodeProcessingServiceImpl } from './custom-node-processing.service';
import { TestBed } from '@angular/core/testing';
import { LuigiNodesService } from '@openmfp/portal-ui-lib';
import { MockedObject } from 'vitest';
import { mock } from 'vitest-mock-extended';

describe('CustomNodeProcessingServiceImpl', () => {
  let service: CustomNodeProcessingServiceImpl;
  let luigiNodesService: MockedObject<LuigiNodesService>;

  const context = (entityErrorCode?: number) =>
    ({ entityErrorCode }) as PortalNodeContext;

  const childNode = (pathSegment = 'dashboard') =>
    ({
      pathSegment,
      label: pathSegment,
      viewUrl: '/assets/wc.js#generic-detail-view',
      context: {},
    }) as unknown as PortalLuigiNode;

  const entityNode = (
    children: (ctx: PortalNodeContext) => Promise<PortalLuigiNode[]>,
  ) =>
    ({
      pathSegment: ':accountId',
      keepSelectedForChildren: false,
      defineEntity: { id: 'account' },
      context: { accountId: ':accountId' },
      children,
    }) as unknown as PortalLuigiNode;

  const resolveChildren = (node: PortalLuigiNode, ctx: PortalNodeContext) =>
    (node.children as (ctx: PortalNodeContext) => Promise<PortalLuigiNode[]>)(
      ctx,
    );

  beforeEach(() => {
    luigiNodesService = mock<LuigiNodesService>();

    TestBed.configureTestingModule({
      providers: [
        CustomNodeProcessingServiceImpl,
        { provide: LuigiNodesService, useValue: luigiNodesService },
      ],
    });

    service = TestBed.inject(CustomNodeProcessingServiceImpl);
  });

  describe('processNode', () => {
    it('returns the same node when no entity above has failed', async () => {
      const node = childNode();

      expect(await service.processNode(context(), node)).toBe(node);
    });

    it('returns the same node when Luigi passes no context', async () => {
      const node = childNode();

      expect(
        await service.processNode(
          undefined as unknown as PortalNodeContext,
          node,
        ),
      ).toBe(node);
    });

    it('returns an error node when an entity above has failed', async () => {
      const node = childNode();

      const processed = await service.processNode(context(404), node);

      expect(processed.pathSegment).toBe('dashboard');
      expect(processed.viewUrl).toBe(errorView.viewUrl);
      expect(processed.context.entityErrorCode).toBe(404);
    });

    it('leaves the children of a node without an entity definition alone', async () => {
      const children = vi.fn();
      const node = { ...childNode(), children } as PortalLuigiNode;

      await service.processNode(context(), node);

      expect(node.children).toBe(children);
    });

    it('leaves an entity node with static children alone', async () => {
      const children = [childNode()];
      const node = {
        ...childNode(),
        defineEntity: { id: 'account' },
        children,
      } as PortalLuigiNode;

      await service.processNode(context(), node);

      expect(node.children).toBe(children);
    });

    it('exposes entity children as a plain function, the only kind Luigi calls', async () => {
      const node = entityNode(async () => []);

      await service.processNode(context(), node);

      expect({}.toString.call(node.children)).toBe('[object Function]');
    });

    it('does not wrap entity children twice', async () => {
      const node = entityNode(async () => []);

      await service.processNode(context(), node);
      const wrapper = node.children;
      await service.processNode(context(), node);

      expect(node.children).toBe(wrapper);
    });

    it('wraps entity children again after they were reassigned', async () => {
      const node = entityNode(async () => []);

      await service.processNode(context(), node);
      const replacement = vi.fn().mockResolvedValue([]);
      node.children = replacement;
      await service.processNode(context(), node);

      expect(node.children).not.toBe(replacement);
      await resolveChildren(node, context());
      expect(replacement).toHaveBeenCalled();
    });
  });

  describe('entity children', () => {
    it('returns the children untouched for a healthy entity', async () => {
      const children = [childNode()];
      const node = entityNode(async () => children);
      await service.processNode(context(), node);

      expect(await resolveChildren(node, context())).toBe(children);
      expect(luigiNodesService.clearNodeCache).not.toHaveBeenCalled();
    });

    it('passes the context to the original children function', async () => {
      const original = vi.fn().mockResolvedValue([]);
      const node = entityNode(original);
      const ctx = context();
      await service.processNode(context(), node);

      await resolveChildren(node, ctx);

      expect(original).toHaveBeenCalledWith(ctx);
    });

    it('handles an original children function resolving to nothing', async () => {
      const node = entityNode(async () => undefined as any);
      await service.processNode(context(), node);

      expect(await resolveChildren(node, context())).toEqual([]);
    });

    describe('when the entity failed and has child nodes', () => {
      const failingEntity = (children: PortalLuigiNode[]) =>
        entityNode(async (ctx) => {
          ctx.entityErrorCode = 403;
          return children;
        });

      it('turns every child into an error node and keeps its navigation properties', async () => {
        const node = failingEntity([
          childNode('dashboard'),
          childNode('members'),
        ]);
        await service.processNode(context(), node);

        const children = await resolveChildren(node, context());

        expect(children.map((child) => child.pathSegment)).toEqual([
          'dashboard',
          'members',
        ]);
        children.forEach((child) => {
          expect(child.viewUrl).toBe(errorView.viewUrl);
          expect(child.context.entityErrorCode).toBe(403);
        });
      });

      it('keeps the entity node and its side navigation as they are', async () => {
        const node = failingEntity([childNode()]);
        await service.processNode(context(), node);

        await resolveChildren(node, context());

        expect(node.viewUrl).toBeUndefined();
        expect(node.keepSelectedForChildren).toBe(false);
      });

      it('clears the node cache so that a retry reads the nodes again', async () => {
        const node = failingEntity([childNode()]);
        await service.processNode(context(), node);

        await resolveChildren(node, context());

        expect(luigiNodesService.clearNodeCache).toHaveBeenCalled();
      });
    });

    describe('when the entity failed without child nodes', () => {
      const failingEntity = () =>
        entityNode(async (ctx) => {
          ctx.entityErrorCode = 404;
          return [];
        });

      it('returns a hidden error node for every deeper path', async () => {
        const node = failingEntity();
        await service.processNode(context(), node);

        const [child, ...others] = await resolveChildren(node, context());

        expect(others).toEqual([]);
        expect(child.pathSegment).toBe(':errorPath');
        expect(child.hideFromNav).toBe(true);
        expect(child.context.entityErrorCode).toBe(404);
      });

      it('renders the error on the entity node so that its URL stays', async () => {
        const node = failingEntity();
        await service.processNode(context(), node);

        await resolveChildren(node, context());

        expect(node.viewUrl).toBe(errorView.viewUrl);
        expect(node.webcomponent).toEqual(errorView.webcomponent);
        expect(node.context.entityErrorCode).toBe(404);
      });

      it('falls back to the side navigation of the parent', async () => {
        const node = failingEntity();
        await service.processNode(context(), node);

        await resolveChildren(node, context());

        expect(node.keepSelectedForChildren).toBeUndefined();
      });

      it('clears the node cache so that a retry reads the nodes again', async () => {
        const node = failingEntity();
        await service.processNode(context(), node);

        await resolveChildren(node, context());

        expect(luigiNodesService.clearNodeCache).toHaveBeenCalled();
      });

      it('restores the entity node when it is resolved again', async () => {
        const original = vi
          .fn()
          .mockImplementationOnce(async (ctx: PortalNodeContext) => {
            ctx.entityErrorCode = 404;
            return [];
          })
          .mockResolvedValueOnce([childNode()]);
        const node = entityNode(original);
        const healthyContext = node.context;
        await service.processNode(context(), node);
        await resolveChildren(node, context());

        const staleContext = { ...node.context } as PortalNodeContext;
        const children = await resolveChildren(node, staleContext);

        expect(staleContext.entityErrorCode).toBeUndefined();
        expect(children[0].viewUrl).toBe('/assets/wc.js#generic-detail-view');
        expect(node.viewUrl).toBeUndefined();
        expect(node.webcomponent).toBeUndefined();
        expect(node.keepSelectedForChildren).toBe(false);
        expect(node.context).toBe(healthyContext);
      });
    });

    describe('when the entity retrieval failed', () => {
      const failingRetrieval = (code: number) =>
        entityNode(async () => [createEntityErrorNode(code)]);

      it('uses the status of the retrieval as the error code', async () => {
        const node = failingRetrieval(500);
        const ctx = context();
        await service.processNode(context(), node);

        const [child] = await resolveChildren(node, ctx);

        expect(ctx.entityErrorCode).toBe(500);
        expect(child.context.entityErrorCode).toBe(500);
        expect(node.viewUrl).toBe(errorView.viewUrl);
        expect(node.keepSelectedForChildren).toBeUndefined();
      });

      it('prefers the error of the entity over the status of the retrieval', async () => {
        const node = entityNode(async (ctx) => {
          ctx.entityErrorCode = 404;
          return [createEntityErrorNode(500)];
        });
        const ctx = context();
        await service.processNode(context(), node);

        const [child] = await resolveChildren(node, ctx);

        expect(ctx.entityErrorCode).toBe(404);
        expect(child.context.entityErrorCode).toBe(404);
      });

      it('clears the node cache because the failed retrieval stays cached', async () => {
        const node = failingRetrieval(500);
        await service.processNode(context(), node);

        await resolveChildren(node, context());

        expect(luigiNodesService.clearNodeCache).toHaveBeenCalled();
      });
    });

    describe('when an entity above has already failed', () => {
      it('turns the children into error nodes without clearing the node cache again', async () => {
        const node = entityNode(async () => [childNode()]);
        await service.processNode(context(), node);

        const [child] = await resolveChildren(node, context(404));

        expect(child.viewUrl).toBe(errorView.viewUrl);
        expect(child.context.entityErrorCode).toBe(404);
        expect(luigiNodesService.clearNodeCache).not.toHaveBeenCalled();
      });

      it('adds no hidden error node to a leaf so the side navigation shows its siblings', async () => {
        const node = entityNode(async () => []);
        await service.processNode(context(), node);

        expect(await resolveChildren(node, context(404))).toEqual([]);
        expect(node.viewUrl).toBeUndefined();
        expect(node.keepSelectedForChildren).toBe(false);
      });
    });
  });
});
