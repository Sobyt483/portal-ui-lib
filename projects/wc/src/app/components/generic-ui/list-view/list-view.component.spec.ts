import { ListView } from './list-view.component';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LuigiCoreService } from '@openmfp/portal-ui-lib';
import { ErrorHandlerService } from '@platform-mesh/portal-ui-lib/services';
import { MockedObject } from 'vitest';
import { mock } from 'vitest-mock-extended';

describe('ListViewComponent', () => {
  let component: ListView;
  let fixture: ComponentFixture<ListView>;
  let mockErrorHandlerService: MockedObject<ErrorHandlerService>;
  let mockLuigiCoreService: any;

  beforeEach(() => {
    mockLuigiCoreService = mock();
    mockErrorHandlerService = mock();

    TestBed.configureTestingModule({
      providers: [
        { provide: LuigiCoreService, useValue: mockLuigiCoreService },
        { provide: ErrorHandlerService, useValue: mockErrorHandlerService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).overrideComponent(ListView, {
      set: {
        template: '',
        imports: [],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      },
    });

    fixture = TestBed.createComponent(ListView);
    component = fixture.componentInstance;

    component.context = (() => ({
      resourceDefinition: {
        entityCollection: 'clusters',
        entity: 'Cluster',
        apiGroup: 'core_k8s_io',
        version: 'v1alpha1',
        ui: {
          listView: { fields: [] },
          detailView: { fields: [] },
        },
      },
    })) as any;

    component.LuigiClient = (() => ({
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
        withParams: vi.fn().mockReturnThis(),
      }),
      uxManager: () => ({ showAlert: vi.fn() }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
    })) as any;

    fixture.detectChanges();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  describe('resourceTitleDefinition', () => {
    it('should use resourceTitle.label when defined', () => {
      const newFixture = TestBed.createComponent(ListView);
      const newComponent = newFixture.componentInstance;
      newComponent.context = (() => ({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          ui: {
            listView: { resourceTitle: { label: 'My Clusters' }, fields: [] },
          },
        },
      })) as any;
      newComponent.LuigiClient = component.LuigiClient;
      newFixture.detectChanges();
      expect(newComponent.resourceTitleDefinition()).toBe('My Clusters');
    });

    it('should fall back to entityCollection when resourceTitle is not defined', () => {
      expect(component.resourceTitleDefinition()).toBe('clusters');
    });

    it('should return empty string when neither resourceTitle nor entityCollection is defined', () => {
      const newFixture = TestBed.createComponent(ListView);
      const newComponent = newFixture.componentInstance;
      newComponent.context = (() => ({
        resourceDefinition: {
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          ui: { listView: { fields: [] } },
        },
      })) as any;
      newComponent.LuigiClient = component.LuigiClient;
      newFixture.detectChanges();
      expect(newComponent.resourceTitleDefinition()).toBe('');
    });
  });

  describe('resourceDescriptionDefinition', () => {
    it('should use resourceDescription.label when defined', () => {
      const newFixture = TestBed.createComponent(ListView);
      const newComponent = newFixture.componentInstance;
      newComponent.context = (() => ({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          ui: {
            listView: {
              resourceDescription: { label: 'All your clusters' },
              fields: [],
            },
          },
        },
      })) as any;
      newComponent.LuigiClient = component.LuigiClient;
      newFixture.detectChanges();
      expect(newComponent.resourceDescriptionDefinition()).toBe(
        'All your clusters',
      );
    });

    it('should use default description when resourceDescription is not defined', () => {
      expect(component.resourceDescriptionDefinition()).toBe(
        'This page displays the created clusters in your environment',
      );
    });
  });

  describe('dashboardConfig', () => {
    it('should use backgroundImageUrl from definition when provided', () => {
      const newFixture = TestBed.createComponent(ListView);
      const newComponent = newFixture.componentInstance;
      newComponent.context = (() => ({
        resourceDefinition: {
          entityCollection: 'clusters',
          entity: 'Cluster',
          apiGroup: 'core_k8s_io',
          ui: {
            listView: { backgroundImageUrl: '/assets/custom.png', fields: [] },
          },
        },
      })) as any;
      newComponent.LuigiClient = component.LuigiClient;
      newFixture.detectChanges();
      expect(newComponent.dashboardConfig().backgroundImageUrl).toBe(
        '/assets/custom.png',
      );
    });

    it('should have no custom actions', () => {
      expect(component.customActions.length).toBe(0);
    });
  });

  describe('cards', () => {
    it('should return a single resource-table-card config', () => {
      const cards = component.cards();
      expect(cards.length).toBe(1);
      expect(cards[0].id).toBe('pm-resource-table-card');
      expect(cards[0].component).toBe('pm-resource-table-card');
      expect(cards[0].w).toBe(12);
      expect(cards[0].h).toBe(50);
    });

    it('should pass LuigiClient and context as componentInputs', () => {
      const cards = component.cards();
      expect(cards[0].componentInputs?.['LuigiClient']).toBeDefined();
      expect(cards[0].componentInputs?.['context']).toBeDefined();
    });

    it('should pass a callback for read failures as componentInput', () => {
      const failure = { code: 404, retry: vi.fn() };

      const readFailureChange = component.cards()[0].componentInputs?.[
        'readFailureChange'
      ] as (failure: object) => void;

      readFailureChange(failure);

      expect((component as any).readFailure()).toBe(failure);
    });
  });
});

describe('ListViewComponent template', () => {
  it('should render mfp-dashboard with data-testid="generic-list-view"', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: LuigiCoreService, useValue: mock() },
        { provide: ErrorHandlerService, useValue: mock() },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).overrideComponent(ListView, {
      set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });

    const fixture = TestBed.createComponent(ListView);
    const component = fixture.componentInstance;
    component.context = (() => ({
      resourceDefinition: {
        entityCollection: 'clusters',
        entity: 'Cluster',
        apiGroup: 'core_k8s_io',
        version: 'v1alpha1',
        ui: { listView: { fields: [] }, detailView: { fields: [] } },
      },
    })) as any;
    component.LuigiClient = (() => ({
      linkManager: () => ({
        fromContext: vi.fn().mockReturnThis(),
        navigate: vi.fn(),
        withParams: vi.fn().mockReturnThis(),
      }),
      uxManager: () => ({ showAlert: vi.fn() }),
      getNodeParams: vi.fn(),
      getActiveFeatureToggles: () => [],
    })) as any;
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector(
      '[data-testid="generic-list-view"]',
    );
    expect(el).not.toBeNull();
  });
});

