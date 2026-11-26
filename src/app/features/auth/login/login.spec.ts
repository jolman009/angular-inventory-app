import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';

import { Supabase } from '../../../core/supabase';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows an email message, not a password message, for an invalid email', () => {
    const email = component.form.controls.email;
    email.setValue('not-an-email');
    email.markAsTouched();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#email-error')?.textContent).toContain('Enter a valid email address.');
    expect(el.querySelector('#email')?.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#email')?.getAttribute('aria-describedby')).toBe('email-error');
  });

  it('sends a reset link to the typed email, pointing at /reset-password', async () => {
    const auth = TestBed.inject(Supabase).client.auth;
    const spy = vi.spyOn(auth, 'resetPasswordForEmail').mockResolvedValue({ data: {}, error: null });
    component.form.controls.email.setValue('collector@example.com');

    await component.sendResetLink();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith('collector@example.com', {
      redirectTo: `${location.origin}/reset-password`,
    });
    const status = (fixture.nativeElement as HTMLElement).querySelector('[role=status]');
    expect(status?.textContent).toContain('a reset link is on its way');
  });

  it('asks for an email before sending a reset link', async () => {
    const auth = TestBed.inject(Supabase).client.auth;
    const spy = vi.spyOn(auth, 'resetPasswordForEmail');

    await component.sendResetLink();
    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('#email-error')?.textContent).toContain(
      'Email is required.',
    );
  });

  it('hides "Forgot password?" while creating an account', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.forgot')).not.toBeNull();
    component.toggleMode();
    fixture.detectChanges();
    expect(el.querySelector('.forgot')).toBeNull();
  });
});
