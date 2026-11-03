import { Injectable, inject } from '@angular/core';
import { LuigiCoreService } from '@openmfp/portal-ui-lib';

@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  private luigiCoreService = inject(LuigiCoreService);

  handleError(error: any, msg?: string) {
    const message =
      error?.message || error?.errors?.map((e: any) => e.message).join('\n');
    this.luigiCoreService.showAlert({
      text:
        [msg, message].filter(Boolean).join('\n') ||
        'An unknown error occurred',
      type: 'error',
    });
    console.error(error);
  }

  errorCode(error: any): number {
    if (this.isUnauthorizedAccess(error)) {
      return 403;
    }

    return (
      [
        error?.statusCode,
        error?.status,
        error?.networkError?.statusCode,
        error?.networkError?.status,
        error?.response?.status,
      ].find(Boolean) ?? 500
    );
  }

  private isUnauthorizedAccess(error: any): boolean {
    return (
      !!error?.message?.toLowerCase().includes('forbidden') ||
      !!error?.message?.toLowerCase()?.includes('access denied')
    );
  }
}
