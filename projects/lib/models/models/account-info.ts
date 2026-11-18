import { ObjectMeta } from 'kubernetes-types/meta/v1';

export interface AccountInfo {
  metadata: ObjectMeta;
  spec: {
    account: {
      originClusterId: string;
    };
    clusterInfo: { ca: string };
    organization: { originClusterId: string; name: string };
    /** Absent until an identity provider is set up for the organization. */
    oidc?: {
      issuerUrl: string;
      clients: {
        kubectl?: {
          clientId: string;
        };
      };
      /** Scopes to request besides openid; empty leaves the choice to the client. */
      scopes?: string[] | null;
      /** PEM bundle to verify the issuer with; empty for a publicly trusted certificate. */
      ca?: string | null;
    };
  };
}
