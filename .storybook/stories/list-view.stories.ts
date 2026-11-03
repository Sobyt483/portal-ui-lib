import { ListView } from '../../projects/wc/src/app/components/generic-ui/list-view/list-view.component';
import {
  CANNED_CLUSTER_RESOURCE,
  FAKE_ERROR_HANDLER_SERVICE,
  FAKE_I18N_SERVICE,
  FAKE_INSTANCE_PERMISSIONS_SERVICE,
  MANY_CLUSTER_RESOURCES,
  RICH_CLUSTER_RESOURCES,
  makeDefaultResourceServiceStub,
  makeEmptyResourceServiceStub,
  makeErrorResourceServiceStub,
  makeManyResourceServiceStub,
  makePaginatedResourceServiceStub,
} from './showcase-mocks';
import {
  CLUSTERS_CONTEXT,
  CLUSTERS_RICH_CONTEXT,
  LUIGI_CLIENT,
} from './showcase-presets';
import { I18nService } from '@openmfp/portal-ui-lib';
import {
  ErrorHandlerService,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import { InstancePermissionsService } from '@platform-mesh/portal-ui-lib/services';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<ListView> = {
  title: 'Generic UI / List View',
  component: ListView,
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: ErrorHandlerService,
          useValue: FAKE_ERROR_HANDLER_SERVICE,
        },
        { provide: I18nService, useValue: FAKE_I18N_SERVICE },
        {
          provide: InstancePermissionsService,
          useValue: FAKE_INSTANCE_PERMISSIONS_SERVICE,
        },
      ],
    }),
    moduleMetadata({}),
  ],
  render: (args) => ({
    props: args,
  }),
};

export default meta;
type Story = StoryObj<ListView>;

// ---------------------------------------------------------------------------
// Default — clusters scope with canned data
// ---------------------------------------------------------------------------

export const Default: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: ResourceService,
          useValue: makeDefaultResourceServiceStub([CANNED_CLUSTER_RESOURCE]),
        },
      ],
    }),
  ],
  args: {
    LuigiClient: LUIGI_CLIENT,
    context: CLUSTERS_CONTEXT,
  },
};

// ---------------------------------------------------------------------------
// Empty — no resources → NoData illustrated message
// ---------------------------------------------------------------------------

export const Empty: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: ResourceService,
          useValue: makeEmptyResourceServiceStub(),
        },
      ],
    }),
  ],
  args: {
    LuigiClient: LUIGI_CLIENT,
    context: CLUSTERS_CONTEXT,
  },
};

// ---------------------------------------------------------------------------
// Error — list fails → UnableToLoad illustrated message + Retry button
// ---------------------------------------------------------------------------

export const Error: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: ResourceService,
          useValue: makeErrorResourceServiceStub(),
        },
      ],
    }),
  ],
  args: {
    LuigiClient: LUIGI_CLIENT,
    context: CLUSTERS_CONTEXT,
  },
};

// ---------------------------------------------------------------------------
// Paginated — 30 items; resource-table-card defaults to paginationLimit=5.
// makePaginatedResourceServiceStub honours opts.pagination.{limit,continue}
// so each Load More request fetches the next page of 5 items incrementally.
// ---------------------------------------------------------------------------

export const Paginated: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: ResourceService,
          useValue: makePaginatedResourceServiceStub(MANY_CLUSTER_RESOURCES),
        },
      ],
    }),
  ],
  args: {
    LuigiClient: LUIGI_CLIENT,
    context: CLUSTERS_CONTEXT,
  },
};

// ---------------------------------------------------------------------------
// RichColumns — 10 items + all displayAs column types:
//   tag, boolIcon, link, img, secret, alert, button
// Uses CLUSTERS_RICH_CONTEXT whose definition maps each spec field.
// makeManyResourceServiceStub returns all items at once (rich display focus,
// not pagination). 10 items is enough to show every column type.
// MANY_CLUSTER_RESOURCES (30 items) is kept intact for the Paginated story.
// ---------------------------------------------------------------------------

export const RichColumns: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: ResourceService,
          useValue: makeManyResourceServiceStub(RICH_CLUSTER_RESOURCES),
        },
      ],
    }),
  ],
  args: {
    LuigiClient: LUIGI_CLIENT,
    context: CLUSTERS_RICH_CONTEXT,
  },
};
