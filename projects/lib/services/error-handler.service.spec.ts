import { ErrorHandlerService } from './error-handler.service';
import { TestBed } from '@angular/core/testing';
import { LuigiCoreService } from '@openmfp/portal-ui-lib';
import { MockedObject } from 'vitest';
import { mock } from 'vitest-mock-extended';

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;
  let luigiCoreService: MockedObject<LuigiCoreService>;
  let postMessageSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    luigiCoreService = mock<LuigiCoreService>();
    luigiCoreService.showAlert = vi.fn();
    postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    TestBed.configureTestingModule({
      providers: [
        ErrorHandlerService,
        { provide: LuigiCoreService, useValue: luigiCoreService },
      ],
    });

    service = TestBed.inject(ErrorHandlerService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleError', () => {
    it('alerts the message followed by the error detail', () => {
      service.handleError(
        { message: 'namespaces is forbidden' },
        'Failed to read namespaces.',
      );

      expect(luigiCoreService.showAlert).toHaveBeenCalledExactlyOnceWith({
        text: 'Failed to read namespaces.\nnamespaces is forbidden',
        type: 'error',
      });
    });

    it('alerts only the error detail without a message', () => {
      service.handleError({ message: 'Validation failed' });

      expect(luigiCoreService.showAlert).toHaveBeenCalledWith({
        text: 'Validation failed',
        type: 'error',
      });
    });

    it('alerts only the message when the error has no detail', () => {
      service.handleError({}, 'Could not delete resource.');

      expect(luigiCoreService.showAlert).toHaveBeenCalledWith({
        text: 'Could not delete resource.',
        type: 'error',
      });
    });

    it('joins the messages of an errors array', () => {
      service.handleError({ errors: [{ message: 'A' }, { message: 'B' }] });

      expect(luigiCoreService.showAlert).toHaveBeenCalledWith({
        text: 'A\nB',
        type: 'error',
      });
    });

    it.each([
      ['an empty message', { message: '' }],
      ['an undefined message', { message: undefined }],
      ['a null message', { message: null }],
      ['an undefined error', undefined],
    ])('alerts the default text for %s', (_description, error) => {
      service.handleError(error);

      expect(luigiCoreService.showAlert).toHaveBeenCalledWith({
        text: 'An unknown error occurred',
        type: 'error',
      });
    });

    it('logs the error', () => {
      const error = { message: 'Boom' };

      service.handleError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    it.each([
      ['a forbidden message', { message: 'Access is forbidden' }],
      ['an access denied message', { message: 'Access Denied' }],
      ['status code 404', { statusCode: 404, message: 'Not found' }],
    ])('stays on the page and only alerts for %s', (_description, error) => {
      service.handleError(error);

      expect(luigiCoreService.showAlert).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).not.toHaveBeenCalled();
    });
  });

  describe('errorCode', () => {
    it.each([
      ['forbidden', 'Access is forbidden'],
      ['Forbidden', 'Forbidden'],
      ['FORBIDDEN', 'ACCESS FORBIDDEN'],
      ['access denied', 'access denied'],
      ['Access Denied', 'Access Denied for the user'],
    ])('returns 403 for a message containing %s', (_word, message) => {
      expect(service.errorCode({ message })).toBe(403);
    });

    it('prefers 403 over the status code when the message says forbidden', () => {
      expect(service.errorCode({ statusCode: 404, message: 'forbidden' })).toBe(
        403,
      );
    });

    it.each([
      ['statusCode', { statusCode: 404 }, 404],
      ['status', { status: 401 }, 401],
      ['networkError.statusCode', { networkError: { statusCode: 403 } }, 403],
      ['networkError.status', { networkError: { status: 500 } }, 500],
      ['response.status', { response: { status: 401 } }, 401],
    ])('returns the HTTP status from %s', (_field, error, code) => {
      expect(service.errorCode(error)).toBe(code);
    });

    it.each([
      ['an undefined error', undefined],
      ['an error without a status', { message: 'Boom' }],
      ['a message only saying not found', { message: 'x not found' }],
      ['a status of 0 from a failed request', { status: 0 }],
    ])('returns 500 for %s', (_description, error) => {
      expect(service.errorCode(error)).toBe(500);
    });
  });
});
