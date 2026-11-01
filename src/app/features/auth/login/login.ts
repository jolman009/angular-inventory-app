import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BRAND } from '../../../core/brand';
import { Supabase } from '../../../core/supabase';

// Keep this in sync with the minimum length set in Supabase (Authentication settings)
const MIN_PASSWORD = 10;

/** Group-level check: the two password boxes must match (only while confirm is enabled). */
const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const confirm = group.get('confirm');
  if (!confirm || confirm.disabled) return null;
  return group.get('password')?.value === confirm.value ? null : { mismatch: true };
};

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb = inject(FormBuilder);
  private supabase = inject(Supabase);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected readonly brand = BRAND;

  protected readonly minPassword = MIN_PASSWORD;

  readonly mode = signal<'signin' | 'signup'>('signin');
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  form = this.fb.nonNullable.group(
        {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      // starts disabled: a disabled control is ignored by validation
      confirm: [{ value: '', disabled: true }],
    },
    { validators: [passwordsMatch] },
  );

  constructor() {
    if (this.route.snapshot.queryParamMap.get('mode') === 'signup') {
      this.toggleMode();
    }
  }

  toggleMode() {
    const next = this.mode() === 'signin' ? 'signup' : 'signin';
    this.mode.set(next);
    this.error.set(null);
    this.message.set(null);
    this.showPassword.set(false);

    const { password, confirm } = this.form.controls;
    confirm.reset('');

    if (next === 'signup') {
      password.setValidators([Validators.required, Validators.minLength(MIN_PASSWORD)]);
      confirm.enable();
    } else {
      password.setValidators([Validators.required]);
      confirm.disable();
    }

    password.updateValueAndValidity();
    this.form.markAsUntouched();
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);

    const { email, password } = this.form.getRawValue();
    const auth = this.supabase.client.auth;

    if (this.mode() === 'signin') {
      const { error } = await auth.signInWithPassword({ email, password });
      if (error) this.error.set(error.message);
      else await this.router.navigateByUrl('/collection');
    } else {
      const { data, error } = await auth.signUp({ email, password });
      if (error) this.error.set(error.message);
      else if (data.session) await this.router.navigateByUrl('/collection');
      else this.message.set('Check your email to confirm your account, then sign in.');
    }

    this.loading.set(false);
  }
}
