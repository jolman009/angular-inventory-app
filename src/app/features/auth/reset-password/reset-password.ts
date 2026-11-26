import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BRAND } from '../../../core/brand';
import { Supabase } from '../../../core/supabase';
import { MIN_PASSWORD } from '../../../core/password-rules';

const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true };

/**
 * Where the "reset your password" email link lands.
 *
 * Supabase puts a one-time token in the link. The Supabase client reads it on page load,
 * signs the visitor in for this purpose, and fires a PASSWORD_RECOVERY event. From then on
 * we can set a new password with auth.updateUser().
 */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: '../login/login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  private fb = inject(FormBuilder);
  private supabase = inject(Supabase);
  private document = inject(DOCUMENT);
  protected readonly brand = BRAND;
  protected readonly minPassword = MIN_PASSWORD;

  /** checking: reading the link. ready: show the form. invalid: link expired or missing. done: saved. */
  readonly state = signal<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  readonly showPassword = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD)]],
      confirm: [''],
    },
    { validators: [passwordsMatch] },
  );

  constructor() {
    const auth = this.supabase.client.auth;

    // The event can fire after we arrive...
    const { data } = auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY' && this.state() === 'checking') this.state.set('ready');
    });
    inject(DestroyRef).onDestroy(() => data.subscription.unsubscribe());

    // ...or before (the client reads the link as soon as the app starts). getSession()
    // waits for that to finish, so a session here means the link worked.
    auth.getSession().then(({ data: { session } }) => {
      if (this.state() !== 'checking') return;
      this.state.set(session || this.linkHasToken() ? 'ready' : 'invalid');
    });
  }

  /** True while the link's token is still in the address bar and being processed. */
  private linkHasToken(): boolean {
    const hash = this.document.location?.hash ?? '';
    return hash.includes('access_token=') && !hash.includes('error=');
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    const { error } = await this.supabase.client.auth.updateUser({
      password: this.form.getRawValue().password,
    });

    this.saving.set(false);
    if (error) {
      this.error.set(
        error.message.toLowerCase().includes('session')
          ? 'This reset link has expired. Request a new one from the sign-in page.'
          : error.message,
      );
    } else {
      this.state.set('done');
    }
  }
}
