import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { tap } from 'rxjs';
import { Auth } from './auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const t = auth.token();
  const r = t ? req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : req;
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
