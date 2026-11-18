export interface KubeConfigTemplateProps {
  clusterName: string;
  serverUrl: string;
  kcpCA: string;
  oidcIssuerUrl: string;
  oidcKubectlClientId: string;
  /** Scopes to request besides openid; `email` when empty. */
  oidcScopes?: string[];
  /** PEM bundle to verify the issuer with; the system trust store when empty. */
  oidcCA?: string;
}

const defaultOidcScopes = ['email'];

const oidcLoginArgs = (kubeconfigProps: KubeConfigTemplateProps): string[] => {
  const scopes = kubeconfigProps.oidcScopes?.length
    ? kubeconfigProps.oidcScopes
    : defaultOidcScopes;

  return [
    `--oidc-issuer-url=${kubeconfigProps.oidcIssuerUrl}`,
    `--oidc-client-id=${kubeconfigProps.oidcKubectlClientId}`,
    ...scopes.map((scope) => `--oidc-extra-scope=${scope}`),
    ...(kubeconfigProps.oidcCA
      ? [`--certificate-authority-data=${btoa(kubeconfigProps.oidcCA)}`]
      : []),
  ];
};

export const kubeConfigTemplate = (
  kubeconfigProps: KubeConfigTemplateProps,
) => `
    apiVersion: v1
    kind: Config
    clusters:
    - name: ${kubeconfigProps.clusterName}
      cluster:
        certificate-authority-data: ${kubeconfigProps.kcpCA}
        server: ${kubeconfigProps.serverUrl}
    contexts:
    - name: ${kubeconfigProps.clusterName}
      context:
        cluster: ${kubeconfigProps.clusterName}
        user: ${kubeconfigProps.clusterName}
    current-context: ${kubeconfigProps.clusterName}
    users:
    - name: ${kubeconfigProps.clusterName}
      user:
        exec:
          apiVersion: client.authentication.k8s.io/v1beta1
          args:
          - oidc-login
          - get-token
${oidcLoginArgs(kubeconfigProps)
  .map((arg) => `          - ${arg}`)
  .join('\n')}
          command: kubectl
          env: null
          interactiveMode: IfAvailable
`;
