import {
  executeButtonAction,
  resolveAllPlaceholders,
  withRouteNamespace,
} from '../../../../utils';
import {
  DependentFieldUpdate,
  DynamicValuesResult,
  FormDependencyController,
  FormValidationController,
  buildInitialValues,
  buildResourceFormFields,
  expandCollectionEntries,
  omitEmptyWriteOnlyFields,
  resolveFieldDynamicValuesResult,
  validateFormField,
} from '../../../../utils/forms';
import { ResourceFieldNames } from '../../create-resource-modal/create-resource-modal.consts';
import { InstancePermissionsStore } from '../../store/instance-permissions-store.service';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LuigiClient } from '@luigi-project/client/luigi-element';
import {
  DeclarativeTableCard,
  DeleteResourceConfirmationConfig,
  FormFieldChangeEvent,
  FormFieldDefinition,
  ResourceFieldButtonClickEvent,
  TableCardConfig,
  TableCardFormState,
  TableErrorConfig,
} from '@openmfp/ngx';
import {
  PlatformMeshFieldDefinition,
  Resource,
  ResourceListResult,
  ResourceSubscriptionResult,
} from '@platform-mesh/portal-ui-lib/models';
import {
  ErrorHandlerService,
  ResourceNodeContext,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import {
  buildResourcePath,
  generateGraphQLFields,
  isNamespacedResource,
  mergeListWithSubscriptionResult,
  permissionKey,
  resourceActionAllowed,
} from '@platform-mesh/portal-ui-lib/utils';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'pm-resource-table-card',
  standalone: true,
  providers: [InstancePermissionsStore],
  imports: [DeclarativeTableCard],
  templateUrl: './resource-table-card.component.html',
  styles: `
    mfp-declarative-table-card {
      opacity: 80%;
      padding-bottom: 5rem;
    }
  `,
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceTableCard {
  private resourceService = inject(ResourceService);
  private errorHandlerService = inject(ErrorHandlerService);
  protected instancePermissionsStore = inject(InstancePermissionsStore);
  private destroyRef = inject(DestroyRef);

  LuigiClient = input.required<LuigiClient>();
  context = input.required<ResourceNodeContext>();

  tableCard =
    viewChild.required<DeclarativeTableCard<Resource>>(DeclarativeTableCard);

  resources = signal<Resource[]>([]);
  tableResources = computed(() =>
    this.resources().map((r) => ({ ...r, id: this.generateResourceId(r) })),
  );
  resourceDefinition = computed(() => this.context().resourceDefinition);
  hasUiCreateViewFields = computed(
    () => !!this.resourceDefinition()?.ui?.createView?.fields?.length,
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
        },
        ...columns,
      ];
    }

    return columns;
  });
  totalItemsCount = computed(
    () => this.resources().length + this.remainingItemCount(),
  );
  paginationLimit = signal<number>(5);
  remainingItemCount = signal<number>(0);
  hasMore = signal<boolean>(false);
  resourceVersion = signal<string | undefined>(undefined);
  loading = signal<boolean>(false);
  protected listError = signal<TableErrorConfig | null>(null);
  protected watchError = signal<TableErrorConfig | null>(null);

  private readonly createValidation = this.createValidationController(false);
  private createFieldErrors = this.createValidation.errors;
  private createPending = signal(false);
  createFormState = computed<TableCardFormState>(() => ({
    fieldErrors: this.createFieldErrors(),
    pending: this.createPending() || this.createValidation.hasDeferredErrors(),
  }));

  private readonly editValidation = this.createValidationController(true);
  private editFieldErrors = this.editValidation.errors;
  private editPending = signal(false);
  editFormState = computed<TableCardFormState>(() => ({
    fieldErrors: this.editFieldErrors(),
    pending: this.editPending() || this.editValidation.hasDeferredErrors(),
  }));
  private readonly createDependencies = new FormDependencyController(
    (field, values) => this.resolveDynamicValuesResult(field, values),
    (update) => this.applyDependentUpdate(update, false),
  );
  private readonly editDependencies = new FormDependencyController(
    (field, values) => this.resolveDynamicValuesResult(field, values),
    (update) => this.applyDependentUpdate(update, true),
  );

  createFormFields = computed(() => {
    let fields = this.resourceDefinition()?.ui?.createView?.fields || [];
    if (
      this.hasUiCreateViewFields() &&
      this.isNamespaced() &&
      !this.resourceService.getNamespace(this.createContext()) &&
      !fields.some(
        (field) => field.property === ResourceFieldNames.MetadataNamespace,
      )
    ) {
      fields = [
        {
          property: ResourceFieldNames.MetadataNamespace,
          required: true,
          label: 'Namespace',
          values: this.context().namespaces,
        },
        ...fields,
      ];
    }

    return fields;
  });

  config = computed<TableCardConfig<Resource>>(() => {
    return {
      header: this.resourceDefinition()?.entityCollection,
      tableConfig: {
        fields: this.columns(),
        totalItemsCount: this.totalItemsCount(),
        paginationLimit: this.paginationLimit(),
        hasMore: this.hasMore(),
      },
      ...(this.hasUiCreateViewFields() &&
        this.canDo('create') && {
          createResourceFormConfig: {
            fields: () => this.buildFormFields(false),
          },
        }),
      ...(this.hasUiCreateViewFields() &&
        this.canDo('update') && {
          editResourceFormConfig: (resource: Resource) => ({
            fields: () => this.buildFormFields(true, resource),
          }),
        }),
      deleteResourceConfirmationConfig: (r) => this.getDeleteConfig(r),
    };
  });

  private isNamespaced = computed(() => isNamespacedResource(this.context()));
  // The list follows the namespace selection, so '-all-' lists every
  // namespace. Create needs one namespace: on a namespace route with '-all-'
  // selected it uses the route's namespace instead of none.
  private createContext = computed(() => {
    const context = this.context();
    return withRouteNamespace(
      context,
      this.resourceService.getNamespace(context),
      this.LuigiClient().getPathParams?.(),
    );
  });
  private currentContinueToken: string | undefined = undefined;
  private listSubscription?: Subscription;
  private lastListWasInitialLoad = true;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.createDependencies.end();
      this.editDependencies.end();
    });
    effect((onCleanup) => {
      this.currentContinueToken = undefined;
      this.resources.set([]);
      this.resourceVersion.set(undefined);
      this.remainingItemCount.set(0);
      this.hasMore.set(false);
      this.listError.set(null);
      this.watchError.set(null);
      this.list(true);
      onCleanup(() => this.listSubscription?.unsubscribe());
    });

    effect((onCleanup) => {
      const version = this.resourceVersion();
      if (!version) return;
      if (untracked(this.watchError)) return;
      if (!this.canDo('watch')) return;
      const sub = this.subscribeToResourceChange(version);
      onCleanup(() => sub.unsubscribe());
    });

    effect(() => {
      const rows = this.resources();
      const rd = this.resourceDefinition();

      if (!rd?.permissionsDefinition?.entityActions.length || !rows.length) {
        return;
      }

      const namespaced = this.isNamespaced();
      const instances = rows.map((r) => ({
        name: r.metadata.name,
        namespace: namespaced ? r.metadata.namespace : undefined,
      }));
      this.instancePermissionsStore.sync(
        this.context(),
        rd.permissionsDefinition!,
        instances,
      );
    });
  }

  private createValidationController(
    editMode: boolean,
  ): FormValidationController {
    return new FormValidationController((name, value) =>
      validateFormField({
        name,
        value,
        fields: this.createFormFields(),
        editMode,
      }),
    );
  }

  private async buildFormFields(
    editMode: boolean,
    resource?: Resource,
  ): Promise<FormFieldDefinition[]> {
    this.resetFormState(editMode);
    const dependencies = editMode
      ? this.editDependencies
      : this.createDependencies;
    const fields = this.createFormFields();
    const values = buildInitialValues(fields, resource);
    let generation: number | undefined;
    try {
      generation = dependencies.begin(fields, values);
      const formFields = await buildResourceFormFields(fields, values, {
        editMode,
        resolveResult: (field, formValues) =>
          this.resolveDynamicValuesResult(field, formValues),
      });
      return dependencies.isCurrent(generation) ? formFields : [];
    } catch (error) {
      if (generation !== undefined && !dependencies.isCurrent(generation))
        return [];
      this.resetFormState(editMode);
      if (editMode) this.tableCard().closeEditDialog();
      else this.tableCard().closeCreateDialog();
      this.errorHandlerService.handleError(error);
      return [];
    }
  }

  private resolveDynamicValuesResult(
    field: PlatformMeshFieldDefinition,
    values: Record<string, unknown>,
  ): Promise<DynamicValuesResult> {
    return resolveFieldDynamicValuesResult(
      field,
      this.createContext(),
      this.isNamespaced(),
      values,
      {
        list: (operation, gqlQuery, currentContext, options) =>
          this.resourceService.list(
            operation,
            gqlQuery,
            currentContext,
            options,
          ),
        getNamespace: (currentContext) =>
          this.resourceService.getNamespace(currentContext),
        handleError: (error) => this.errorHandlerService.handleError(error),
      },
    );
  }

  private applyDependentUpdate(
    update: DependentFieldUpdate,
    editMode: boolean,
  ): void {
    const validation = editMode ? this.editValidation : this.createValidation;
    const pending = editMode ? this.editPending : this.createPending;
    const patch = {
      ...(update.clear && { values: { [update.name]: '' } }),
      fieldUpdates: {
        [update.name]: { values: update.values },
      },
    };
    if (editMode) this.tableCard().applyEditFormPatch(patch);
    else this.tableCard().applyCreateFormPatch(patch);
    if (update.clear) {
      validation.resetField(update.name, '');
    }
    pending.set(update.pending);
  }

  onCreateDialogClosed(): void {
    this.resetFormState(false);
  }

  onEditDialogClosed(): void {
    this.resetFormState(true);
  }

  private resetFormState(editMode: boolean): void {
    const dependencies = editMode
      ? this.editDependencies
      : this.createDependencies;
    const validation = editMode ? this.editValidation : this.createValidation;
    const pending = editMode ? this.editPending : this.createPending;
    dependencies.end();
    validation.reset();
    pending.set(false);
  }

  onEditFieldChange({
    formChangeEvent,
  }: {
    resource: Resource;
    formChangeEvent: FormFieldChangeEvent;
  }): void {
    this.editValidation.handleChange(formChangeEvent);
    this.editDependencies.handleChange(formChangeEvent);
  }

  onEditSubmit({
    value,
  }: {
    resource: Resource;
    value: Record<string, unknown>;
  }): void {
    const resourceDefinition = this.getResourceDefinition();
    const expanded = expandCollectionEntries(
      omitEmptyWriteOnlyFields(value, this.createFormFields()),
      this.createFormFields(),
    ) as Resource;
    this.resourceService
      .update(expanded, resourceDefinition, this.context())
      .subscribe({
        next: (result) => {
          this.editValidation.reset();
          this.tableCard().closeEditDialog();
          console.debug('Resource updated', result);
        },
        error: (error) => this.errorHandlerService.handleError(error),
      });
  }

  private subscribeToResourceChange(version: string) {
    const fields = this.getListQueryFields();
    const context = this.context();
    const resourceDefinition = context.resourceDefinition!;
    const queryOperation = buildResourcePath({
      apiGroup: resourceDefinition.apiGroup,
      version: resourceDefinition.version,
      entity: resourceDefinition.entityCollection,
    }) as string;

    return this.resourceService
      .resourceChangeSubscription(
        queryOperation,
        fields,
        context,
        version,
        false,
      )
      .subscribe({
        next: (value) => {
          if (!value || context !== this.context()) return;
          this.mergeResourcesWithSubscriptionResult(value);
        },
        error: (error) => {
          if (context !== this.context()) return;
          if (!this.errorHandlerService.redirectToErrorPage(error)) {
            this.watchError.set(this.mapError(error));
          }
        },
      });
  }

  private resetPagination() {
    this.currentContinueToken = undefined;
    this.resources.update((v) => v.slice(0, this.paginationLimit()));
    this.hasMore.set(this.resources().length < this.totalItemsCount());
  }

  onLimitChange(limit: number) {
    this.paginationLimit.set(limit);
    this.resetPagination();
  }

  loadMore() {
    if (!this.hasMore()) return;
    this.list();
  }

  list(isInitialLoad: boolean = false) {
    if (!this.canDo('list')) return;
    if (untracked(this.loading)) return;
    this.lastListWasInitialLoad = isInitialLoad;
    this.listError.set(null);
    this.loading.set(true);

    const fields = this.getListQueryFields();
    const resourceDefinition = this.getResourceDefinition();
    const context = this.context();
    const queryOperation = buildResourcePath({
      apiGroup: resourceDefinition.apiGroup,
      version: resourceDefinition.version,
      entity: resourceDefinition.entityCollection,
    }) as string;

    this.listSubscription = this.resourceService
      .list(queryOperation, fields, context, {
        pagination: {
          limit: this.paginationLimit(),
          continue: this.currentContinueToken,
        },
      })
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result: ResourceListResult) => {
          if (context !== this.context()) return;
          if (isInitialLoad) {
            this.resources.set(result.items ?? []);
          } else {
            this.resources.update((values) => {
              const map = new Map(values.map((i) => [i.id, i]));
              (result.items ?? []).forEach((i) => map.set(i.id, i));
              return [...map.values()];
            });
          }
          this.resourceVersion.set(result.resourceVersion);
          this.hasMore.set(!!result.continue);
          this.currentContinueToken = result.continue;
          this.remainingItemCount.set(result.remainingItemCount || 0);
        },
        error: (error) => {
          if (context !== this.context()) return;
          if (!this.errorHandlerService.redirectToErrorPage(error)) {
            this.listError.set(this.mapError(error));
          }
        },
      });
  }

  retryList() {
    if (untracked(this.loading)) return;
    if (untracked(this.watchError)) {
      this.currentContinueToken = undefined;
      this.resourceVersion.set(undefined);
      this.hasMore.set(false);
      this.remainingItemCount.set(0);
      this.watchError.set(null);
      this.list(true);
      return;
    }
    if (untracked(this.listError)) {
      this.list(this.lastListWasInitialLoad);
    }
  }

  private mergeResourcesWithSubscriptionResult(
    subscriptionResult: ResourceSubscriptionResult,
  ) {
    this.resources.set(
      mergeListWithSubscriptionResult(this.resources(), subscriptionResult, {
        getItemKey: (item) => item.id,
        mapSubscriptionObjectToItem: (object) => object,
      }),
    );
  }

  private mapError(error: any): TableErrorConfig {
    return {
      message: error.message,
      withRetryButton: true,
    };
  }

  navigateToResource(resource: Resource) {
    const resourceDefinition = this.context().resourceDefinition;
    const resourceURL = resourceDefinition?.ui?.listView?.resourceURL;
    if (!resourceURL && !resourceDefinition?.ui?.detailView) return;

    if (!resource.metadata.name) {
      this.LuigiClient().uxManager().showAlert({
        text: 'Resource name is not defined',
        type: 'error',
      });
      throw new Error('Resource name is not defined');
    }

    if (this.isNamespaced() && !resource.metadata.namespace) {
      this.LuigiClient().uxManager().showAlert({
        text: 'Resource namespace is not known',
        type: 'error',
      });
      throw new Error('Resource namespace is not defined');
    }

    this.LuigiClient().addCoreSearchParams(
      {
        namespace: this.isNamespaced()
          ? resource.metadata.namespace
          : undefined,
      },
      false,
      true,
    );

    this.LuigiClient()
      .linkManager()
      .navigate(
        resourceURL
          ? resolveAllPlaceholders(resourceURL, resource, this.context())
          : resource.metadata.name,
      );
  }

  executeAction(event: ResourceFieldButtonClickEvent<Resource>) {
    executeButtonAction(
      this.LuigiClient(),
      event.field,
      event.resource,
      this.context(),
    );
  }

  onCreateFieldChange(event: FormFieldChangeEvent): void {
    this.createValidation.handleChange(event);
    this.createDependencies.handleChange(event);
  }

  onCreateSubmit(value: Resource): void {
    const resourceDefinition = this.getResourceDefinition();
    const expanded = expandCollectionEntries(
      value as Record<string, unknown>,
      this.createFormFields(),
    ) as Resource;
    this.resourceService
      .create(expanded, resourceDefinition, this.createContext())
      .subscribe({
        next: (result) => {
          this.createValidation.reset();
          this.tableCard().closeCreateDialog();
          console.debug('Resource created', result);
        },
        error: (error) => this.errorHandlerService.handleError(error),
      });
  }

  delete(resource: Resource): void {
    this.resourceService
      .delete(resource, this.getResourceDefinition(), this.context())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.tableCard().closeDeleteDialog();
        },
        error: (error) => this.errorHandlerService.handleError(error),
      });
  }

  private getListQueryFields() {
    const additionalFields = [{ property: 'metadata.deletionTimestamp' }];
    if (this.isNamespaced()) {
      additionalFields.push({ property: 'metadata.namespace' });
    }
    return generateGraphQLFields(this.columns().concat(additionalFields));
  }

  private getResourceDefinition() {
    const resourceDefinition = this.resourceDefinition();
    if (!resourceDefinition) {
      this.LuigiClient().uxManager().showAlert({
        text: 'Resource definition is not defined',
        type: 'error',
      });
      throw new Error('Resource definition is not defined');
    }
    return resourceDefinition;
  }

  private generateResourceId(resource: Resource): string {
    const resourceDefinition = this.getResourceDefinition();

    return permissionKey({
      resource: resourceDefinition.permissionsDefinition?.resource,
      name: resource.metadata.name,
      namespace: resource.metadata.namespace,
    });
  }

  private canDo(verb: string): boolean {
    return resourceActionAllowed(
      this.context().portalPermissions,
      this.resourceDefinition()?.permissionsDefinition?.resource,
      verb,
    );
  }

  private getDeleteConfig(
    resource: Resource,
  ): DeleteResourceConfirmationConfig {
    const resourceDefinition = this.getResourceDefinition();
    const name = resource.metadata?.name?.toLowerCase() ?? '';
    return {
      title: `Delete ${name}`,
      message: `<p>Are you sure you want to delete ${resourceDefinition?.entity} <b>${name}</b>?</p>
        <p class="dialog__message--critical">This action <b>cannot</b> be undone.</p>
        <p>Please type <b>${name}</b> to confirm:</p>`,
      confirmationText: name,
      confirmationPlaceholder: 'Type name',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    };
  }
}
