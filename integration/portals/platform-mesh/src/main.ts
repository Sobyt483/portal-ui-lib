import { StaticSettingsConfigServiceImpl } from './app/static-settings-config.service';
import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  PortalComponent,
  PortalOptions,
  providePortal,
} from '@openmfp/portal-ui-lib';
import {
  CustomGlobalNodesServiceImpl,
  CustomNodeProcessingServiceImpl,
  CustomRoutingConfigServiceImpl,
  HeaderBarConfigServiceImpl,
  LuigiExtendedGlobalContextConfigServiceImpl,
  NavigationRedirectStrategyServiceImpl,
  NodeChangeHookConfigServiceImpl,
  NodeContextProcessingServiceImpl,
  OpenPersistentPanelListener,
  UserProfileConfigServiceImpl,
  errorComponentConfig,
} from '@platform-mesh/portal-ui-lib/portal-options';

const portalOptions: PortalOptions = {
  staticSettingsConfigService: StaticSettingsConfigServiceImpl,
  nodeChangeHookConfigService: NodeChangeHookConfigServiceImpl,
  customMessageListeners: [OpenPersistentPanelListener],
  customGlobalNodesService: CustomGlobalNodesServiceImpl,
  customNodeProcessingService: CustomNodeProcessingServiceImpl,
  errorComponentConfig,
  nodeContextProcessingService: NodeContextProcessingServiceImpl,
  luigiExtendedGlobalContextConfigService:
    LuigiExtendedGlobalContextConfigServiceImpl,
  headerBarConfigService: HeaderBarConfigServiceImpl,
  userProfileConfigService: UserProfileConfigServiceImpl,
  routingConfigService: CustomRoutingConfigServiceImpl,
  navigationRedirectStrategy: NavigationRedirectStrategyServiceImpl,
};

bootstrapApplication(PortalComponent, {
  providers: [providePortal(portalOptions), provideZonelessChangeDetection()],
}).catch((err) => console.error(err));
