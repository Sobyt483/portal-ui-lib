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
} from '../../../utils/forms';
import { ResourceFieldNames } from '../create-resource-modal/create-resource-modal.consts';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormFieldChangeEvent,
  FormFieldDefinition,
  ResourceFormDialog,
} from '@openmfp/ngx';
import {
  PlatformMeshFieldDefinition,
  Resource,
} from '@platform-mesh/portal-ui-lib/models';
import {
  ErrorHandlerService,
  ResourceNodeContext,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import { isNamespacedResource } from '@platform-mesh/portal-ui-lib/utils';

@Component({
  selector: 'pm-resource-form-modal',
  standalone: true,
  imports: [ResourceFormDialog],
  templateUrl: './resource-form-modal.component.html',
  encapsulation: ViewEncapsulation.ShadowDom,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceFormModal {
  context = input.required<ResourceNodeContext>();
  fields = input<PlatformMeshFieldDefinition[]>([]);

  resource = output<Resource>();
  updateResource = output<Resource>();

  dialogOpen = signal<boolean>(false);
  isNamespacedResource = computed(() => isNamespacedResource(this.context()));

  private readonly resourceService = inject(ResourceService);
  private readonly errorHandlerService = inject(ErrorHandlerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild<ResourceFormDialog>('dialog');
  private originalResource = signal<Resource | null>(null);

  private readonly validation = new FormValidationController((name, value) =>
    validateFormField({
      name,
      value,
      fields: this.calculateFields(),
      editMode: this.isEditMode(),
    }),
  );
  fieldErrors = this.validation.errors;
  formFields = signal<FormFieldDefinition[]>([]);
  initialValues = signal<Record<string, unknown>>({});
  pending = signal(false);
  formPending = computed(
    () => this.pending() || this.validation.hasDeferredErrors(),
  );
  private readonly dependencies = new FormDependencyController(
    (field, values) => this.resolveDynamicValuesResult(field, values),
    (update) => this.applyDependentUpdate(update),
  );

  dialogTitle = computed(() => (this.isEditMode() ? 'Edit' : 'Create'));
  confirmLabel = computed(() => (this.isEditMode() ? 'Save' : 'Create'));
  dataTestidPrefix = computed(() =>
    this.isEditMode() ? 'edit-resource-dialog' : 'create-resource-dialog',
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.dependencies.end());
  }

  async open(resource?: Resource) {
    this.dependencies.end();
    this.dialogOpen.set(false);
    this.pending.set(false);
    this.validation.reset();
    const fields = this.calculateFields();
    this.originalResource.set(resource ?? null);
    const values = buildInitialValues(fields, resource);
    let generation: number | undefined;
    try {
      generation = this.dependencies.begin(fields, values);
      const formFields = await buildResourceFormFields(fields, values, {
        editMode: this.isEditMode(),
        resolveResult: (field, formValues) =>
          this.resolveDynamicValuesResult(field, formValues),
      });
      if (!this.dependencies.isCurrent(generation)) return;

      this.formFields.set(formFields);
      this.initialValues.set(values);
      this.dialogOpen.set(true);
    } catch (error) {
      if (generation !== undefined && !this.dependencies.isCurrent(generation))
        return;
      this.close();
      this.errorHandlerService.handleError(error);
    }
  }

  close() {
    this.dependencies.end();
    this.dialogOpen.set(false);
    this.pending.set(false);
    this.validation.reset();
    this.originalResource.set(null);
  }

  isEditMode() {
    return !!this.originalResource();
  }

  onFieldChange(event: FormFieldChangeEvent): void {
    this.validation.handleChange(event);
    this.dependencies.handleChange(event);
  }

  private applyDependentUpdate(update: DependentFieldUpdate): void {
    if (update.clear) {
      this.dialog()?.patchForm({ [update.name]: '' }, { emitEvent: false });
      this.validation.resetField(update.name, '');
    }
    this.formFields.update((fields) =>
      fields.map((field) =>
        field.name === update.name
          ? { ...field, values: update.values }
          : field,
      ),
    );
    this.pending.set(update.pending);
  }

  onFormSubmit(value: Record<string, unknown>): void {
    if (this.isEditMode()) {
      const fields = this.calculateFields();
      const expanded = expandCollectionEntries(
        omitEmptyWriteOnlyFields(value, fields),
        fields,
      ) as Resource;
      this.updateResource.emit(expanded);
      return;
    }

    this.resource.emit(value as Resource);
  }

  private resolveDynamicValuesResult(
    field: PlatformMeshFieldDefinition,
    values: Record<string, unknown>,
  ): Promise<DynamicValuesResult> {
    return resolveFieldDynamicValuesResult(
      field,
      this.context(),
      this.isNamespacedResource(),
      values,
      {
        list: (operation, gqlQuery, context, options) =>
          this.resourceService.list(operation, gqlQuery, context, options),
        getNamespace: (c) => this.resourceService.getNamespace(c),
        handleError: (error) => this.errorHandlerService.handleError(error),
      },
    );
  }

  private calculateFields(): PlatformMeshFieldDefinition[] {
    const fields = this.fields().slice();

    if (this.shouldAddNamespaceControl()) {
      // Namespace field is placed FIRST so it acts as the visible root of the
      // dependency chain (dependent fields resolve against its selected value).
      fields.unshift({
        property: ResourceFieldNames.MetadataNamespace,
        required: true,
        label: 'Namespace',
        dynamicValuesDefinition: {
          operation: 'v1.Namespaces.items',
          gqlQuery:
            'query { v1 { Namespaces { items { metadata { name } } } } }',
          value: 'metadata.name',
          key: 'metadata.name',
        },
      });
    }

    return fields;
  }

  private shouldAddNamespaceControl() {
    return (
      this.isNamespacedResource() &&
      !this.resourceService.getNamespace(this.context()) &&
      !this.fields().some(
        (field) => field.property === ResourceFieldNames.MetadataNamespace,
      )
    );
  }
}
