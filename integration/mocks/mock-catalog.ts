export const restMocks = {
  envConfigForTestOrgWithoutAuth: 'rest/envconfig.test-org-without-auth.json',
  portalConfigWithHomeAndAccounts:
    'rest/config.main-entity-with-home-and-accounts.json',
  accountEntityConfigWithDashboard:
    'rest/config.account-entity-with-dashboard.json',
  accountEntityConfigWithDashboardAndHttpBins:
    'rest/config.account-entity-with-dashboard-and-httpbins.json',
  accountEntityConfigWithReadonlyNamespace:
    'rest/config.account-entity-with-dashboard-and-httpbins-readonly-namespace.json',
  accountEntityConfigWithDashboardAndSearch:
    'rest/config.account-entity-with-dashboard-and-search.json',
} as const;

export const searchMocks = {
  httpBinsWithTwelveSearchResults: 'search/httpbins.twelve-search-results.json',
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
  logicalClusterReadReady: 'gateway/logical-cluster-read.ready.json',
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
  http403Forbidden: 'gateway/errors/http-403-forbidden.json',
  http404NotFound: 'gateway/errors/http-404-not-found.json',
  http500InternalServerError:
    'gateway/errors/http-500-internal-server-error.json',
  graphqlErrorServiceUnavailable:
    'gateway/errors/graphql-error-service-unavailable.json',
} as const;
