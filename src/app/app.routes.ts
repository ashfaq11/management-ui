import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/http';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  {
    path: '', canActivate: [authGuard],
    loadComponent: () => import('./pages/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'appointments' },
      { path: 'appointments', loadComponent: () => import('./pages/appointments').then((m) => m.Appointments) },
      { path: 'onboarding', loadComponent: () => import('./pages/onboarding').then((m) => m.Onboarding) },
      { path: 'customers', loadComponent: () => import('./pages/customers').then((m) => m.Customers) },
      { path: 'account', loadComponent: () => import('./pages/account').then((m) => m.Account) },
      { path: 'users', canActivate: [adminGuard], loadComponent: () => import('./pages/users').then((m) => m.Users) },
      { path: 'staff', canActivate: [adminGuard], loadComponent: () => import('./pages/staff').then((m) => m.Staff) },
      { path: 'reports', canActivate: [adminGuard], loadComponent: () => import('./pages/reports').then((m) => m.Reports) },
      { path: 'payroll', canActivate: [adminGuard], loadComponent: () => import('./pages/payroll').then((m) => m.Payroll) },
    ],
  },
  { path: '**', redirectTo: '' },
];
