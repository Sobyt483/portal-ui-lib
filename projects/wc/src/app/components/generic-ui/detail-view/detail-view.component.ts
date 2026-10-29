import {
  downloadFile,
  executeButtonAction,
  processGroupFields,
  withRouteNamespace,
} from '../../../utils';
import { ResourceFormModal } from '../resource-form-modal/resource-form-modal.component';
import { ResourceLogo } from '../resource-logo/resource-logo.component';
import { AVAILABLE_CARDS, CARDS, SECTIONS } from './cards';
import { DashboardConfigService } from './dashboard-config.service';
import {
  KubeConfigTemplateProps,
  kubeConfigTemplate,
} from './kubeconfig-template';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { IllustratedMessage } from '@fundamental-ngx/ui5-webcomponents-fiori/illustrated-message';
import { Button } from '@fundamental-ngx/ui5-webcomponents/button';
import { Label } from '@fundamental-ngx/ui5-webcomponents/label';
import { Option } from '@fundamental-ngx/ui5-webcomponents/option';
import { Select } from '@fundamental-ngx/ui5-webcomponents/select';
import { LuigiClient } from '@luigi-project/client/luigi-element';
import {
  ButtonSettings,
  CardConfig,
  Dashboard,
  DeleteConfirmationDialog,
  DeleteResourceConfirmationConfig,
  EN_DEFAULTS,
  ResourceField,
  SectionConfig,
} from '@openmfp/ngx';
import { LuigiCoreService } from '@openmfp/portal-ui-lib';
import {
  DOWNLOAD_KUBECONFIG_FROM_SECRET_REF_ACTION,
  PlatformMeshFieldDefinition,
  Resource,
} from '@platform-mesh/portal-ui-lib/models';
import {
  AccountInfoService,
  ErrorHandlerService,
  GatewayService,
  KubeconfigSecretService,
  NamespaceService,
  ResourceNodeContext,
  ResourceRequestParams,
  ResourceService,
  isDownloadKubeconfigButtonSettings,
} from '@platform-mesh/portal-ui-lib/services';
import {
  generateGraphQLFields,
  generateGraphQLReadFields,
  getResourceValueByJsonPath,
  isNamespacedResource,
  permissionKey,
} from '@platform-mesh/portal-ui-lib/utils';
import { UI5CustomEvent } from '@ui5/webcomponents-base';
import '@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js';
import '@ui5/webcomponents-fiori/dist/illustrations/UnableToLoad.js';
import _Select from '@ui5/webcomponents/dist/Select.js';
import { Subject, Subscription, firstValueFrom } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';

type ResourceReadState =
  'loading' | 'ready' | 'error' | 'not-found' | 'redirecting';

