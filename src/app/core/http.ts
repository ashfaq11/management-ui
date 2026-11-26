import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { tap } from 'rxjs';
import { Auth } from './auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const t = auth.token();
  const headers: Record<string, string> = {};
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const pick = auth.pick();
  if (pick) headers['X-Spa-Id'] = String(pick.id);
  const r = Object.keys(headers).length ? req.clone({ setHeaders: headers }) : req;
  return next(r).pipe(tap({
    error: (e) => {
      if (e.status === 401 && !req.url.endsWith('/auth/login')) { auth.clear(); router.navigateByUrl('/login'); }
    },
  }));
};

// inject() only works synchronously, so resolve dependencies before the first await.
export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return (await auth.restore()) || router.parseUrl('/login');
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return ((await auth.restore()) && auth.isAdmin()) || router.parseUrl('/appointments');
};

/** Spa pages need a spa: a superadmin who has not opened one goes to the Spas page. */
export const spaGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!(await auth.restore())) return router.parseUrl('/login');
  return auth.hasSpa() || router.parseUrl('/spas');
};

export const superGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return ((await auth.restore()) && auth.isSuper()) || router.parseUrl('/appointments');
};
