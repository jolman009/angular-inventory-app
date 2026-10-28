import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from './supabase';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  return data.session ? true : router.createUrlTree(['/login']);
};
