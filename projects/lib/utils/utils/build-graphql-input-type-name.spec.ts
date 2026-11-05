import { buildGraphQLInputTypeName } from './build-graphql-input-type-name';

describe('buildGraphQLInputTypeName', () => {
  // Query type names as the gateway generates them with flect.Pascalize
  // (gobuffalo/flect v1.0.3) for the API group in the comment.
  it.each([
    ['V1Query', 'ConfigMap', 'V1ConfigMap_Input'], // core
    ['V1Query', 'Pod', 'V1Pod_Input'],
    ['V1Query', 'Secret', 'V1Secret_Input'],
    ['V1Query', 'Service', 'V1Service_Input'],
    ['V1Query', 'Namespace', 'V1Namespace_Input'],
    ['AppsV1Query', 'Deployment', 'AppsV1Deployment_Input'], // apps
    ['AppsV1Query', 'StatefulSet', 'AppsV1StatefulSet_Input'],
    ['AppsV1Query', 'DaemonSet', 'AppsV1DaemonSet_Input'],
    ['AppsV1Query', 'ReplicaSet', 'AppsV1ReplicaSet_Input'],
    ['NetworkingK8sIoV1Query', 'Ingress', 'NetworkingK8sIoV1Ingress_Input'], // networking.k8s.io
    [
      'NetworkingK8sIoV1Query',
      'NetworkPolicy',
      'NetworkingK8sIoV1NetworkPolicy_Input',
    ],
    ['BatchV1Query', 'Job', 'BatchV1Job_Input'], // batch
    ['BatchV1Query', 'CronJob', 'BatchV1CronJob_Input'],
    [
      'AutoscalingV1Query', // autoscaling
      'HorizontalPodAutoscaler',
      'AutoscalingV1HorizontalPodAutoscaler_Input',
    ],
    ['CustomIoV1Query', 'Component', 'CustomIoV1Component_Input'], // custom.io
    [
      'MyCustomExampleIoV1beta1Query', // my-custom.example.io
      'Widget',
      'MyCustomExampleIoV1beta1Widget_Input',
    ],
    ['3scaleNetV1Query', 'APIProduct', '3scaleNetV1APIProduct_Input'], // 3scale.net
    [
      'CorePlatformMeshIoV1alpha1Query', // core.platform-mesh.io
      'AccountInfo',
      'CorePlatformMeshIoV1alpha1AccountInfo_Input',
    ],
    [
      'CoreKcpIoV1alpha1Query', // core.kcp.io
      'LogicalCluster',
      'CoreKcpIoV1alpha1LogicalCluster_Input',
    ],
  ])('should turn %s and %s into %s', (queryTypeName, entity, expected) => {
    expect(buildGraphQLInputTypeName(queryTypeName, entity)).toBe(expected);
  });

  describe('acronyms', () => {
    it('should keep the acronyms the gateway writes in upper case', () => {
      // network.api.foo.bar
      expect(
        buildGraphQLInputTypeName('NetworkAPIFooBarV1alpha1Query', 'DNSZone'),
      ).toBe('NetworkAPIFooBarV1alpha1DNSZone_Input');
      expect(
        buildGraphQLInputTypeName('NetworkAPIFooBarV1alpha1Query', 'VPC'),
      ).toBe('NetworkAPIFooBarV1alpha1VPC_Input');
    });

    it('should keep an acronym at the start of the group', () => {
      // dns.gardener.cloud
      expect(
        buildGraphQLInputTypeName(
          'DNSGardenerCloudV1alpha1Query',
          'DNSAnnotation',
        ),
      ).toBe('DNSGardenerCloudV1alpha1DNSAnnotation_Input');
    });

    it('should keep acronyms in groups with several of them', () => {
      // ui.id.http.example.io
      expect(
        buildGraphQLInputTypeName('UiIDHTTPExampleIoV1Query', 'Widget'),
      ).toBe('UiIDHTTPExampleIoV1Widget_Input');
    });
  });

  describe('edge cases', () => {
    it('should handle a version without group', () => {
      expect(buildGraphQLInputTypeName('V1alpha1Query', 'TestKind')).toBe(
        'V1alpha1TestKind_Input',
      );
    });

    it('should handle a group without version', () => {
      expect(buildGraphQLInputTypeName('AppsQuery', 'Deployment')).toBe(
        'AppsDeployment_Input',
      );
    });

    it('should handle the root query type', () => {
      expect(buildGraphQLInputTypeName('Query', 'TestKind')).toBe(
        'TestKind_Input',
      );
    });

    it('should only strip the trailing Query', () => {
      expect(buildGraphQLInputTypeName('QueryIoV1Query', 'Query')).toBe(
        'QueryIoV1Query_Input',
      );
    });

    it('should throw for a type name without the Query suffix', () => {
      expect(() =>
        buildGraphQLInputTypeName('AppsV1Mutation', 'Deployment'),
      ).toThrow('Unexpected GraphQL query type name: AppsV1Mutation');
    });

    it('should throw for a missing type name', () => {
      expect(() => buildGraphQLInputTypeName(undefined, 'Deployment')).toThrow(
        'Unexpected GraphQL query type name: undefined',
      );
    });
  });
});
