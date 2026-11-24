import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';

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
});