@Component({
  selector: 'pm-detail-view',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    IllustratedMessage,
    Button,
    Label,
    Option,
    Select,
    ResourceField,
    ResourceFormModal,
    DeleteConfirmationDialog,
    ResourceLogo,
    Dashboard,
  ],
  templateUrl: './detail-view.component.html',
  styleUrl: './detail-view.component.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailView {
  private resourceService = inject(ResourceService);
  private accountInfoService = inject(AccountInfoService);
  private gatewayService = inject(GatewayService);
  private kubeconfigSecretService = inject(KubeconfigSecretService);
  private errorHandlerService = inject(ErrorHandlerService);
  private dashboardConfigService = inject(DashboardConfigService);
  private luigiCoreService = inject(LuigiCoreService);
  private namespaceService = inject(NamespaceService);
  private destroyRef = inject(DestroyRef);
  private resourceReadGeneration = 0;
  private resourceReadSubscription?: Subscription;
  private readonly readContext = signal<ResourceNodeContext | undefined>(
    undefined,
  );
  private readonly readState = signal<ResourceReadState>('loading');
  protected readonly namespaceRequired = signal(false);
  protected readonly selectedNamespace = signal<string | undefined>(undefined);
  protected readonly namespaces = linkedSignal(
    () => this.context().namespaces ?? [],
  );
  private readonly cancelKubeconfigRead = new Subject<void>();
  protected readonly getResourceValueByJsonPath = getResourceValueByJsonPath;
  private createModal = viewChild<ResourceFormModal>('createModal');
  protected deleteDialogOpen = signal(false);
  protected deleteConfig = computed<DeleteResourceConfirmationConfig>(() => {
    const name = this.resourceId()?.toLowerCase() ?? '';
    return {
      title: `Delete ${name}`,
      message: `<p>Are you sure you want to delete ${this.resourceDefinition()?.entity} <b>${name}</b>?</p>
        <p class="dialog__message--critical">This action <b>cannot</b> be undone.</p>
        <p>Please type <b>${name}</b> to confirm:</p>`,
      confirmationText: name,
      confirmationPlaceholder: 'Type name',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    };
  });

  LuigiClient = input.required<LuigiClient>();
  context = input.required<ResourceNodeContext>();
  resource = signal<Resource | undefined>(undefined);
  protected readonly viewState = computed(() =>
    this.effectiveContext() === this.readContext()
      ? this.readState()
      : 'loading',
  );

  // A detail view addresses exactly one resource, so the '-all-' namespace
  // selection can never satisfy its reads or mutations. When no real
  // namespace resolves from the context or the ?namespace param, recover it
  // from the route's namespaceId path param.
  protected effectiveContext = computed<ResourceNodeContext>(() => {
    const context = this.context();
    return withRouteNamespace(
      context,
      this.resourceService.getNamespace(context),
      this.LuigiClient().getPathParams?.(),
    );
  });

  resourceDefinition = computed(() => this.context().resourceDefinition);
  defaultTitle = computed(
    () => this.resource()?.spec?.displayName || this.resourceId() || '',
  );
  defaultDescription = computed(
    () =>
      `The ${this.resourceDefinition()?.entity} for ${this.resource()?.spec?.displayName || this.resourceId()}`,
  );

  resourceTitleDefinition = computed(
    () =>
      this.resourceDefinition()?.ui?.detailView?.resourceTitle?.label ??
      this.defaultTitle(),
  );
  resourceDescriptionDefinition = computed(
    () =>
      this.resourceDefinition()?.ui?.detailView?.resourceDescription?.label ??
      this.defaultDescription(),
  );

  resourceDetailFields = computed(
    () => this.resourceDefinition()?.ui?.detailView?.fields ?? [],
  );
  resourceCreateEditFields = computed(
    () => this.resourceDefinition()?.ui?.createView?.fields ?? [],
  );
  resourceId = computed(() => this.context().resourceId);
  workspacePath = computed(() =>
    this.gatewayService.resolveKcpPath(this.context()),
  );
  viewFields = computed(() => processGroupFields(this.resourceDetailFields()));
  showDownloadKubeconfig = computed(
    () =>
      this.resourceDefinition()?.ui?.detailView?.showDownloadKubeconfig ??
      false,
  );
  configuredActions = computed<PlatformMeshFieldDefinition[]>(() => {
    // Content configuration is runtime JSON, so guard the shape.
    const actions = this.resourceDefinition()?.ui?.detailView?.actions;
    return Array.isArray(actions)
      ? actions.filter(
          (action) =>
            !!action?.uiSettings?.buttonSettings &&
            (!action.requirePermission ||
              this.canDoAction(action.requirePermission)),
        )
      : [];
  });
  isDownloadingKubeConfig = signal(false);
  isDemoEnabled = computed(() =>
    this.LuigiClient().getActiveFeatureToggles().includes('neoNephosDemo'),
  );

  private isNamespaced = computed(() => isNamespacedResource(this.context()));
  private instancePermissions = computed(() => {
    // The permission key must mirror how the host seeded portalPermissions
    // (namespace from the raw context, not the route-repaired one), or the
    // lookup misses and action gating silently falls open.
    return this.permissionsFor(
      this.resourceId(),
      this.resourceService.getNamespace(this.context()),
    );
  });

  customActions = computed(() => {
    if (this.viewState() !== 'ready' || !this.resource()) return [];
    const customActions: ButtonSettings[] = [];

    if (this.showDownloadKubeconfig()) {
      customActions.push({
        action: 'download-kubeconfig',
        text: 'Download kubeconfig',
        icon: 'download-from-cloud',
        design: 'Default',
        tooltip: 'Download kubeconfig',
      });
    }

    if (this.resource()) {
      if (this.canDoAction('update')) {
        customActions.push({
          action: 'edit',
          text: 'Edit',
          icon: 'edit',
          design: 'Default',
        });
      }

      if (this.canDoAction('delete')) {
        customActions.push({
          action: 'delete',
          text: 'Delete',
          icon: 'delete',
          design: 'Negative',
        });
      }
    }

    customActions.push(
      ...this.configuredActions()
        .filter((action) => {
          const buttonSettings = action.uiSettings?.buttonSettings;
          return (
            !isDownloadKubeconfigButtonSettings(buttonSettings) ||
            this.kubeconfigSecretService.isSecretReferenceAvailable(
              buttonSettings,
              this.resource(),
              this.effectiveContext(),
            )
          );
        })
        .flatMap((action) => action.uiSettings?.buttonSettings ?? []),
    );

    return customActions;
  });

  i18n = computed(() => {
    return {
      ...EN_DEFAULTS,
      title: this.resourceTitleDefinition(),
      description: this.resourceDescriptionDefinition(),
    };
  });

  dashboardConfig = computed(() => {
    const backgroundImageUrl = this.isDemoEnabled()
      ? ''
      : this.resourceDefinition()?.ui?.detailView?.backgroundImageUrl;

    return {
      title: this.resourceTitleDefinition(),
      description: this.resourceDescriptionDefinition(),
      editable: false || this.isDemoEnabled(),
      backgroundImageUrl,
    };
  });

  sections = computed<SectionConfig[]>(() => {
    const c = this.dashboardConfigService.read({
      workspacePath: this.workspacePath(),
      entity: this.resourceDefinition()?.entity,
      resourceId: this.resourceId(),
      userId: this.context().userId,
      seed: this.isDemoEnabled() ? 'demo' : '',
    });

    return c?.sections ?? (this.isDemoEnabled() ? SECTIONS : []);
  });
  cards = computed<CardConfig[]>(() => {
    const c = this.dashboardConfigService.read({
      workspacePath: this.workspacePath(),
      entity: this.resourceDefinition()?.entity,
      resourceId: this.resourceId(),
      userId: this.context().userId,
      seed: this.isDemoEnabled() ? 'demo' : '',
    });

    return c?.cards ?? (this.isDemoEnabled() ? CARDS : []);
  });
  availableCards = computed<CardConfig[]>(() =>
    this.isDemoEnabled() ? AVAILABLE_CARDS : [],
  );

  onActionButtonClick({
    event,
    action,
  }: {
    event: MouseEvent;
    action: ButtonSettings;
  }): void {
    if (this.viewState() !== 'ready' || !this.resource()) return;
    const resource = this.resource();
    switch (action.action) {
      case DOWNLOAD_KUBECONFIG_FROM_SECRET_REF_ACTION:
        void this.downloadKubeconfigFromSecretRef(action);
        break;
      case 'download-kubeconfig':
        this.downloadKubeConfig();
        break;
      case 'edit':
        if (resource) this.openEditResourceModal(event);
        break;
      case 'delete':
        if (resource) this.openDeleteResourceModal(event);
        break;
      default:
        this.executeConfiguredAction(action, resource);
        break;
    }
  }

  constructor() {
    effect((onCleanup) => {
      this.readResource();
      onCleanup(() => this.resourceReadSubscription?.unsubscribe());
    });

    this.destroyRef.onDestroy(() => {
      this.resourceReadGeneration += 1;
      this.cancelKubeconfigRead.next();
      this.cancelKubeconfigRead.complete();

      // Safety net — the dashboard's `unsavedChangesChange` does not fire on
      // teardown, so explicitly clear Luigi's dirty flag to avoid leaving the
      // shell locked on stale state if this view is destroyed mid-edit.
      this.setLuigiPageDirty(false);
    });
  }

  /**
   * Forwards the dashboard's `hasUnsavedChanges` state to Luigi so node
   * changes (sidebar/breadcrumb navigation, top nav, etc.) trigger Luigi's
   * own "unsaved changes" prompt. Bound from the template via
   * `(unsavedChangesChange)`.
   *
   * TODO: replace the postMessage hack with
   *   this.LuigiClient().uxManager().setDirtyStatus(dirty)
   * once the bundled Luigi client exposes setDirtyStatus. The hack matches
   * the message contract Luigi already listens for internally.
   */
  protected setLuigiPageDirty(dirty: boolean): void {
    window.postMessage(
      {
        msg: 'luigi.set-page-dirty',
        dirty,
      },
      '*',
    );
  }

  private readResource() {
    this.resourceReadSubscription?.unsubscribe();
    this.resourceReadGeneration += 1;
    const generation = this.resourceReadGeneration;
    const context = this.effectiveContext();
    const isCurrentRead = () =>
      generation === this.resourceReadGeneration &&
      context === this.effectiveContext();
    this.cancelKubeconfigRead.next();

    // A custom element can be reused with a different workspace or resource.
    // Drop the previous payload before resolving the new context so actions
    // can never combine an old Secret reference with a new workspace path.
    this.resource.set(undefined);
    this.readContext.set(context);
    this.readState.set('loading');
    this.namespaceRequired.set(
      this.isNamespaced() && !this.resourceService.getNamespace(context),
    );
    this.selectedNamespace.set(undefined);
    const resourceDefinition = this.getResourceDefinition();
    const fields = this.getDetailViewQueryFields();

    const params: ResourceRequestParams = resourceDefinition;

    const resourceId = this.resourceId();
    if (!resourceId) {
      this.LuigiClient().uxManager().showAlert({
        text: 'Resource ID is not defined',
        type: 'error',
      });

      throw new Error('Resource ID is not defined');
    }

    this.resourceReadSubscription = this.resourceService
      .read(
        resourceId,
        params,
        fields,
        context,
        params.entity.toLowerCase() === 'account',
      )
      .subscribe({
        next: (result) => {
          if (!isCurrentRead()) return;
          if (result?.metadata?.deletionTimestamp) {
            this.readState.set('redirecting');
            this.errorHandlerService.handleResourcePendingDeletion(result);
            return;
          }
          this.resource.set(result ?? undefined);
          this.readState.set(result ? 'ready' : 'not-found');
        },
        error: (error) => {
          if (!isCurrentRead()) return;
          this.readState.set(
            this.errorHandlerService.redirectToErrorPage(error)
              ? 'redirecting'
              : 'error',
          );
        },
        complete: () => {
          if (isCurrentRead() && untracked(this.readState) === 'loading') {
            this.readState.set('not-found');
          }
        },
      });
    return this.resourceReadSubscription;
  }

  retryRead() {
    const state = untracked(this.viewState);
    if (state !== 'error' && state !== 'not-found') {
      return;
    }

    if (!untracked(this.namespaceRequired)) {
      this.readResource();
      return;
    }

    if (untracked(this.selectedNamespace)) {
      this.luigiCoreService.configChanged();
    }
  }

  protected refreshNamespaces() {
    this.namespaceService.list(this.effectiveContext()).subscribe({
      next: (namespaces) => this.namespaces.set(namespaces),
      error: (error) =>
        this.errorHandlerService.showError(error, 'Failed to read namespaces.'),
    });
  }

  protected selectNamespace(event: UI5CustomEvent<_Select, 'change'>) {
    const namespace = event.detail.selectedOption.value || undefined;
    this.selectedNamespace.set(namespace);
    this.LuigiClient().addCoreSearchParams({ namespace }, false, true);
  }

  navigateToParent() {
    const parentNavigationContext =
      this.context().parentNavigationContexts?.at(0);

    if (!parentNavigationContext) {
      this.LuigiClient().uxManager().showAlert({
        text: 'Parent navigation context is not defined',
        type: 'error',
      });

      throw new Error('Parent navigation context is not defined');
    }

    this.LuigiClient()
      .linkManager()
      .fromContext(parentNavigationContext)
      .navigate('/');
  }

  openDeleteResourceModal(event: MouseEvent) {
    event.stopPropagation?.();
    this.deleteDialogOpen.set(true);
  }

  openEditResourceModal(event: MouseEvent) {
    event.stopPropagation?.();
    const resourceDefinition = this.getResourceDefinition();
    // The edit form works on createView.fields, which the detail read does
    // not fetch - refetch the resource with exactly that selection so the
    // form is prefilled with current values.
    const fields = generateGraphQLReadFields(this.resourceCreateEditFields());

    this.resourceService
      .read(
        this.getResourceId(),
        resourceDefinition,
        fields,
        this.effectiveContext(),
        resourceDefinition.entity.toLowerCase() === 'account',
      )
      .pipe(take(1))
      .subscribe({
        next: (resource) => void this.createModal()?.open(resource),
        error: (error) => this.errorHandlerService.handleError(error),
      });
  }

  delete(resource: Resource) {
    const resourceDefinition = this.getResourceDefinition();
    const resourceId = this.getResourceId();

    const resourceToDelete: Resource = {
      ...resource,
      metadata: { name: resourceId },
    };

    this.resourceService
      .delete(
        resourceToDelete,
        resourceDefinition,
        this.effectiveContext(),
        resourceDefinition.entity.toLowerCase() === 'account',
      )
      .subscribe({
        next: async (_result) => {
          this.deleteDialogOpen.set(false);
          console.debug('Resource deleted.');
          this.navigateToParent();
        },
        error: (error) =>
          this.errorHandlerService.handleError(
            error,
            `Failure! Could not delete resource: ${resource.metadata.name}.`,
          ),
      });
  }

  update(resource: Resource) {
    const resourceDefinition = this.getResourceDefinition();
    const resourceId = this.getResourceId();
    const fields = generateGraphQLReadFields(this.resourceCreateEditFields());
    const resourceToUpdate: Resource = {
      ...resource,
      metadata: { name: resourceId },
    };

    this.resourceService
      .update(
        resourceToUpdate,
        resourceDefinition,
        this.effectiveContext(),
        resourceDefinition.entity.toLowerCase() === 'account',
        fields,
      )
      .subscribe({
        next: (result: any) => {
          this.resource.set(result);
          this.createModal()?.close();
          console.debug('Resource updated', result);
        },
        error: (error) =>
          this.errorHandlerService.handleError(
            error,
            `Failure! Could not update resource: ${resource.metadata.name}.`,
          ),
      });
  }

  async downloadKubeConfig() {
    if (this.isDownloadingKubeConfig()) {
      return;
    }

    try {
      this.isDownloadingKubeConfig.set(true);
      const { accountId, portalContext, accountPath, kcpCA } = this.context();
      const accountInfo = await firstValueFrom(
        this.accountInfoService.read(this.context()),
      );
      const kubeconfigProps: KubeConfigTemplateProps = {
        clusterName: accountId ?? '',
        serverUrl: `${portalContext.kcpWorkspaceUrl}:${accountPath}`,
        kcpCA: kcpCA ?? '',
        oidcIssuerUrl: accountInfo?.spec.oidc.issuerUrl ?? '',
        oidcKubectlClientId:
          accountInfo?.spec.oidc.clients.kubectl.clientId ?? '',
      };

      const kubeConfig = kubeConfigTemplate(kubeconfigProps);
      downloadFile(kubeConfig, 'kubeconfig.yaml', 'application/yaml');
    } catch (error: unknown) {
      void this.LuigiClient()
        .uxManager()
        .showAlert({
          text: `Failed to download kubeconfig: ${this.getErrorMessage(error)}`,
          type: 'error',
        });
    } finally {
      this.isDownloadingKubeConfig.set(false);
    }
  }

  async downloadKubeconfigFromSecretRef(buttonSettings: ButtonSettings) {
    if (this.isDownloadingKubeConfig() || this.viewState() !== 'ready') {
      return;
    }

    const resource = this.resource();
    const context = this.effectiveContext();
    const resourceReadGeneration = this.resourceReadGeneration;

    try {
      this.isDownloadingKubeConfig.set(true);
      const kubeconfig = await firstValueFrom(
        this.kubeconfigSecretService
          .readKubeconfig(buttonSettings, resource, context)
          .pipe(takeUntil(this.cancelKubeconfigRead)),
      );

      if (
        resourceReadGeneration !== this.resourceReadGeneration ||
        context !== this.effectiveContext() ||
        resource !== this.resource()
      ) {
        return;
      }

      downloadFile(
        kubeconfig.contents,
        kubeconfig.filename,
        'application/yaml',
      );
    } catch (error: unknown) {
      if (
        resourceReadGeneration !== this.resourceReadGeneration ||
        context !== this.effectiveContext() ||
        resource !== this.resource()
      ) {
        return;
      }

      void this.LuigiClient()
        .uxManager()
        .showAlert({
          text: `Failed to download kubeconfig: ${this.getErrorMessage(error)}`,
          type: 'error',
        });
    } finally {
      this.isDownloadingKubeConfig.set(false);
    }
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

  private getDetailViewQueryFields() {
    const resourceDefinition = this.getResourceDefinition();
    const additionalFields: PlatformMeshFieldDefinition[] = [
      { property: 'metadata.deletionTimestamp' },
    ];

    if (resourceDefinition.ui?.detailView?.resourceDescription) {
      additionalFields.push(
        resourceDefinition.ui.detailView.resourceDescription,
      );
    }

    if (this.isNamespaced()) {
      additionalFields.push({ property: 'metadata.namespace' });
    }

    if (resourceDefinition.ui?.detailView?.resourceTitle) {
      additionalFields.push(resourceDefinition.ui.detailView.resourceTitle);
    }

    this.configuredActions().forEach((action) => {
      if (
        isDownloadKubeconfigButtonSettings(action.uiSettings?.buttonSettings)
      ) {
        additionalFields.push(
          ...this.kubeconfigSecretService.secretReferenceQueryFields(
            action.uiSettings?.buttonSettings,
          ),
        );
      }
    });

    // The query covers exactly what the detail view renders
    // (ui.detailView.fields); createView is a separate field set and is not
    // part of the detail read.
    return generateGraphQLFields(
      this.resourceDetailFields().concat(additionalFields),
    );
  }

  private getResourceId() {
    const resourceId = this.resourceId();
    if (!resourceId) {
      this.LuigiClient().uxManager().showAlert({
        text: 'Resource ID is not defined',
        type: 'error',
      });

      throw new Error('Resource ID is not defined');
    }

    return resourceId;
  }

  private canDoAction(action: string): boolean {
    return this.instancePermissions()?.includes(action) ?? true;
  }

  private permissionsFor(
    name: string | undefined,
    namespace: string | undefined,
  ): string[] | undefined {
    return this.context().portalPermissions?.[
      permissionKey({
        resource: this.getResourceDefinition()?.permissionsDefinition?.resource,
        name,
        namespace,
      })
    ];
  }

  private configuredActionFor(
    buttonSettings: ButtonSettings,
  ): PlatformMeshFieldDefinition | undefined {
    // The dashboard returns the exact ButtonSettings object it received. The
    // enclosing field is still needed to resolve a dynamic path/reference.
    return this.configuredActions().find(
      (action) => action.uiSettings?.buttonSettings === buttonSettings,
    );
  }

  private executeConfiguredAction(
    buttonSettings: ButtonSettings,
    resource: Resource | undefined,
  ): void {
    const action = this.configuredActionFor(buttonSettings);
    if (!action) {
      this.showConfiguredActionError();
      return;
    }

    try {
      executeButtonAction(this.LuigiClient(), action, resource, this.context());
    } catch {
      this.showConfiguredActionError();
    }
  }

  private showConfiguredActionError(): void {
    void this.LuigiClient().uxManager().showAlert({
      text: 'Configured action could not be executed',
      type: 'error',
    });
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  protected dashboardConfigurationChanged(config: {
    cards: CardConfig[];
    sections: SectionConfig[];
  }) {
    this.dashboardConfigService.write(
      {
        workspacePath: this.workspacePath(),
        entity: this.resourceDefinition()?.entity,
        resourceId: this.resourceId(),
        userId: this.context().userId,
        seed: this.isDemoEnabled() ? 'demo' : '',
      },
      config,
    );
  }
}
