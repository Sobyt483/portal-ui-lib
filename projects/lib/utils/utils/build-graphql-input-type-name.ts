const QUERY_SUFFIX = 'Query';

/**
 * Builds the input type name of a mutation from the `__typename` of the query
 * type that holds the resource (e.g. `NetworkAPIFooBarV1alpha1Query`). The
 * gateway names the input type `<prefix><Kind>_Input` with the same prefix,
 * so the UI does not need its own copy of the gateway's naming rule.
 */
export function buildGraphQLInputTypeName(
  queryTypeName: string | undefined,
  entity: string,
): string {
  if (!queryTypeName?.endsWith(QUERY_SUFFIX)) {
    throw new Error(`Unexpected GraphQL query type name: ${queryTypeName}`);
  }

  const prefix = queryTypeName.slice(0, -QUERY_SUFFIX.length);
  return `${prefix}${entity}_Input`;
}
