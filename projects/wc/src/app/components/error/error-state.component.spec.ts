import { ErrorState } from './error-state.component';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { I18nService } from '@openmfp/portal-ui-lib';

@Component({
  imports: [ErrorState],
  template: `<pm-error-state
    [code]="code()"
    [subtitle]="subtitle()"
    [retryable]="retryable()"
    [retryDisabled]="retryDisabled()"
    (retry)="retries = retries + 1"
  >
    <span data-testid="projected-content"></span>
  </pm-error-state>`,
})
class ErrorStateHost {
  code = signal(500);
  subtitle = signal<string | undefined>(undefined);
  retryable = signal(true);
  retryDisabled = signal(false);
  retries = 0;
}

describe('ErrorState', () => {
  let fixture: ComponentFixture<ErrorStateHost>;

  const element = (testId: string) =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  const render = async (code: number) => {
    fixture.componentInstance.code.set(code);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorStateHost],
      providers: [
        {
          provide: I18nService,
          useValue: {
            getTranslationAsync: vi.fn((key: string) => Promise.resolve(key)),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorStateHost);
  });

  it.each([
    [401, 'tnt/UnsuccessfulAuth', 'SESSION_EXPIRED', 'SIGN_IN_HINT'],
    [
      403,
      'tnt/UnsuccessfulAuth',
      'You are not authorized to access this content.',
      'If access was just granted, try again.',
    ],
    [
      404,
      'NoEntries',
      'ERROR_CONTENT_NOT_FOUND_TITLE',
      'If it was just created, try again. Otherwise, check if the URL is correct.',
    ],
    [422, 'tnt/NoApplications', 'The resource is pending deletion.', ''],
    [
      503,
      'UnableToLoad',
      'Organization is not ready yet',
      'Please try again later.',
    ],
    [500, 'UnableToLoad', 'Could not load resource', 'Please try again.'],
    [418, 'UnableToLoad', 'Could not load resource', 'Please try again.'],
  ])(
    'shows the configured image and texts for %i',
    async (code, scene, title, text) => {
      await render(code);

      expect(element('error-view-illustration').name).toBe(scene);
      expect(element('error-view-title').textContent.trim()).toBe(title);
      expect(element('error-view-subtitle').textContent.trim()).toBe(text);
    },
  );

  it.each([
    [403, ''],
    [404, 'ERROR_CONTENT_NOT_FOUND_TEXT'],
  ])(
    'does not suggest trying again for %i when the view cannot retry',
    async (code, text) => {
      fixture.componentInstance.retryable.set(false);

      await render(code);

      expect(element('error-view-subtitle').textContent.trim()).toBe(text);
    },
  );

  it('prefers the given subtitle over the configured text', async () => {
    fixture.componentInstance.subtitle.set('Select a namespace and try again.');

    await render(500);

    expect(element('error-view-subtitle').textContent.trim()).toBe(
      'Select a namespace and try again.',
    );
  });

  it('updates when the code changes', async () => {
    await render(500);
    await render(403);

    expect(element('error-view-illustration').name).toBe(
      'tnt/UnsuccessfulAuth',
    );
  });

  it('renders the content of the view above the action', async () => {
    await render(500);

    const actions = element('error-view-retry').parentElement;

    expect(actions.firstElementChild.dataset.testid).toBe('projected-content');
  });

  describe('retry', () => {
    it('reports a click to the view', async () => {
      await render(500);

      element('error-view-retry').click();

      expect(fixture.componentInstance.retries).toBe(1);
    });

    it('is disabled when the view asks for it', async () => {
      fixture.componentInstance.retryDisabled.set(true);

      await render(500);

      expect(element('error-view-retry').disabled).toBe(true);
    });

    it('is absent when the view cannot retry', async () => {
      fixture.componentInstance.retryable.set(false);

      await render(500);

      expect(element('error-view-retry')).toBeNull();
      expect(element('error-view-sign-in')).toBeNull();
    });
  });

  describe('expired session', () => {
    it('offers to log in again instead of a retry', async () => {
      await render(401);

      expect(element('error-view-retry')).toBeNull();
      expect(element('error-view-sign-in').textContent.trim()).toBe('Login');
    });

    it('signs in again from a click on the login button', async () => {
      await render(401);
      const errorState = fixture.debugElement.query(By.directive(ErrorState))
        .componentInstance as ErrorState;
      const signIn = vi
        .spyOn(errorState as any, 'signIn')
        .mockImplementation(() => {});

      element('error-view-sign-in').click();

      expect(signIn).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.retries).toBe(0);
    });

    it('offers no login button when the view cannot retry', async () => {
      fixture.componentInstance.retryable.set(false);

      await render(401);

      expect(element('error-view-sign-in')).toBeNull();
    });
  });
});
