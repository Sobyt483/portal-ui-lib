import { SearchListDynamicPage } from '../../projects/wc/src/app/components/generic-ui/search-list-dynamic-page/search-list-dynamic-page.component';
import { OpenSearchService } from '../../projects/wc/src/app/components/generic-ui/search-list-dynamic-page/services/open-search.service';
import {
  CANNED_CLUSTER_RESOURCE,
  FAKE_ERROR_HANDLER_SERVICE,
  FAKE_I18N_SERVICE,
  FAKE_INSTANCE_PERMISSIONS_SERVICE,
  makeDefaultResourceServiceStub,
  makeFakeLuigiClientWithModal,
  makePagedOpenSearchServiceStub,
} from './showcase-mocks';
import {
  CANNED_OPEN_SEARCH_RESULTS,
  CANNED_OPEN_SEARCH_RESULTS_PAGINATED,
  CANNED_OPEN_SEARCH_RESULTS_RICH,
  CLUSTERS_CONTEXT,
  CLUSTERS_MODAL_CONTEXT,
  CLUSTERS_RICH_CONTEXT,
  LUIGI_CLIENT,
  WITH_ACTIONS_CONTEXT,
} from './showcase-presets';
import { I18nService } from '@openmfp/portal-ui-lib';
import {
  ErrorHandlerService,
  InstancePermissionsService,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { of, throwError } from 'rxjs';

// ---------------------------------------------------------------------------
// Open-search service stubs
// ---------------------------------------------------------------------------

const SEARCH_DEFAULT_SERVICE: Partial<OpenSearchService> = {
  listResources: (_ctx: any, _req: any) => of(CANNED_OPEN_SEARCH_RESULTS),
};

const SEARCH_EMPTY_SERVICE: Partial<OpenSearchService> = {
  listResources: (_ctx: any, _req: any) =>
    of({ results: [], totalCount: 0, source: 'mock', nextCursor: '' }),
};

/** Status 500 shows UnableToLoad + Retry. Status 403 shows tnt/UnsuccessfulAuth. */
const SEARCH_ERROR_SERVICE: Partial<OpenSearchService> = {
  listResources: (_ctx: any, _req: any) =>
    throwError(() => ({
      status: 500,
      message: 'Search failed',
      title: 'Server error',
    })),
};

const SEARCH_PERMISSION_ERROR_SERVICE: Partial<OpenSearchService> = {
  listResources: (_ctx: any, _req: any) =>
    throwError(() => ({
      status: 403,
      message: 'Search permission denied',
      title: 'Unauthorized',
    })),
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<SearchListDynamicPage> = {
  title: 'Generic UI / Search List Dynamic Page',
  component: SearchListDynamicPage,
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
        {
          provide: ResourceService,
          useValue: makeDefaultResourceServiceStub(),
        },
      ],
    }),
    moduleMetadata({}),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  // Wrap in an explicit 100vh container so ui5-dynamic-page gets a real bounded
  // height. Pure CSS on #storybook-root / pm-search-list-dynamic-page was
  // insufficient across two attempts — ui5-dynamic-page stayed at ~152px.
  // An explicit fixed-height parent gives the component and ui5-dynamic-page a
  // concrete pixel boundary to fill, regardless of how the Storybook shell
  // computes surrounding heights.
  render: (args) => ({
    props: args,
    template: `
      <div style="height:100vh; display:flex; flex-direction:column; min-height:0; overflow:hidden;">
        <pm-search-list-dynamic-page
          [LuigiClient]="LuigiClient"
          [context]="context"
          style="flex:1 1 auto; min-height:0;"
        />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<SearchListDynamicPage>;

// ---------------------------------------------------------------------------
// Default — canned results, first page
// ---------------------------------------------------------------------------

export const Default: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: OpenSearchService,
          useValue: SEARCH_DEFAULT_SERVICE,
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
// WithFilters — same data but context includes listView.filters (tabs)
// ---------------------------------------------------------------------------

export const WithFilters: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: OpenSearchService,
          useValue: SEARCH_DEFAULT_SERVICE,
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
// CreateViaModal — toolbar openInModal button; the fake LuigiClient resolves
// a canned ModalResult so handleModalResult → onCreateSubmit → list() fires.
//
// NOTE: The actual modal UI is rendered by the Luigi shell as a routed
// micro-frontend. In Storybook there is no Luigi shell, so no visible modal
// appears when the button is clicked. The story demonstrates:
//   1. The "Create (modal)" toolbar button renders (via listView.actions).
//   2. CLUSTERS_MODAL_CONTEXT has NO createView.fields, so no built-in Create
//      button appears — only the openInModal action button is shown.
//   3. The fake openAsModal immediately resolves a submit ModalResult, causing
//      onCreateSubmit → list() to re-run (observable side-effect, headless).
// ---------------------------------------------------------------------------

export const CreateViaModal: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: OpenSearchService,
          useValue: SEARCH_DEFAULT_SERVICE,
        },
        {
          provide: ResourceService,
          useValue: makeDefaultResourceServiceStub([CANNED_CLUSTER_RESOURCE]),
        },
      ],
    }),
  ],
  args: {
    LuigiClient: makeFakeLuigiClientWithModal(CANNED_CLUSTER_RESOURCE),
    context: CLUSTERS_MODAL_CONTEXT,
  },
};

// ---------------------------------------------------------------------------
// Empty — no results → NoData illustrated message
// ---------------------------------------------------------------------------

export const Empty: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: OpenSearchService,
          useValue: SEARCH_EMPTY_SERVICE,
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
// Error — search fails → UnableToLoad + Retry button (status 500)
// ---------------------------------------------------------------------------

export const Error: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: OpenSearchService,
          useValue: SEARCH_ERROR_SERVICE,
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
// PermissionError — status 403 → tnt/UnsuccessfulAuth illustrated message
// ---------------------------------------------------------------------------

export const PermissionError: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: OpenSearchService,
          useValue: SEARCH_PERMISSION_ERROR_SERVICE,
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
// Paginated — 30 results, totalCount=30; default paginationLimit=20 yields
// pages 1/2. makePagedOpenSearchServiceStub reads request.page + request.limit
// and returns the correct slice so onPageChange → list() shows new items.
//
// NOTE: paginationLimit defaults to 20 (limitFromUrl()) and cannot be seeded
// lower from a story (no input, and the Storybook URL doesn't carry ?limit=5).
// To see 5-item pages, change to 5 via the rows-per-page selector in the UI.
// ---------------------------------------------------------------------------

export const Paginated: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: OpenSearchService,
          useValue: makePagedOpenSearchServiceStub(
            CANNED_OPEN_SEARCH_RESULTS_PAGINATED,
          ),
        },
        {
          provide: ResourceService,
          useValue: makeDefaultResourceServiceStub(),
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
// RichColumns — 10 results with all displayAs types visible:
//   tag, boolIcon, link, img, secret, alert, button
// Uses CLUSTERS_RICH_CONTEXT whose definition maps each spec field.
// 10 items is enough to show every column type without an overwhelming table.
// ---------------------------------------------------------------------------

const SEARCH_RICH_SERVICE = {
  listResources: (_ctx: any, _req: any) => of(CANNED_OPEN_SEARCH_RESULTS_RICH),
};

export const RichColumns: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: OpenSearchService,
          useValue: SEARCH_RICH_SERVICE,
        },
        {
          provide: ResourceService,
          useValue: makeDefaultResourceServiceStub(),
        },
      ],
    }),
  ],
  args: {
    LuigiClient: LUIGI_CLIENT,
    context: CLUSTERS_RICH_CONTEXT,
  },
};
