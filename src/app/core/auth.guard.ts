/** Sends signed-out visitors to the login page, remembering where they meant to go. */

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  const user = await auth.load();
  if (user) return true;

  return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};
