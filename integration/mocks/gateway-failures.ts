import type { ErrorCode } from '../pages/error.page.ts';
import { gatewayErrorMocks } from './mock-catalog.ts';

export interface GatewayFailure {
  description: string;
  mockFile: string;
  errorCode: ErrorCode;
}

export function gatewayFailures(
  forbiddenGraphqlErrorMockFile: string = gatewayErrorMocks.graphqlErrorForbidden,
): GatewayFailure[] {
  return [
    {
      description: 'HTTP 401 Unauthorized',
      mockFile: gatewayErrorMocks.http401Unauthorized,
      errorCode: 401,
    },
    {
      description: 'HTTP 403 Forbidden',
      mockFile: gatewayErrorMocks.http403Forbidden,
      errorCode: 403,
    },
    {
      description: 'a GraphQL "forbidden" error',
      mockFile: forbiddenGraphqlErrorMockFile,
      errorCode: 403,
    },
    {
      description: 'HTTP 404 Not Found',
      mockFile: gatewayErrorMocks.http404NotFound,
      errorCode: 404,
    },
    {
      description: 'HTTP 500 Internal Server Error',
      mockFile: gatewayErrorMocks.http500InternalServerError,
      errorCode: 500,
    },
    {
      description: 'any other GraphQL error',
      mockFile: gatewayErrorMocks.graphqlErrorServiceUnavailable,
      errorCode: 500,
    },
  ];
}
