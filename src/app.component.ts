
import { ChangeDetectionStrategy, Component, effect, inject, signal, computed } from '@angular/core';
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

  publicRoutes = ['/login', '/register', '/forgot-password'];

  shouldShowSidebar = computed(() => {
    const isAuthenticated = this.isAuthenticated();
    // We need to react to navigation changes. 
    // Since navigationEndSignal captures the event, we can use it to assume URL might have changed.
    this.navigationEndSignal();
    const currentUrl = this.router.url.split('?')[0];
    return isAuthenticated && !this.publicRoutes.includes(currentUrl);
  });

  constructor() {
    effect(() => {
      const event = this.navigationEndSignal();
      // On successful navigation, check if the user should be redirected.
      if (event instanceof NavigationEnd) {
        // If user is not authenticated and the route is not a public one, redirect to login.
        if (!this.isAuthenticated() && !this.publicRoutes.includes(event.urlAfterRedirects.split('?')[0])) {
          this.router.navigate(['/login']);
        }
      }
    });
  }
}
