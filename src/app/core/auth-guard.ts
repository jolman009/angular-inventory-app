import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from './supabase';

/** Only signed-in visitors may enter; everyone else goes to the sign-in page. */
export const authGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  return data.session ? true : router.createUrlTree(['/login']);
};

/** For the landing and sign-in pages: signed-in visitors skip straight to their collection. */
export const guestGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  return data.session ? router.createUrlTree(['/collection']) : true;
};
