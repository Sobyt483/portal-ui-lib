import {
  executeButtonAction,
  resolveAllPlaceholders,
  resolveContextPlaceholders,
} from '../../../utils';
import { ResourceFormModal } from '../resource-form-modal/resource-form-modal.component';
import { ResourceLogo } from '../resource-logo/resource-logo.component';
import { InstancePermissionsStore } from '../store/instance-permissions-store.service';
import { OpenSearchService } from './services/open-search.service';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import {
  DynamicPage,
  DynamicPageHeader,
  DynamicPageTitle,
} from '@fundamental-ngx/ui5-webcomponents-fiori';
import { Icon } from '@fundamental-ngx/ui5-webcomponents/icon';
import { Input } from '@fundamental-ngx/ui5-webcomponents/input';
import { Tab } from '@fundamental-ngx/ui5-webcomponents/tab';
import { TabContainer } from '@fundamental-ngx/ui5-webcomponents/tab-container';
import { Title } from '@fundamental-ngx/ui5-webcomponents/title';
import { Toolbar } from '@fundamental-ngx/ui5-webcomponents/toolbar';
import { ToolbarButton } from '@fundamental-ngx/ui5-webcomponents/toolbar-button';
import { LuigiClient } from '@luigi-project/client/luigi-element';
import {
  DeclarativeTable,
  FieldFilterDefinition,
  GenericResource,
  ResourceField,
  ResourceFieldButtonClickEvent,
  TableErrorConfig,
} from '@openmfp/ngx';
import {
  ModalResult,
  PlatformMeshFieldDefinition,
  Resource,
} from '@platform-mesh/portal-ui-lib/models';
import {
  ErrorHandlerService,
  ResourceNodeContext,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import {
  isNamespacedResource,
  permissionKey,
  resourceActionAllowed,
} from '@platform-mesh/portal-ui-lib/utils';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

@Component({
  selector: 'pm-search-list-dynamic-page',
  standalone: true,
  templateUrl: './search-list-dynamic-page.component.html',
  styleUrl: './search-list-dynamic-page.component.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [InstancePermissionsStore],
  imports: [
    DynamicPage,
    DynamicPageTitle,
    DynamicPageHeader,
    Title,
    Toolbar,
    ToolbarButton,
    ResourceLogo,
    ResourceField,
    ResourceFormModal,
    DeclarativeTable,
    TabContainer,
    Tab,
    Input,
    Icon,
    FormField,
  ],
})
export class SearchListDynamicPage implements OnInit {
  LuigiClient = input.required<LuigiClient>();
  context = input.required<ResourceNodeContext>();

  resourceDefinition = computed(() => this.context().resourceDefinition);

  resourceTitleDefinition = computed(
    () =>
      this.resourceDefinition()?.ui?.listView?.resourceTitle?.label ??
      this.resourceDefinition()?.entityCollection ??
      '',
  );

  resourceDescriptionDefinition = computed(
    () =>
      this.resourceDefinition()?.ui?.listView?.resourceDescription?.label ??
      `This page displays the created ${this.resourceDefinition()?.entityCollection} in your environment`,
  );

  actions = computed<PlatformMeshFieldDefinition[]>(
    () => this.resourceDefinition()?.ui?.listView?.actions ?? [],
  );

  hasUiCreateViewFields = computed(
    () => !!this.resourceDefinition()?.ui?.createView?.fields?.length,
  );

  createFields = computed<PlatformMeshFieldDefinition[]>(
    () => this.resourceDefinition()?.ui?.createView?.fields ?? [],
  );

  canCreate = computed(() => this.canDo('create'));

  error = signal<TableErrorConfig | null>(null);

  searchFilters = computed<FieldFilterDefinition[] | undefined>(() => {
    const ctx = this.context();
    return ctx.resourceDefinition?.ui?.listView?.filters?.map((f) => ({
      ...f,
      value: resolveContextPlaceholders(f.value, ctx),
    }));
  });

  private baselineFilters = computed<Record<string, string>>(() => {
    const ctx = this.context();
    const defs = ctx.resourceDefinition?.ui?.listView?.baselineFilters ?? [];
    const record: Record<string, string> = {};
    for (const f of defs) {
      if (!f.property) continue;
      const value = resolveContextPlaceholders(f.value, ctx);
      if (!value || (value === f.value && /\{context\./.test(f.value ?? ''))) {
        console.debug(
          'baselineFilter skipped (unresolved value)',
          f.property,
          f.value,
        );
        continue;
      }
      record[f.property] = value;
    }

    return record;
  });

  hasFilters = computed(() => (this.searchFilters()?.length ?? 0) > 0);

  filterTabs = computed(() => {
    const selected = this.selectedSearchFilter();
    const counts = this.filterCounts();
    return (this.searchFilters() ?? []).map((f) => {
      const key = this.filterKey(f);
      const count = counts[key];
      return {
        text: count !== undefined ? `${f.label} (${count})` : f.label,
        selected: this.isSameFilter(selected, f),
      };
    });
  });

  selectedSearchFilter = linkedSignal<
    FieldFilterDefinition[] | undefined,
    FieldFilterDefinition | undefined
  >({
    source: () => this.searchFilters(),
    computation: (filters, prev) => {
      const previous = prev?.value;
      if (previous && filters?.some((f) => this.isSameFilter(f, previous))) {
        return previous;
      }

      const def = filters?.find((f) => f.default);
      if (def?.property && def?.value !== undefined) return def;
      return filters?.[0];
    },
  });

  resources = signal<GenericResource[]>([]);
  tableResources = computed(() =>
    this.resources().map((r) => ({ ...r, id: this.generateResourceId(r) })),
  );
  columns = computed(() => {
    let columns = this.resourceDefinition()?.ui?.listView?.fields ?? [];

    const readyCondition = this.resourceDefinition()?.readyCondition;
    if (readyCondition) {
      columns = [
        {
          ...readyCondition,
          uiSettings: {
            ...readyCondition.uiSettings,
            displayAs: 'alert',
            columnWidth: '30px',
          },
        } as any,
        ...columns,
      ];
    }

    return columns;
  });

  paginationLimit = signal<number>(20);
  currentPage = signal<number>(1);
  totalItemsCount = signal<number | undefined>(undefined);
  hasMore = signal<boolean>(false);
  loading = signal<boolean>(false);

  private readonly searchModel = signal('');
  readonly searchControl = form(this.searchModel);
  searchKey = signal<string>('');

  private filterCounts = signal<Record<string, number | undefined>>({});

  private resourceService = inject(ResourceService);
  private openSearchService = inject(OpenSearchService);
  private errorHandlerService = inject(ErrorHandlerService);
  protected instancePermissionsStore = inject(InstancePermissionsStore);
  private destroyRef = inject(DestroyRef);
  private createModal = viewChild<ResourceFormModal>('createModal');

  private listSubscription?: Subscription;
  private countsSubscription?: Subscription;
  private isNamespaced = computed(() => isNamespacedResource(this.context()));

  constructor() {
    effect(() => {
      const rows = this.resources();
      const rd = this.resourceDefinition();

      if (!rd?.permissionsDefinition?.entityActions?.length || !rows.length) {
        return;
      }

      const namespaced = this.isNamespaced();
      const instances = rows.map((r) => ({
        name: (r as any).metadata?.name ?? r.id,
        namespace: namespaced ? (r as any).metadata?.namespace : undefined,
      }));
      this.instancePermissionsStore.sync(
        this.context(),
        rd.permissionsDefinition!,
        instances,
      );
    });
  }

  ngOnInit(): void {
    this.restoreStateFromNodeParams();
    this.list();
    this.loadFilterCounts();
  }

  submitSearch(): void {
    const q = this.searchControl().value();
    this.searchKey.set(q);
    this.currentPage.set(1);
    this.list();
  }

  clearSearch(): void {
    this.searchControl().value.set('');
    this.submitSearch();
  }

  openCreateModal(): void {
    void this.createModal()?.open();
  }

  onCreateSubmit(value: Resource): void {
    const resourceDefinition = this.resourceDefinition();
    if (!resourceDefinition) return;
    this.resourceService
      .create(value, resourceDefinition, this.context())
      .subscribe({
        next: (result) => {
          this.createModal()?.close();
          this.list();
          console.debug('Resource created', result);
        },
        error: (error) => this.errorHandlerService.handleError(error),
      });
  }

  genericActionHandler(
    event: ResourceFieldButtonClickEvent<GenericResource>,
  ): void {
    executeButtonAction(
      this.LuigiClient(),
      event.field,
      event.resource,
      this.context(),
      (result?: ModalResult) => this.handleModalResult(result),
    );
  }

  handleModalResult(result?: ModalResult): void {
    if (!result?.data) {
      return;
    }

    switch (result.data.action) {
      case 'navigate':
        this.navigateToResource(result.data.resource);
        break;
      case 'create':
        this.onCreateSubmit(result.data.resource as Resource);
        break;
      case 'loadTableData':
        this.list();
        break;
      default:
        console.debug(`Action ${result.data?.action} not supported`);
    }
  }

  list(): void {
    if (!this.canDo('list')) {
      this.error.set({
        status: 403,
        title: 'Permission denied',
      });

      return;
    }

    this.listSubscription?.unsubscribe();

    const page = this.currentPage();
    const limit = this.paginationLimit();
    const filter = this.selectedSearchFilter();
    const q = this.searchKey().trim();

    const nodeParams = {
      q: q || undefined,
      page: page > 1 ? String(page) : undefined,
      limit: limit !== 20 ? String(limit) : undefined,
      tab: filter ? this.tabSlug(filter) : undefined,
    };
    if (this.shouldUpdateNodeParams(nodeParams)) {
      this.LuigiClient().addNodeParams(nodeParams, false);
    }

    const context = this.context();
    const resource = this.resourceDefinition()?.entityCollection;

    this.loading.set(true);
    const selected = filter?.property
      ? { [filter.property]: filter.value }
      : {};
    const merged = { ...this.baselineFilters(), ...selected };
    this.listSubscription = this.openSearchService
      .listResources(context, {
        q: q || '*',
        resource,
        limit,
        page,
        filters: Object.keys(merged).length ? merged : undefined,
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          const total = result.totalCount;
          this.totalItemsCount.set(total);

          if (
            page > 1 &&
            total !== undefined &&
            (result.results ?? []).length === 0
          ) {
            const lastPage = Math.max(1, Math.ceil(total / limit));
            this.currentPage.set(lastPage);
            this.list();
            return;
          }

          this.resources.set(result.results ?? []);
          this.hasMore.set(!!result.nextCursor);
        },
        error: (error: any) => {
          this.error.set({
            status: error.status ?? 400,
            message: error?.detail ?? error?.message,
            title: error.title,
            withRetryButton: true,
          });
          this.errorHandlerService.handleError(error);
        },
      });
  }

  private loadFilterCounts(): void {
    if (!this.canDo('list')) return;

    const filters = this.searchFilters();
    if (!filters?.length) {
      this.filterCounts.set({});
      return;
    }

    this.countsSubscription?.unsubscribe();

    const context = this.context();
    const resource = this.resourceDefinition()?.entityCollection;

    const observables = filters.map((f) => {
      const key = this.filterKey(f);
      const tabFilter = f.property ? { [f.property]: f.value } : {};
      const merged = { ...this.baselineFilters(), ...tabFilter };
      return this.openSearchService
        .listResources(context, {
          q: '*',
          resource,
          limit: 1,
          page: 1,
          filters: Object.keys(merged).length ? merged : undefined,
        })
        .pipe(
          map((r) => ({ key, count: r.totalCount ?? 0 })),
          catchError(() => of({ key, count: undefined })),
        );
    });

    this.countsSubscription = forkJoin(observables)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results) => {
        const counts: Record<string, number | undefined> = {};
        for (const r of results) {
          if (r.count !== undefined) {
            counts[r.key] = r.count;
          }
        }
        this.filterCounts.set(counts);
      });
  }

  protected onFilterTabSelect(index: number): void {
    const filters = this.searchFilters();
    const next = filters?.[index];
    this.selectedSearchFilter.set(next);
    this.currentPage.set(1);
    this.list();
  }

  onLimitChange(limit: number): void {
    this.paginationLimit.set(limit);
    this.currentPage.set(1);
    this.list();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.list();
  }

  navigateToResource(resource: any): void {
    const resourceDefinition = this.resourceDefinition();
    if (!resourceDefinition) {
      this.LuigiClient().uxManager().showAlert({
        text: 'Resource definition is not defined',
        type: 'error',
      });
      throw new Error('Resource definition is not defined');
    }

    const resourceURL = resourceDefinition.ui?.listView?.resourceURL;
    if (!resourceURL && !resourceDefinition.ui?.detailView) {
      return;
    }

    if (!resource.metadata?.name) {
      this.LuigiClient().uxManager().showAlert({
        text: 'Resource name is not defined',
        type: 'error',
      });
      throw new Error('Resource name is not defined');
    }

    this.LuigiClient()
      .linkManager()
      .navigate(
        resourceURL
          ? resolveAllPlaceholders(resourceURL, resource, this.context())
          : (resource as any).metadata.name,
      );
  }

  canDo(action: string | undefined): boolean {
    if (!action) {
      return true;
    }

    return resourceActionAllowed(
      this.context().portalPermissions,
      this.resourceDefinition()?.permissionsDefinition?.resource,
      action,
    );
  }

  private restoreStateFromNodeParams(): void {
    const params = this.getNodeParams();
    this.currentPage.set(this.pageFromNodeParams(params.page));
    this.paginationLimit.set(this.limitFromNodeParams(params.limit));
    this.searchModel.set(params.q ?? '');
    this.searchKey.set(params.q ?? '');

    const filter = this.searchFilters()?.find(
      (candidate) => this.tabSlug(candidate) === params.tab,
    );
    if (filter) this.selectedSearchFilter.set(filter);
  }

  private shouldUpdateNodeParams(
    nodeParams: Record<string, string | undefined>,
  ): boolean {
    const currentNodeParams = this.getNodeParams();
    return Object.entries(nodeParams).some(
      ([key, value]) => currentNodeParams[key] !== value,
    );
  }

  private getNodeParams(): Record<string, string | undefined> {
    return this.LuigiClient().getNodeParams(true) as Record<
      string,
      string | undefined
    >;
  }

  private pageFromNodeParams(page: string | undefined): number {
    const value = Number(page);
    return Number.isInteger(value) && value >= 1 ? value : 1;
  }

  private limitFromNodeParams(limit: string | undefined): number {
    const value = Number(limit);
    return [5, 10, 20, 50, 100].includes(value) ? value : 20;
  }

  private generateResourceId(resource: any): string {
    const resourceDefinition = this.resourceDefinition();
    if (!resourceDefinition) {
      return resource.metadata?.name ?? resource.id ?? '';
    }

    return permissionKey({
      resource: resourceDefinition.permissionsDefinition?.resource,
      name: resource.metadata.name,
      namespace: resource.metadata.namespace,
    });
  }

  private filterKey(f: FieldFilterDefinition): string {
    const parts = [f.label, f.property, f.value].filter(Boolean);
    return parts.join('=');
  }

  private tabSlug(f: FieldFilterDefinition): string {
    return f.label.toLowerCase().replace(/\s+/g, '-');
  }

  private isSameFilter(
    a: FieldFilterDefinition | undefined,
    b: FieldFilterDefinition | undefined,
  ): boolean {
    if (!a || !b) return false;
    return (
      a.property === b.property && a.value === b.value && a.label === b.label
    );
  }
}
