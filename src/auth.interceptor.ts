import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Api } from './api';

/** Adds the login token to every API call and logs out on 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(Api);
  const isAuthCall = /\/api\/(login|register)$/.test(req.url);
  const authed =
    api.token && !isAuthCall
      ? req.clone({ setHeaders: { Authorization: `Bearer ${api.token}` } })
      : req;
  return next(authed).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && !isAuthCall) api.onUnauthorized?.();
      return throwError(() => e);
    }),
  );
};
