export const restMocks = {
  envConfigForTestOrgWithoutAuth: 'rest/envconfig.test-org-without-auth.json',
  portalConfigWithHomeAndAccounts:
    'rest/config.main-entity-with-home-and-accounts.json',
  accountEntityConfigWithDashboard:
    'rest/config.account-entity-with-dashboard.json',
  accountEntityConfigWithDashboardAndHttpBins:
    'rest/config.account-entity-with-dashboard-and-httpbins.json',
  accountEntityConfigWithFullPageAndIframeNodes:
    'rest/config.account-entity-with-full-page-and-iframe-nodes.json',
  accountEntityConfigWithSearchList:
    'rest/config.account-entity-with-search-list.json',
  accountEntityConfigWithSearchListWithoutListPermission:
    'rest/config.account-entity-with-search-list-without-list-permission.json',
  accountEntityConfigWithoutNodes:
    'rest/config.account-entity-without-nodes.json',
} as const;

export const searchMocks = {
  resultsWithTwoWidgets: 'search/results.two-widgets.json',
} as const;

export const searchErrorMocks = {
  http400InvalidQuery: 'search/errors/http-400-invalid-query.json',
  http401Unauthorized: 'search/errors/http-401-unauthorized.json',
  http403Forbidden: 'search/errors/http-403-forbidden.json',
  http404NotFound: 'search/errors/http-404-not-found.json',
  http500InternalServerError:
    'search/errors/http-500-internal-server-error.json',
} as const;

export const restErrorMocks = {
  http403Forbidden: 'rest/errors/http-403-forbidden.json',
  http500InternalServerError: 'rest/errors/http-500-internal-server-error.json',
} as const;

export const gatewayMocks = {
  accountsListWithFourReadyAccounts:
    'gateway/accounts-list.four-ready-accounts.json',
  accountsWatchClosingWithoutChanges:
    'gateway/accounts-watch.closes-without-changes.json',
  accountInfoReadSucceeds: 'gateway/account-info-read.succeeds.json',
  accountInfoReadForbiddenGraphqlError:
    'gateway/account-info-read.forbidden-graphql-error.json',
  accountReadSucceeds: 'gateway/account-read.succeeds.json',
  accountReadForbiddenGraphqlError:
    'gateway/account-read.forbidden-graphql-error.json',
  accountReadPendingDeletion: 'gateway/account-read.pending-deletion.json',
  logicalClusterReadReady: 'gateway/logical-cluster-read.ready.json',
  logicalClusterReadInitializing:
    'gateway/logical-cluster-read.initializing.json',
  httpBinsListWithTwoReadyHttpBins:
    'gateway/httpbins-list.two-ready-httpbins.json',
  httpBinsWatchClosingWithoutChanges:
    'gateway/httpbins-watch.closes-without-changes.json',
  httpBinReadForHttpBinBetaInTeamB:
    'gateway/httpbin-read.httpbin-beta-in-team-b.json',
  httpBinReadMissingNamespaceArgument:
    'gateway/httpbin-read.missing-namespace-argument.json',
  namespacesListWithTeamAAndTeamB:
    'gateway/namespaces-list.team-a-and-team-b.json',
  namespacesWatchClosingWithoutChanges:
    'gateway/namespaces-watch.closes-without-changes.json',
} as const;

export const gatewayErrorMocks = {
  http401Unauthorized: 'gateway/errors/http-401-unauthorized.json',
  http403Forbidden: 'gateway/errors/http-403-forbidden.json',
  http404NotFound: 'gateway/errors/http-404-not-found.json',
  http500InternalServerError:
    'gateway/errors/http-500-internal-server-error.json',
  graphqlErrorForbidden: 'gateway/errors/graphql-error-forbidden.json',
  graphqlErrorServiceUnavailable:
    'gateway/errors/graphql-error-service-unavailable.json',
} as const;
