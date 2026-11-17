import { gql } from 'apollo-angular';

export const accountInfoRead = gql`
  {
    core_platform_mesh_io {
      v1alpha1 {
        AccountInfo(name: "account") {
          metadata {
            name
            annotations
          }
          spec {
            account {
              originClusterId
            }
            clusterInfo {
              ca
            }
            organization {
              originClusterId
              name
            }
            oidc {
              clients
              issuerUrl
              scopes
              ca
            }
          }
        }
      }
    }
  }
`;
