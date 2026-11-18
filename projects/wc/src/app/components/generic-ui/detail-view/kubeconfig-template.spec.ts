import {
  KubeConfigTemplateProps,
  kubeConfigTemplate,
} from './kubeconfig-template';

describe('kubeConfigTemplate', () => {
  const props: KubeConfigTemplateProps = {
    clusterName: 'acme',
    serverUrl: 'https://kcp.example.com/clusters/root:orgs:acme',
    kcpCA: 'a2NwLWNh',
    oidcIssuerUrl: 'https://issuer.example.com',
    oidcKubectlClientId: 'kubectl',
  };

  const args = (kubeconfig: string): string[] => {
    const lines = kubeconfig.split('\n');
    const start = lines.findIndex((line) => line.trim() === 'args:');
    const end = lines.findIndex((line) => line.trim() === 'command: kubectl');
    return lines.slice(start + 1, end);
  };

  it('requests the email scope and trusts the system store by default', () => {
    expect(args(kubeConfigTemplate(props))).toEqual([
      '          - oidc-login',
      '          - get-token',
      '          - --oidc-issuer-url=https://issuer.example.com',
      '          - --oidc-client-id=kubectl',
      '          - --oidc-extra-scope=email',
    ]);
  });

  it('falls back to the email scope for an empty scope list', () => {
    expect(args(kubeConfigTemplate({ ...props, oidcScopes: [] }))).toContain(
      '          - --oidc-extra-scope=email',
    );
  });

  it('requests the scopes of the issuer, one argument each', () => {
    const result = args(
      kubeConfigTemplate({ ...props, oidcScopes: ['email', 'groups'] }),
    );

    expect(result).toEqual([
      '          - oidc-login',
      '          - get-token',
      '          - --oidc-issuer-url=https://issuer.example.com',
      '          - --oidc-client-id=kubectl',
      '          - --oidc-extra-scope=email',
      '          - --oidc-extra-scope=groups',
    ]);
  });

  it('passes the CA of the issuer base64 encoded', () => {
    const ca = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';

    const result = args(kubeConfigTemplate({ ...props, oidcCA: ca }));

    expect(result).toContain(
      `          - --certificate-authority-data=${btoa(ca)}`,
    );
  });

  it('keeps the cluster and the exec plugin around the arguments', () => {
    const kubeconfig = kubeConfigTemplate(props);

    expect(kubeconfig).toContain('certificate-authority-data: a2NwLWNh');
    expect(kubeconfig).toContain(
      'server: https://kcp.example.com/clusters/root:orgs:acme',
    );
    expect(kubeconfig).toContain(
      '          command: kubectl\n          env: null\n          interactiveMode: IfAvailable\n',
    );
  });
});
