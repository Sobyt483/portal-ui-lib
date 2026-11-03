import { ErrorView } from './error.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService, LuigiCoreService } from '@openmfp/portal-ui-lib';
import { MockedObject } from 'vitest';

describe('ErrorView', () => {
  let fixture: ComponentFixture<ErrorView>;
  let luigiCoreServiceMock: MockedObject<LuigiCoreService>;

  const element = (testId: string) =>
    fixture.nativeElement.shadowRoot.querySelector(`[data-testid="${testId}"]`);

  const render = async (context: object) => {
    fixture.componentRef.setInput('context', context);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    luigiCoreServiceMock = {
      configChanged: vi.fn(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [ErrorView],
      providers: [
        {
          provide: I18nService,
          useValue: {
            getTranslationAsync: vi.fn((key: string) => Promise.resolve(key)),
          },
        },
        { provide: LuigiCoreService, useValue: luigiCoreServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorView);
  });

  it('shows the error of the id path parameter on the global error node', async () => {
    await render({ id: '404' });

    expect(element('error-view-illustration').name).toBe('NoEntries');
  });

  it('offers no retry on the global error node', async () => {
    await render({ id: '404' });

    expect(element('error-view-retry')).toBeNull();
  });

  it('shows the error of a failed entity', async () => {
    await render({ entityErrorCode: 403 });

    expect(element('error-view-title').textContent).toContain(
      'You are not authorized to access this content.',
    );
  });

  it('prefers the error of a failed entity over the id of the node context', async () => {
    await render({ id: 'account-1', entityErrorCode: 403 });

    expect(element('error-view-illustration').name).toBe(
      'tnt/UnsuccessfulAuth',
    );
  });

  it('retries a failed entity by re-evaluating the navigation', async () => {
    await render({ entityErrorCode: 500 });

    element('error-view-retry').click();

    expect(luigiCoreServiceMock.configChanged).toHaveBeenCalledTimes(1);
  });
});