describe('ListViewComponent read failure', () => {
  let fixture: ComponentFixture<ListView>;
  let component: ListView;

  const find = (selector: string) =>
    fixture.nativeElement.querySelector(selector);
  const reportReadFailure = (failure: object | null) => {
    const readFailureChange = component.cards()[0].componentInputs?.[
      'readFailureChange'
    ] as (failure: object | null) => void;
    readFailureChange(failure);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: LuigiCoreService, useValue: mock() },
        { provide: ErrorHandlerService, useValue: mock() },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).overrideComponent(ListView, {
      set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });

    fixture = TestBed.createComponent(ListView);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('context', {
      resourceDefinition: {
        entityCollection: 'clusters',
        entity: 'Cluster',
        apiGroup: 'core_k8s_io',
        version: 'v1alpha1',
        ui: { listView: { fields: [] } },
      },
    });
    fixture.componentRef.setInput('LuigiClient', {
      getActiveFeatureToggles: () => [],
    });
    fixture.detectChanges();
  });

  it('shows the dashboard without an error state while there is no failure', () => {
    expect(find('[data-testid="generic-list-view-error-state"]')).toBeNull();
    expect(find('mfp-dashboard').style.display).toBe('');
  });

  it('shows only the error state with the code of the failure', () => {
    reportReadFailure({ code: 403, retry: vi.fn() });

    expect(find('[data-testid="generic-list-view-error-state"]').code).toBe(403);
    expect(find('mfp-dashboard').style.display).toBe('none');
  });

  it('retries through the failure of the card', () => {
    const retry = vi.fn();
    reportReadFailure({ code: 500, retry });

    find('[data-testid="generic-list-view-error-state"]').dispatchEvent(
      new CustomEvent('retry'),
    );

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows the dashboard again when the failure is gone', () => {
    reportReadFailure({ code: 500, retry: vi.fn() });

    reportReadFailure(null);

    expect(find('[data-testid="generic-list-view-error-state"]')).toBeNull();
    expect(find('mfp-dashboard').style.display).toBe('');
  });
});
