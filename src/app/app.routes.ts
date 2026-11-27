import { Routes } from '@angular/router';
import { adminGuard, authGuard, spaGuard, superGuard } from './core/http';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  {
    path: '', canActivate: [authGuard],
    loadComponent: () => import('./pages/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', canActivate: [spaGuard], loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard) },
      { path: 'payments', canActivate: [spaGuard], loadComponent: () => import('./pages/payments').then((m) => m.Payments) },
      { path: 'appointments', canActivate: [spaGuard], loadComponent: () => import('./pages/appointments').then((m) => m.Appointments) },
      { path: 'onboarding', canActivate: [spaGuard], loadComponent: () => import('./pages/onboarding').then((m) => m.Onboarding) },
      { path: 'customers', canActivate: [spaGuard], loadComponent: () => import('./pages/customers').then((m) => m.Customers) },
      { path: 'account', loadComponent: () => import('./pages/account').then((m) => m.Account) },
      { path: 'spas', canActivate: [superGuard], loadComponent: () => import('./pages/spas').then((m) => m.Spas) },
      { path: 'users', canActivate: [adminGuard], loadComponent: () => import('./pages/users').then((m) => m.Users) },
      { path: 'services', canActivate: [spaGuard, adminGuard], data: { section: 'services' }, loadComponent: () => import('./pages/staff').then((m) => m.Staff) },
      { path: 'staff', canActivate: [spaGuard, adminGuard], loadComponent: () => import('./pages/staff').then((m) => m.Staff) },
      { path: 'reports', canActivate: [spaGuard, adminGuard], loadComponent: () => import('./pages/reports').then((m) => m.Reports) },
      { path: 'audit', canActivate: [spaGuard, adminGuard], loadComponent: () => import('./pages/audit').then((m) => m.Audit) },
      { path: 'plans', canActivate: [spaGuard, adminGuard], loadComponent: () => import('./pages/plan-packages').then((m) => m.PlanPackages) },
      { path: 'expenses', canActivate: [spaGuard, adminGuard], loadComponent: () => import('./pages/expenses').then((m) => m.Expenses) },
      { path: 'payroll', canActivate: [spaGuard, adminGuard], loadComponent: () => import('./pages/payroll').then((m) => m.Payroll) },
    ],
  },
  { path: '**', redirectTo: '' },
];
