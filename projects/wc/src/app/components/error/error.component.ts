import { ErrorState } from './error-state.component';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import { LuigiCoreService } from '@openmfp/portal-ui-lib';

@Component({
  selector: 'pm-error',
  standalone: true,
  templateUrl: './error.component.html',
  encapsulation: ViewEncapsulation.ShadowDom,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorState],
})
export class ErrorView {
  private luigiCoreService = inject(LuigiCoreService);

  public context = input.required<any>();

  protected entityErrorCode = computed<number | undefined>(
    () => this.context().entityErrorCode,
  );
  protected code = computed(
    () => +(this.entityErrorCode() ?? this.context().id),
  );

  retry(): void {
    this.luigiCoreService.configChanged();
  }
}
