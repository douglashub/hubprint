import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(c => c.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register/register.component').then(c => c.RegisterComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./components/forgot-password/forgot-password.component').then(c => c.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./components/reset-password/reset-password.component').then(c => c.ResetPasswordComponent),
  },
  {
    path: '',
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./components/dashboard/dashboard.component').then(c => c.DashboardComponent),
        title: 'Dashboard'
      },
      {
        path: 'users',
        loadComponent: () => import('./components/users/users.component').then(c => c.UsersComponent),
        title: 'Users'
      },
      {
        path: 'printers',
        loadComponent: () => import('./components/printers/printers.component').then(c => c.PrintersComponent),
        title: 'Printers'
      },
      {
        path: 'clients',
        loadComponent: () => import('./components/clients/clients.component').then(c => c.ClientsComponent),
        title: 'Clients'
      },
      {
        path: 'counters',
        loadComponent: () => import('./components/counters/counters.component').then(c => c.CountersComponent),
        title: 'Counters'
      },
      {
        path: 'preventive-maintenance',
        loadComponent: () => import('./components/preventive-maintenance/preventive-maintenance.component').then(c => c.PreventiveMaintenanceComponent),
        title: 'Preventive Maintenance'
      },
      {
        path: 'maintenance-execution/:id',
        loadComponent: () => import('./components/preventive-maintenance/maintenance-execution/maintenance-execution.component').then(c => c.MaintenanceExecutionComponent),
        title: 'Execução de Manutenção'
      },
      {
        path: 'profile',
        loadComponent: () => import('./components/profile/profile.component').then(c => c.ProfileComponent),
        title: 'My Profile'
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' } // Wildcard route
];