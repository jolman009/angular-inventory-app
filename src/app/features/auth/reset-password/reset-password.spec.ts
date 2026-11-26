import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { Supabase } from '../../../core/supabase';
import { ResetPassword } from './reset-password';

describe('ResetPassword', () => {
  type Listener = (event: AuthChangeEvent, session: Session | null) => void;
  let listener: Listener | undefined;
  let session: Session | null;

  async function setup() {
    TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [provideRouter([])],
    });
    const auth = TestBed.inject(Supabase).client.auth;
    vi.spyOn(auth, 'getSession').mockImplementation(async () => ({
      data: { session },
      error: null,
    }) as Awaited<ReturnType<typeof auth.getSession>>);
    vi.spyOn(auth, 'onAuthStateChange').mockImplementation(cb => {
      listener = cb as Listener;
      return { data: { subscription: { id: 'x', callback: cb, unsubscribe: () => undefined } } } as ReturnType<
        typeof auth.onAuthStateChange
      >;
    });
    const fixture = TestBed.createComponent(ResetPassword);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, auth, component: fixture.componentInstance };
  }

  beforeEach(() => {
    listener = undefined;
    session = null;
  });

  it('says the link is invalid when there is no recovery session', async () => {
    const { fixture } = await setup();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('invalid or has expired');
  });

  it('shows the form once Supabase reports PASSWORD_RECOVERY', async () => {
    session = null;
    const { fixture, component } = await setup();
    component.state.set('checking');
    listener?.('PASSWORD_RECOVERY', {} as Session);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('#new-password')).not.toBeNull();
  });

  it('rejects short or mismatched passwords without calling Supabase', async () => {
    session = {} as Session;
    const { fixture, auth, component } = await setup();
    const spy = vi.spyOn(auth, 'updateUser');

    component.form.setValue({ password: 'short', confirm: 'short' });
    await component.submit();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#new-password-error')?.textContent).toContain('at least 10');

    component.form.setValue({ password: 'long-enough-pw', confirm: 'different-pw!' });
    await component.submit();
    fixture.detectChanges();
    expect(el.querySelector('#confirm-password-error')?.textContent).toContain("don't match");
    expect(spy).not.toHaveBeenCalled();
  });

  it('saves the new password and confirms', async () => {
    session = {} as Session;
    const { fixture, auth, component } = await setup();
    const spy = vi
      .spyOn(auth, 'updateUser')
      .mockResolvedValue({ data: { user: null }, error: null } as unknown as Awaited<
        ReturnType<typeof auth.updateUser>
      >);

    component.form.setValue({ password: 'long-enough-pw', confirm: 'long-enough-pw' });
    await component.submit();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith({ password: 'long-enough-pw' });
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=status]')?.textContent).toContain(
      'Your password has been updated.',
    );
  });
});
