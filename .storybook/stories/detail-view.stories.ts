import { DetailView } from '../../projects/wc/src/app/components/generic-ui/detail-view/detail-view.component';
import {
  CANNED_CLUSTER_RESOURCE,
  FAKE_ACCOUNT_INFO_SERVICE,
  FAKE_ERROR_HANDLER_SERVICE,
  FAKE_GATEWAY_SERVICE,
  FAKE_I18N_SERVICE,
  FAKE_INSTANCE_PERMISSIONS_SERVICE,
  FAKE_KUBECONFIG_SECRET_SERVICE,
  makeDefaultResourceServiceStub,
  makeErrorResourceServiceStub,
} from './showcase-mocks';
import {
  CLUSTERS_CONTEXT,
  LUIGI_CLIENT,
  WITH_ACTIONS_CONTEXT,
} from './showcase-presets';
import { I18nService } from '@openmfp/portal-ui-lib';
import {
  AccountInfoService,
  ErrorHandlerService,
  GatewayService,
  InstancePermissionsService,
  KubeconfigSecretService,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { EMPTY, of } from 'rxjs';

// ---------------------------------------------------------------------------
// A ResourceService stub that returns null to trigger "not found" state
// ---------------------------------------------------------------------------

const NOT_FOUND_RESOURCE_SERVICE: Partial<ResourceService> = {
  list: (_op: any, _fields: any, _ctx: any) =>
    of({
      items: [],
      resourceVersion: '1',
      continue: undefined,
      remainingItemCount: 0,
    }),
  read: (_id: any, _params: any, _fields: any, _ctx: any) => of(null) as any,
  resourceChangeSubscription: () => EMPTY,
  create: () => of({}) as any,
  update: () => of({}) as any,
  delete: () => of({}) as any,
  getNamespace: (ctx: any) => ctx?.namespaceId,
  isAvailable: () => true,
};

// ---------------------------------------------------------------------------
// Meta — shared providers for all detail-view stories
// ---------------------------------------------------------------------------

const meta: Meta<DetailView> = {
  title: 'Generic UI / Detail View',
  component: DetailView,
  decorators: [
    applicationConfig({
      providers: [
        { provide: ErrorHandlerService, useValue: FAKE_ERROR_HANDLER_SERVICE },
        { provide: I18nService, useValue: FAKE_I18N_SERVICE },
        { provide: GatewayService, useValue: FAKE_GATEWAY_SERVICE },
        { provide: AccountInfoService, useValue: FAKE_ACCOUNT_INFO_SERVICE },
        {
          provide: KubeconfigSecretService,
          useValue: FAKE_KUBECONFIG_SECRET_SERVICE,
        },
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
type Story = StoryObj<DetailView>;

// ---------------------------------------------------------------------------
// Default — clusters scope, resource loaded
// ---------------------------------------------------------------------------

export const Default: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: ResourceService,
          useValue: makeDefaultResourceServiceStub(
            [CANNED_CLUSTER_RESOURCE],
            CANNED_CLUSTER_RESOURCE,
          ),
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
// WithActions — includes download kubeconfig button + custom navigate action
// (showDownloadKubeconfig:true + ui.detailView.actions with navigate button)
// ---------------------------------------------------------------------------

export const WithActions: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: ResourceService,
          useValue: makeDefaultResourceServiceStub(
            [CANNED_CLUSTER_RESOURCE],
            CANNED_CLUSTER_RESOURCE,
          ),
        },
      ],
    }),
  ],
  args: {
    LuigiClient: LUIGI_CLIENT,
    context: WITH_ACTIONS_CONTEXT,
  },
};

// ---------------------------------------------------------------------------
// NotFound — read returns null → NoEntries "Resource not found"
// ---------------------------------------------------------------------------

export const NotFound: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: ResourceService,
          useValue: NOT_FOUND_RESOURCE_SERVICE,
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
// Error — read throws error → UnableToLoad "Could not load resource"
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
