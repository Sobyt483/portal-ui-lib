import { ErrorConfig } from './models/error.model';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  resource,
} from '@angular/core';
import { IllustratedMessage } from '@fundamental-ngx/ui5-webcomponents-fiori/illustrated-message';
import { Button } from '@fundamental-ngx/ui5-webcomponents/button';
import { Title } from '@fundamental-ngx/ui5-webcomponents/title';
import { I18nService } from '@openmfp/portal-ui-lib';
import '@ui5/webcomponents-fiori/dist/illustrations/NoEntries.js';
import '@ui5/webcomponents-fiori/dist/illustrations/UnableToLoad.js';
import '@ui5/webcomponents-fiori/dist/illustrations/tnt/NoApplications.js';
import '@ui5/webcomponents-fiori/dist/illustrations/tnt/UnsuccessfulAuth.js';

@Component({
  selector: 'pm-error-state',
  standalone: true,
  templateUrl: './error-state.component.html',
  styles: `
    .error-state-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IllustratedMessage, Title, Button],
})
export class ErrorState {
  private i18nService = inject(I18nService);

  code = input.required<number>();
  subtitle = input<string | undefined>();
  retryable = input(true);
  retryDisabled = input(false);
  retry = output<void>();

  protected isSessionExpired = computed(() => this.code() === 401);

  protected texts = resource({
    loader: async () => ({
      contentNotFoundTitle: await this.i18nService.getTranslationAsync(
        'ERROR_CONTENT_NOT_FOUND_TITLE',
      ),
      contentNotFoundText: await this.i18nService.getTranslationAsync(
        'ERROR_CONTENT_NOT_FOUND_TEXT',
      ),
      sessionExpiredTitle:
        await this.i18nService.getTranslationAsync('SESSION_EXPIRED'),
      sessionExpiredText:
        await this.i18nService.getTranslationAsync('SIGN_IN_HINT'),
    }),
  });

  protected config = computed<ErrorConfig>(() => {
    switch (this.code()) {
      case 401:
        return {
          scene: 'tnt/UnsuccessfulAuth',
          illustratedMessageTitle:
            this.texts.value()?.sessionExpiredTitle ?? '',
          illustratedMessageText: this.texts.value()?.sessionExpiredText ?? '',
        };
      case 403:
        return {
          scene: 'tnt/UnsuccessfulAuth',
          illustratedMessageTitle:
            'You are not authorized to access this content.',
          illustratedMessageText: this.retryable()
            ? 'If access was just granted, try again.'
            : '',
        };
      case 404:
        return {
          scene: 'NoEntries',
          illustratedMessageTitle:
            this.texts.value()?.contentNotFoundTitle ?? '',
          illustratedMessageText: this.retryable()
            ? 'If it was just created, try again. Otherwise, check if the URL is correct.'
            : (this.texts.value()?.contentNotFoundText ?? ''),
        };
      case 422:
        return {
          scene: 'tnt/NoApplications',
          illustratedMessageTitle: 'The resource is pending deletion.',
          illustratedMessageText: '',
        };
      case 503:
        return {
          scene: 'UnableToLoad',
          illustratedMessageTitle: 'Organization is not ready yet',
          illustratedMessageText: 'Please try again later.',
        };
      default:
        return {
          scene: 'UnableToLoad',
          illustratedMessageTitle: 'Could not load resource',
          illustratedMessageText: 'Please try again.',
        };
    }
  });

  protected signIn(): void {
    window.location.reload();
  }
}
