import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Supabase } from '../../../core/supabase';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb = inject(FormBuilder);
  private supabase = inject(Supabase);
  private router = inject(Router);

  readonly mode = signal<'signin' | 'signup'>('signin');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  toggleMode() {
    this.mode.update(m => (m === 'signin' ? 'signup' : 'signin'));
    this.error.set(null);
    this.message.set(null);
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
      else await this.router.navigateByUrl('/');
    } else {
      const { data, error } = await auth.signUp({ email, password });
      if (error) this.error.set(error.message);
      else if (data.session) await this.router.navigateByUrl('/');
      else this.message.set('Check your email to confirm your account, then sign in.');
    }

    this.loading.set(false);
  }
}
