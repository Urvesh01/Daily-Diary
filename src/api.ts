import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class Api {
  /** Same-origin in production (Vercel) and via proxy.conf.json in development. */
  base = '/api';
  token = localStorage.getItem('token') || '';
  /** Set by the app; called when the server answers 401 (expired/invalid token). */
  onUnauthorized: (() => void) | null = null;

  constructor(private h: HttpClient) {}

  auth(m: 'login' | 'register', b: any) {
    return this.h.post<any>(`${this.base}/${m}`, b);
  }
  list() {
    return this.h.get<any[]>(`${this.base}/entries`);
  }
  save(d: string, data: any, status: string) {
    return this.h.put<any>(`${this.base}/entries/${encodeURIComponent(d)}`, { data, status });
  }
  del(d: string) {
    return this.h.delete(`${this.base}/entries/${encodeURIComponent(d)}`);
  }
  restore(rows: any[]) {
    return this.h.post<any>(`${this.base}/restore`, { rows });
  }
}
