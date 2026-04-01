import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
  expiresAt: Date;
}

export interface AuthError {
  code: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  private apiUrl = '/api/auth';

  constructor(private http: HttpClient) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, request).pipe(
      tap((response) => {
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('expiresAt', response.expiresAt.toISOString());
      }),
      catchError((error) => {
        if (error.status === 401) {
          return throwError(() => ({
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password'
          } as AuthError));
        }
        if (error.status === 400) {
          return throwError(() => ({
            code: 'VALIDATION_ERROR',
            message: error.error?.message || 'Validation failed'
          } as AuthError));
        }
        return throwError(() => ({
          code: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred'
        } as AuthError));
      })
    );
  }

  logout(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('expiresAt');
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('authToken');
    const expiresAt = localStorage.getItem('expiresAt');

    if (!token || !expiresAt) return false;

    return new Date(expiresAt) > new Date();
  }
}
