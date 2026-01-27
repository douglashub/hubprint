
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { AuthService } from './services/auth.service';
import { UiStateService } from './services/ui-state.service';
import { SidebarComponent } from './components/layout/sidebar/sidebar.component';
import { HeaderComponent } from './components/layout/header/header.component';
import { NotificationComponent } from './components/layout/notification/notification.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, SidebarComponent, HeaderComponent, NotificationComponent]
})
export class AppComponent {
  authService = inject(AuthService);
  // FIX: Add explicit type to router to fix type inference issue.
  router: Router = inject(Router);
  uiStateService = inject(UiStateService);

  isAuthenticated = this.authService.isAuthenticated;
  isSidebarOpen = this.uiStateService.isSidebarOpen;


  private routerEvents$ = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd)
  );

  private navigationEndSignal = toSignal(this.routerEvents$);

  constructor() {
    const publicRoutes = ['/login', '/register', '/forgot-password'];
    effect(() => {
      const event = this.navigationEndSignal();
      // On successful navigation, check if the user should be redirected.
      if (event instanceof NavigationEnd) {
        // If user is not authenticated and the route is not a public one, redirect to login.
        if (!this.isAuthenticated() && !publicRoutes.includes(event.url)) {
          this.router.navigate(['/login']);
        }
      }
    });
  }
}
