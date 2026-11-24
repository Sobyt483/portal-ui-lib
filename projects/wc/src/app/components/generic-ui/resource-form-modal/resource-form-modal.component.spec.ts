import { ResourceFormModal } from './resource-form-modal.component';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResourceFormDialog } from '@openmfp/ngx';
import { PlatformMeshFieldDefinition } from '@platform-mesh/portal-ui-lib/models';
import {
  ErrorHandlerService,
  ResourceService,
} from '@platform-mesh/portal-ui-lib/services';
import { of, throwError } from 'rxjs';
import { mock } from 'vitest-mock-extended';

describe('ResourceFormModal', () => {
  let component: ResourceFormModal;
  let fixture: ComponentFixture<ResourceFormModal>;
  let resourceService: ReturnType<typeof mock<ResourceService>>;
  let errorHandlerService: ReturnType<typeof mock<ErrorHandlerService>>;

  const testFields: PlatformMeshFieldDefinition[] = [
    { property: 'metadata.name', required: true, label: 'Name' },
    { property: 'spec.description', required: false, label: 'Description' },
  ];

  const clusterContext: any = {
    resourceDefinition: { scope: 'Cluster' },
    portalContext: { crdGatewayApiUrl: 'http://example.com' },
  };

  const namespacedContext: any = {
    resourceDefinition: { scope: 'Namespaced' },
    portalContext: { crdGatewayApiUrl: 'http://example.com' },
  };

  beforeEach(async () => {
    resourceService = mock<ResourceService>();
    errorHandlerService = mock<ErrorHandlerService>();

    await TestBed.configureTestingModule({
      imports: [ResourceFormModal],
      schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
      teardown: { destroyAfterEach: true },
      providers: [
        { provide: ResourceService, useValue: resourceService },
        { provide: ErrorHandlerService, useValue: errorHandlerService },
      ],
    })
      .overrideComponent(ResourceFormModal, {
        set: {
          template:
            '<mfp-resource-form-dialog #dialog [open]="dialogOpen()" [fields]="formFields()" [initialValues]="initialValues()" [fieldErrors]="fieldErrors()" [pending]="formPending()" (fieldChange)="onFieldChange($event)" (submitted)="onFormSubmit($event)" (cancelled)="close()" />',
          imports: [ResourceFormDialog],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
        },
      })
      .overrideComponent(ResourceFormDialog, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(ResourceFormModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('fields', testFields);
    fixture.componentRef.setInput('context', clusterContext);
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('open / close', () => {
    it('reports invalid dependency configuration and can open again after correction', async () => {
      fixture.componentRef.setInput('fields', [testFields[0], testFields[0]]);
      await expect(component.open()).resolves.toBeUndefined();
      expect(component.dialogOpen()).toBe(false);
      expect(errorHandlerService.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Duplicate form field: metadata.name',
        }),
      );
      fixture.componentRef.setInput('fields', testFields);
      await component.open();
      expect(component.dialogOpen()).toBe(true);
    });

    it('retains initial seed validation', () => {
      component.onFieldChange({
        fieldProperty: 'metadata.name',
        value: '',
        source: 'seed',
      });
      expect(component.fieldErrors()['metadata.name']).toBe(
        'This field is required',
      );
    });

    it('should set dialogOpen to true when open is called', async () => {
      await component.open();
      expect(component.dialogOpen()).toBe(true);
    });

    it('should set dialogOpen to false when close is called', async () => {
      await component.open();
      component.close();
      expect(component.dialogOpen()).toBe(false);
    });

    it('should clear fieldErrors when close is called', async () => {
      await component.open();
      component.onFieldChange({ fieldProperty: 'metadata.name', value: '' });
      component.close();
      expect(component.fieldErrors()).toEqual({});
    });

    it('should leave isEditMode false after close', async () => {
      await component.open({ metadata: { name: 'r1' } } as any);
      component.close();
      expect(component.isEditMode()).toBe(false);
    });

    it('should support re-opening after close', async () => {
      await component.open();
      component.close();
      await component.open();
      expect(component.dialogOpen()).toBe(true);
    });

    it('should reset originalResource to null when close is called', async () => {
      await component.open({ metadata: { name: 'r1' } } as any);
      component.close();
      expect(component.isEditMode()).toBe(false);
    });
  });

  describe('formFields building', () => {
    it('should be empty before open is called', () => {
      expect(component.formFields()).toHaveLength(0);
    });

    it('should build formFields from fields input after open', async () => {
      await component.open();
      expect(component.formFields()).toHaveLength(testFields.length);
    });

    it('should use dot-notation field names', async () => {
      await component.open();
      const names = component.formFields().map((f) => f.name);
      expect(names).toContain('metadata.name');
      expect(names).toContain('spec.description');
    });

    it('should disable metadata.name when opened in edit mode', async () => {
      await component.open({ metadata: { name: 'existing' } } as any);
      const nameField = component
        .formFields()
        .find((f) => f.name === 'metadata.name');
      expect(nameField?.disabled).toBe(true);
    });

    it('should not disable metadata.name when opened in create mode', async () => {
      await component.open();
      const nameField = component
        .formFields()
        .find((f) => f.name === 'metadata.name');
      expect(nameField?.disabled).toBe(false);
    });

    it('should disable immutable fields (spec.alias) when opened for edit', async () => {
      fixture.componentRef.setInput('fields', [
        { property: 'spec.alias', required: true, label: 'Alias' },
        { property: 'spec.displayName', label: 'Display name' },
      ]);
      await component.open({
        metadata: { name: 'test2' },
        spec: { alias: 'test2', displayName: 'test-display' },
      } as any);
      const aliasField = component
        .formFields()
        .find((f) => f.name === 'spec.alias');
      expect(aliasField?.disabled).toBe(true);
    });

    it('should not disable spec.description in edit mode', async () => {
      await component.open({ metadata: { name: 'existing' } } as any);
      const descField = component
        .formFields()
        .find((f) => f.name === 'spec.description');
      expect(descField?.disabled).toBe(false);
    });

    it('should append a metadata.namespace field for namespaced resources without a resolved namespace', async () => {
      resourceService.list.mockReturnValue(of([]));
      fixture.componentRef.setInput('context', namespacedContext);
      fixture.detectChanges();
      await component.open();
      const nsField = component
        .formFields()
        .find((f) => f.name === 'metadata.namespace');
      expect(nsField).toBeDefined();
    });

    it('should not append a metadata.namespace field for cluster-scoped resources', async () => {
      await component.open();
      const nsField = component
        .formFields()
        .find((f) => f.name === 'metadata.namespace');
      expect(nsField).toBeUndefined();
    });

    it('should not append a metadata.namespace field when a namespace is already resolved', async () => {
      resourceService.getNamespace.mockReturnValue('default');
      fixture.componentRef.setInput('context', namespacedContext);
      fixture.detectChanges();
      await component.open();
      const nsField = component
        .formFields()
        .find((f) => f.name === 'metadata.namespace');
      expect(nsField).toBeUndefined();
    });

    it('should prefetch dynamic values and store them in formField.values', async () => {
      resourceService.list.mockReturnValue(
        of([
          { metadata: { name: 'default' } },
          { metadata: { name: 'kube-system' } },
        ]),
      );
      fixture.componentRef.setInput('context', namespacedContext);
      fixture.detectChanges();
      await component.open();
      const nsField = component
        .formFields()
        .find((f) => f.name === 'metadata.namespace');
      expect(nsField?.values).toEqual(['default', 'kube-system']);
    });

    it('should pass a dynamic values read error to the error handler', async () => {
      const error = new Error('list failed');
      resourceService.list.mockReturnValue(throwError(() => error));
      resourceService.getNamespace.mockReturnValue('default');
      fixture.componentRef.setInput('fields', [
        {
          property: 'spec.region',
          dynamicValuesDefinition: {
            operation: 'v1.Namespaces.items',
            gqlQuery:
              'query { v1 { Namespaces { items { metadata { name } } } } }',
            value: 'metadata.name',
            key: 'metadata.name',
          },
        },
      ] as any);
      fixture.componentRef.setInput('context', namespacedContext);
      fixture.detectChanges();

      await component.open();

      expect(errorHandlerService.handleError).toHaveBeenCalledWith(error);
    });

    it('should call resourceService.list with the correct operation and query when prefetching', async () => {
      resourceService.list.mockReturnValue(of([]));
      fixture.componentRef.setInput('context', namespacedContext);
      fixture.detectChanges();
      await component.open();
      expect(resourceService.list).toHaveBeenCalledWith(
        'v1.Namespaces.items',
        'query { v1 { Namespaces { items { metadata { name } } } } }',
        namespacedContext,
        { variables: {} },
      );
    });

    describe('dynamic values that require $namespace', () => {
      const secretField: PlatformMeshFieldDefinition = {
        property: 'spec.clusterRef.kubeconfigSecretName',
        label: 'BYOC Cluster',
        dynamicValuesDefinition: {
          operation: 'v1.Secrets.items',
          gqlQuery:
            'query ($namespace: String!) { v1 { Secrets(namespace: $namespace) { items { metadata { name } } } } }',
          value: 'metadata.name',
          key: 'metadata.name',
        },
      };

      const secretCalls = () =>
        resourceService.list.mock.calls.filter(
          (call) => call[0] === 'v1.Secrets.items',
        );

      beforeEach(() => {
        resourceService.list.mockReturnValue(
          of([{ metadata: { name: 'kubeconfig-a' } }]),
        );
      });

      it('does not send the query when no namespace resolves', async () => {
        resourceService.getNamespace.mockReturnValue(undefined);
        fixture.componentRef.setInput('fields', [secretField]);
        fixture.componentRef.setInput('context', namespacedContext);
        fixture.detectChanges();

        await component.open();

        expect(secretCalls()).toHaveLength(0);
        expect(component.dialogOpen()).toBe(true);
        const field = component
          .formFields()
          .find((f) => f.name === 'spec.clusterRef.kubeconfigSecretName');
        expect(field?.values).toBeUndefined();
        expect(
          component.formFields().some((f) => f.name === 'metadata.namespace'),
        ).toBe(true);
      });

      it('does not send the query for a cluster-scoped context', async () => {
        fixture.componentRef.setInput('fields', [secretField]);
        fixture.detectChanges();

        await component.open();

        expect(secretCalls()).toHaveLength(0);
      });

      it('sends the query when the context resolves a namespace', async () => {
        resourceService.getNamespace.mockReturnValue('default');
        fixture.componentRef.setInput('fields', [secretField]);
        fixture.componentRef.setInput('context', namespacedContext);
        fixture.detectChanges();

        await component.open();

        expect(secretCalls()).toHaveLength(1);
        const field = component
          .formFields()
          .find((f) => f.name === 'spec.clusterRef.kubeconfigSecretName');
        expect(field?.values).toEqual(['kubeconfig-a']);
      });

      it('sends the query when gqlQueryVariables supply the namespace', async () => {
        resourceService.getNamespace.mockReturnValue(undefined);
        fixture.componentRef.setInput('fields', [
          {
            ...secretField,
            dynamicValuesDefinition: {
              ...secretField.dynamicValuesDefinition!,
              gqlQueryVariables: { namespace: 'shared' },
            },
          },
        ]);
        fixture.componentRef.setInput('context', namespacedContext);
        fixture.detectChanges();

        await component.open();

        expect(secretCalls()).toHaveLength(1);
        expect(secretCalls()[0][3]).toEqual({
          variables: { namespace: { type: 'String!', value: 'shared' } },
        });
      });
    });

    it('resolves dynamicValuesDefinition.gqlQueryVariables (context placeholder + literal) and passes them to list', async () => {
      resourceService.list.mockReturnValue(of([]));

      const ctx: any = {
        resourceDefinition: { scope: 'Namespaced' },
        namespaceId: 'team-a',
        portalContext: { crdGatewayApiUrl: 'http://example.com' },
      };
      const fieldsWithVars: PlatformMeshFieldDefinition[] = [
        {
          property: 'spec.region',
          label: 'Region',
          required: true,
          dynamicValuesDefinition: {
            operation: 'inventory.v1alpha1.Regions.items',
            gqlQuery:
              'query ($namespace: String, $provider: String) { inventory { v1alpha1 { Regions(namespace: $namespace, provider: $provider) { items { metadata { name } } } } } }',
            value: 'metadata.name',
            key: 'metadata.name',
            gqlQueryVariables: {
              namespace: '{context.namespaceId}',
              provider: 'aws',
            },
          },
        },
      ];

      fixture.componentRef.setInput('fields', fieldsWithVars);
      fixture.componentRef.setInput('context', ctx);
      fixture.detectChanges();
      await component.open();

      const call = resourceService.list.mock.calls.find(
        (c) => c[0] === 'inventory.v1alpha1.Regions.items',
      )!;
      expect(call[3]).toEqual({
        variables: {
          namespace: { type: 'String', value: 'team-a' },
          provider: { type: 'String', value: 'aws' },
        },
      });
    });

    it('should store static values from field.values in formField.values', async () => {
      const staticFields: PlatformMeshFieldDefinition[] = [
        {
          property: 'spec.type',
          label: 'Type',
          values: ['A', 'B', 'C'],
        },
      ];
      fixture.componentRef.setInput('fields', staticFields);
      await component.open();
      const typeField = component
        .formFields()
        .find((f) => f.name === 'spec.type');
      expect(typeField?.values).toEqual(['A', 'B', 'C']);
    });
  });

  describe('open seeding', () => {
    it('sets stable initial values on edit open', async () => {
      const dialog = fixture.debugElement.query(
        (de) => de.componentInstance instanceof ResourceFormDialog,
      )?.componentInstance as ResourceFormDialog;
      expect(dialog).toBeDefined();
      const spy = vi.spyOn(dialog, 'patchForm');

      await component.open({
        metadata: { name: 'res1' },
        spec: { description: 'hello' },
      } as any);

      expect(spy).not.toHaveBeenCalled();
      expect(component.initialValues()).toMatchObject({
        'metadata.name': 'res1',
        'spec.description': 'hello',
      });
    });

    it('sets stable initial values on create open', async () => {
      const dialog = fixture.debugElement.query(
        (de) => de.componentInstance instanceof ResourceFormDialog,
      )?.componentInstance as ResourceFormDialog;
      const spy = vi.spyOn(dialog, 'patchForm');

      await component.open();

      expect(spy).not.toHaveBeenCalled();
      expect(component.initialValues()).toEqual({});
    });
  });

  describe('computed signals', () => {
    it('dialogTitle should be "Create" in create mode', async () => {
      await component.open();
      expect(component.dialogTitle()).toBe('Create');
    });

    it('dialogTitle should be "Edit" in edit mode', async () => {
      await component.open({ metadata: { name: 'r1' } } as any);
      expect(component.dialogTitle()).toBe('Edit');
    });

    it('confirmLabel should be "Create" in create mode', async () => {
      await component.open();
      expect(component.confirmLabel()).toBe('Create');
    });

    it('confirmLabel should be "Save" in edit mode', async () => {
      await component.open({ metadata: { name: 'r1' } } as any);
      expect(component.confirmLabel()).toBe('Save');
    });

    it('dataTestidPrefix should be "create-resource-dialog" in create mode', async () => {
      await component.open();
      expect(component.dataTestidPrefix()).toBe('create-resource-dialog');
    });

    it('dataTestidPrefix should be "edit-resource-dialog" in edit mode', async () => {
      await component.open({ metadata: { name: 'r1' } } as any);
      expect(component.dataTestidPrefix()).toBe('edit-resource-dialog');
    });
  });

  describe('onFormSubmit', () => {
    it('should emit resource when not in edit mode', async () => {
      await component.open();
      const spy = vi.spyOn(component.resource, 'emit');
      component.onFormSubmit({ 'metadata.name': 'new-res' });
      expect(spy).toHaveBeenCalledWith({ 'metadata.name': 'new-res' });
    });

    it('should emit updateResource when in edit mode', async () => {
      await component.open({ metadata: { name: 'existing' } } as any);
      const spy = vi.spyOn(component.updateResource, 'emit');
      component.onFormSubmit({
        metadata: { name: 'existing' },
        spec: { description: 'updated' },
      });
      expect(spy).toHaveBeenCalledWith({
        metadata: { name: 'existing' },
        spec: { description: 'updated' },
      });
    });

    it('should not emit updateResource when not in edit mode', async () => {
      await component.open();
      const spy = vi.spyOn(component.updateResource, 'emit');
      component.onFormSubmit({ 'metadata.name': 'new-res' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('should not emit resource when in edit mode', async () => {
      await component.open({ metadata: { name: 'existing' } } as any);
      const spy = vi.spyOn(component.resource, 'emit');
      component.onFormSubmit({ 'metadata.name': 'existing' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('should expand collection entries and omit empty write-only fields on edit submit', async () => {
      fixture.componentRef.setInput('fields', [
        ...testFields,
        { property: 'spec.clientSecret', writeOnly: true },
        {
          property: 'spec.services',
          propertyCollection: [{ property: 'serviceTemplate.metadata.name' }],
        },
      ]);
      await component.open({ metadata: { name: 'sample-widget' } } as any);
      const spy = vi.spyOn(component.updateResource, 'emit');

      component.onFormSubmit({
        metadata: { name: 'sample-widget' },
        spec: {
          description: 'updated',
          clientSecret: '',
          services: [{ 'serviceTemplate.metadata.name': 'sample-service' }],
        },
      });

      expect(spy).toHaveBeenCalledWith({
        metadata: { name: 'sample-widget' },
        spec: {
          description: 'updated',
          services: [
            { serviceTemplate: { metadata: { name: 'sample-service' } } },
          ],
        },
      });
    });

    it('should omit empty write-only fields on edit submit', async () => {
      const fieldsWithSecret: PlatformMeshFieldDefinition[] = [
        { property: 'metadata.name', required: true, label: 'Name' },
        {
          property: 'spec.oidc.clientSecret',
          label: 'Client secret',
          writeOnly: true,
        },
      ];
      fixture.componentRef.setInput('fields', fieldsWithSecret);
      await component.open({ metadata: { name: 'existing' } } as any);
      const spy = vi.spyOn(component.updateResource, 'emit');
      component.onFormSubmit({
        metadata: { name: 'existing' },
        spec: { oidc: { clientSecret: '' } },
      });
      expect(spy).toHaveBeenCalledWith({ metadata: { name: 'existing' } });
    });

    it('should keep non-empty write-only fields on edit submit', async () => {
      const fieldsWithSecret: PlatformMeshFieldDefinition[] = [
        { property: 'metadata.name', required: true, label: 'Name' },
        {
          property: 'spec.oidc.clientSecret',
          label: 'Client secret',
          writeOnly: true,
        },
      ];
      fixture.componentRef.setInput('fields', fieldsWithSecret);
      await component.open({ metadata: { name: 'existing' } } as any);
      const spy = vi.spyOn(component.updateResource, 'emit');
      component.onFormSubmit({
        metadata: { name: 'existing' },
        spec: { oidc: { clientSecret: 'new-secret' } },
      });
      expect(spy).toHaveBeenCalledWith({
        metadata: { name: 'existing' },
        spec: { oidc: { clientSecret: 'new-secret' } },
      });
    });
  });

  describe('onFieldChange / K8S name validation', () => {
    beforeEach(async () => {
      await component.open();
    });

    it('should set a fieldError when metadata.name is empty', () => {
      component.onFieldChange({ fieldProperty: 'metadata.name', value: '' });
      expect(component.fieldErrors()['metadata.name']).toBe(
        'This field is required',
      );
    });

    it('should set the RFC 1035 error message for an invalid k8s name', () => {
      component.onFieldChange({
        fieldProperty: 'metadata.name',
        value: 'Invalid_Name',
      });
      expect(component.fieldErrors()['metadata.name']).toBe(
        'Invalid resource name accrording to RFC 1035',
      );
    });

    it('should clear errors for a valid k8s name', () => {
      component.onFieldChange({
        fieldProperty: 'metadata.name',
        value: 'valid-name',
      });
      expect(component.fieldErrors()['metadata.name']).toBeNull();
    });

    it('should accept a single-character lowercase name as valid', () => {
      component.onFieldChange({ fieldProperty: 'metadata.name', value: 'a' });
      expect(component.fieldErrors()['metadata.name']).toBeNull();
    });

    it('should reject a name starting with a digit', () => {
      component.onFieldChange({
        fieldProperty: 'metadata.name',
        value: '1bad',
      });
      expect(component.fieldErrors()['metadata.name']).toBeTruthy();
    });

    it('should reject a name ending with a hyphen', () => {
      component.onFieldChange({
        fieldProperty: 'metadata.name',
        value: 'bad-',
      });
      expect(component.fieldErrors()['metadata.name']).toBeTruthy();
    });

    it('should not set an error for an optional non-name field with an empty value', () => {
      component.onFieldChange({
        fieldProperty: 'spec.description',
        value: '',
      });
      expect(component.fieldErrors()['spec.description']).toBeNull();
    });

    it('should set a required error for a required non-name field with an empty value', async () => {
      fixture.componentRef.setInput('fields', [
        { property: 'spec.type', required: true, label: 'Type' },
      ]);
      await component.open();
      component.onFieldChange({ fieldProperty: 'spec.type', value: '' });
      expect(component.fieldErrors()['spec.type']).toBe(
        'This field is required',
      );
    });

    it('should not require empty write-only fields in edit mode', async () => {
      const fieldsWithSecret: PlatformMeshFieldDefinition[] = [
        { property: 'metadata.name', required: true, label: 'Name' },
        {
          property: 'spec.oidc.clientSecret',
          label: 'Client secret',
          inputType: 'Password',
          required: true,
          writeOnly: true,
        },
      ];
      fixture.componentRef.setInput('fields', fieldsWithSecret);
      await component.open({ metadata: { name: 'existing' } } as any);

      component.onFieldChange({
        fieldProperty: 'spec.oidc.clientSecret',
        value: '',
      });

      expect(component.fieldErrors()['spec.oidc.clientSecret']).toBeNull();
    });
  });

  describe('isEditMode', () => {
    it('should return false by default', () => {
      expect(component.isEditMode()).toBe(false);
    });

    it('should return true after opening with a resource', async () => {
      await component.open({ metadata: { name: 'r1' } } as any);
      expect(component.isEditMode()).toBe(true);
    });

    it('should return false when opened without a resource', async () => {
      await component.open();
      expect(component.isEditMode()).toBe(false);
    });

    it('should return false after close', async () => {
      await component.open({ metadata: { name: 'r1' } } as any);
      component.close();
      expect(component.isEditMode()).toBe(false);
    });
  });

  describe('field-to-field dependencies', () => {
    const nsQuery =
      'query ($namespace: String!) { v1 { Secrets(namespace: $namespace) { items { metadata { name } } } } }';

    const namespaceField: PlatformMeshFieldDefinition = {
      property: 'metadata.namespace',
      required: true,
      label: 'Namespace',
      dynamicValuesDefinition: {
        operation: 'v1.Namespaces.items',
        gqlQuery: 'query { v1 { Namespaces { items { metadata { name } } } } }',
        value: 'metadata.name',
        key: 'metadata.name',
      },
    };

    const secretField: PlatformMeshFieldDefinition = {
      property: 'spec.secretName',
      required: true,
      label: 'Secret',
      dynamicValuesDefinition: {
        operation: 'v1.Secrets.items',
        gqlQuery: nsQuery,
        value: 'metadata.name',
        key: 'metadata.name',
        gqlQueryVariables: { namespace: '{form.metadata.namespace}' },
      },
    };

    const regionField: PlatformMeshFieldDefinition = {
      property: 'spec.region',
      required: true,
      label: 'Region',
      dynamicValuesDefinition: {
        operation: 'regions.items',
        gqlQuery: 'query { regions { items { name } } }',
        value: 'name',
        key: 'name',
      },
    };

    const zoneField: PlatformMeshFieldDefinition = {
      property: 'spec.zone',
      label: 'Zone',
      dynamicValuesDefinition: {
        operation: 'zones.items',
        gqlQuery:
          'query ($region: String!) { zones(region: $region) { items { name } } }',
        value: 'name',
        key: 'name',
        gqlQueryVariables: { region: '{form.spec.region}' },
      },
    };

    beforeEach(() => {
      resourceService.list.mockReturnValue(of([]));
    });

    describe('open (create mode) — resolveDynamicValues with {form.X}', () => {
      it.each([
        undefined,
        { metadata: { name: 'resource', namespace: 'fixed-ns' } },
      ])(
        'loads dependent options with a fixed context namespace and no namespace control (%j)',
        async (resource) => {
          fixture.componentRef.setInput('fields', [secretField]);
          fixture.componentRef.setInput('context', namespacedContext);
          resourceService.getNamespace.mockReturnValue('fixed-ns');
          resourceService.list.mockReturnValue(
            of([{ metadata: { name: 'secret' } }]),
          );
          await component.open(resource);
          expect(component.formFields().map((field) => field.name)).toEqual([
            'spec.secretName',
          ]);
          expect(component.formFields()[0].values).toEqual(['secret']);
          expect(resourceService.list).toHaveBeenCalledWith(
            'v1.Secrets.items',
            nsQuery,
            namespacedContext,
            {
              variables: { namespace: { type: 'String!', value: 'fixed-ns' } },
            },
          );
        },
      );

      it('skips the secret query on create when no parent value is available', async () => {
        fixture.componentRef.setInput('fields', [namespaceField, secretField]);
        fixture.componentRef.setInput('context', namespacedContext);
        resourceService.getNamespace.mockReturnValue(undefined);
        fixture.detectChanges();

        await component.open();

        const secretCalls = resourceService.list.mock.calls.filter(
          (c) => c[0] === 'v1.Secrets.items',
        );
        expect(secretCalls).toHaveLength(0);
        const sf = component
          .formFields()
          .find((f) => f.name === 'spec.secretName');
        expect(sf?.values).toEqual([]);
      });

      it('resolves a dependent from the parent initial value in edit mode', async () => {
        resourceService.getNamespace.mockReturnValue(undefined);
        resourceService.list.mockImplementation((op) => {
          if (op === 'v1.Namespaces.items')
            return of([{ metadata: { name: 'my-ns' } }]);
          if (op === 'v1.Secrets.items')
            return of([{ metadata: { name: 'my-secret' } }]);
          return of([]);
        });

        fixture.componentRef.setInput('fields', [namespaceField, secretField]);
        fixture.componentRef.setInput('context', namespacedContext);
        fixture.detectChanges();

        await component.open({
          metadata: { name: 'res1', namespace: 'my-ns' },
        } as any);

        const secretCalls = resourceService.list.mock.calls.filter(
          (c) => c[0] === 'v1.Secrets.items',
        );
        expect(secretCalls).toHaveLength(1);
        expect(secretCalls[0][3]).toEqual({
          variables: { namespace: { type: 'String!', value: 'my-ns' } },
        });

        const sf = component
          .formFields()
          .find((f) => f.name === 'spec.secretName');
        expect(sf?.values).toEqual(['my-secret']);
      });
    });

    describe('open() — trigger wiring', () => {
      it('sets validation:onChange on a parent field that has dependents', async () => {
        resourceService.getNamespace.mockReturnValue('default');
        fixture.componentRef.setInput('fields', [namespaceField, secretField]);
        fixture.componentRef.setInput('context', namespacedContext);
        fixture.detectChanges();

        await component.open();

        const nff = component
          .formFields()
          .find((f) => f.name === 'metadata.namespace');
        expect(nff?.validation).toBe('onChange');
      });

      it('keeps required dependent validation onChange', async () => {
        resourceService.getNamespace.mockReturnValue('default');
        fixture.componentRef.setInput('fields', [namespaceField, secretField]);
        fixture.componentRef.setInput('context', namespacedContext);
        fixture.detectChanges();

        await component.open();

        // Required fields validate on change independently of dependencies.
        const sf = component
          .formFields()
          .find((f) => f.name === 'spec.secretName');
        expect(sf?.validation).toBe('onChange');
      });
    });

    describe('user changes', () => {
      beforeEach(async () => {
        resourceService.getNamespace.mockReturnValue(undefined);
        fixture.componentRef.setInput('fields', [namespaceField, secretField]);
        fixture.componentRef.setInput('context', namespacedContext);
        fixture.detectChanges();
        await component.open();
        resourceService.list.mockReset();
      });

      it('clears immediately and loads options for the selected parent', async () => {
        resourceService.list.mockReturnValue(
          of([{ metadata: { name: 'secret-a' } }]),
        );

        component.onFieldChange({
          fieldProperty: 'metadata.namespace',
          value: 'team-a',
          source: 'user',
          formValues: {
            'metadata.namespace': 'team-a',
            'spec.secretName': 'old',
          },
        });

        expect(
          component
            .formFields()
            .find((field) => field.name === 'spec.secretName')?.values,
        ).toEqual([]);
        expect(component.pending()).toBe(true);
        expect(component.fieldErrors()['spec.secretName']).toBeNull();
        expect(component.formPending()).toBe(true);

        await vi.waitFor(() => {
          expect(
            component
              .formFields()
              .find((field) => field.name === 'spec.secretName')?.values,
          ).toEqual(['secret-a']);
        });
        expect(component.pending()).toBe(false);
        expect(component.formPending()).toBe(true);
        component.onFieldChange({
          fieldProperty: 'spec.secretName',
          value: '',
          source: 'seed',
        });
        expect(component.fieldErrors()['spec.secretName']).toBeNull();
        expect(component.formPending()).toBe(true);
        await fixture.whenStable();
        const dialog = (component as any).dialog() as ResourceFormDialog;
        expect(dialog.pending()).toBe(true);
        component.onFieldChange({
          fieldProperty: 'spec.secretName',
          value: 'secret-a',
          source: 'user',
        });
        expect(component.formPending()).toBe(false);
        await fixture.whenStable();
        expect(dialog.pending()).toBe(false);
        expect(resourceService.list).toHaveBeenCalledWith(
          'v1.Secrets.items',
          expect.anything(),
          expect.anything(),
          { variables: { namespace: { type: 'String!', value: 'team-a' } } },
        );
      });

      it('does not clear or re-query on a seed event', () => {
        component.onFieldChange({
          fieldProperty: 'metadata.namespace',
          value: 'team-a',
          source: 'seed',
          formValues: { 'metadata.namespace': 'team-a' },
        });
        expect(resourceService.list).not.toHaveBeenCalled();
        expect(component.pending()).toBe(false);
      });
    });

    describe('open(resource) — initial dependent-field resolve on edit-open', () => {
      // Guards that opening the modal in EDIT mode (resource argument supplied)
      // resolves the dependent field's `values` against the prefilled parent
      // BEFORE the user interacts — so the user sees a populated option list
      // from the moment the dialog mounts. Pre-fix behavior passed `{}` to the
      // resolver, which produced an empty option list on edit-open.
      it('resolves dependent values against the prefilled parent', async () => {
        resourceService.getNamespace.mockReturnValue(undefined);
        resourceService.list.mockImplementation((op: string) =>
          op === 'v1.Secrets.items'
            ? of([{ metadata: { name: 'secret-for-ns-a' } }])
            : of([
                { metadata: { name: 'ns-a' } },
                { metadata: { name: 'ns-b' } },
              ]),
        );

        fixture.componentRef.setInput('fields', [namespaceField, secretField]);
        fixture.componentRef.setInput('context', namespacedContext);
        fixture.detectChanges();

        const resource = {
          metadata: { name: 'edited', namespace: 'ns-a' },
          spec: { secretName: 'secret-for-ns-a' },
        } as any;

        await component.open(resource);

        const secretsFromThunk = component
          .formFields()
          .find((f) => f.name === 'spec.secretName');
        expect(secretsFromThunk?.values).toEqual(['secret-for-ns-a']);

        // And the list call MUST have been made with the resolved namespace,
        // not the unresolved placeholder.
        const secretCalls = resourceService.list.mock.calls.filter(
          (c) => c[0] === 'v1.Secrets.items',
        );
        expect(secretCalls.length).toBeGreaterThan(0);
        expect(secretCalls[0][3]).toEqual({
          variables: { namespace: { type: 'String!', value: 'ns-a' } },
        });
      });
    });

    describe('backward compatibility', () => {
      it('fields without form placeholders behave as before', async () => {
        resourceService.getNamespace.mockReturnValue('default');
        fixture.componentRef.setInput('fields', [regionField]);
        fixture.componentRef.setInput('context', namespacedContext);
        fixture.detectChanges();

        await component.open();

        // region has no dependents; changing it should not push signals
        const listCallsBefore = resourceService.list.mock.calls.length;

        await component.onFieldChange({
          fieldProperty: 'spec.region',
          value: 'eu-west',
        });

        expect(resourceService.list.mock.calls).toHaveLength(listCallsBefore);
      });

      it('resolveDynamicValuesResult works when called without extra formValues (existing call sites)', async () => {
        resourceService.getNamespace.mockReturnValue('default');
        resourceService.list.mockReturnValue(of([{ name: 'region-a' }]));

        const result = await (component as any).resolveDynamicValuesResult(
          regionField,
          {},
        );
        expect(result).toEqual({ kind: 'ready', values: ['region-a'] });
      });
    });

    describe('unresolved {form.X} placeholder acts as no-namespace (skip guard)', () => {
      it('does not call list when the {form.X} namespace placeholder is unresolved', async () => {
        resourceService.getNamespace.mockReturnValue(undefined);
        fixture.componentRef.setInput('fields', [namespaceField, secretField]);
        fixture.componentRef.setInput('context', namespacedContext);
        fixture.detectChanges();

        const result = await (component as any).resolveDynamicValuesResult(
          secretField,
          {},
        );

        expect(result).toEqual({ kind: 'blocked' });
        expect(
          resourceService.list.mock.calls.some(
            (c) => c[0] === 'v1.Secrets.items',
          ),
        ).toBe(false);
      });
    });
  });
});
