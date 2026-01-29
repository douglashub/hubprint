
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

import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, SidebarComponent, HeaderComponent, NotificationComponent]
})
export class AppComponent {
  authService = inject(AuthService);
  router: Router = inject(Router);
  uiStateService = inject(UiStateService);
  swUpdate = inject(SwUpdate); // Inject Service Worker Update

  isAuthenticated = this.authService.isAuthenticated;
  isSidebarOpen = this.uiStateService.isSidebarOpen;


  private routerEvents$ = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd)
  );

  private navigationEndSignal = toSignal(this.routerEvents$);

  publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];

  shouldShowSidebar = computed(() => {
    const isAuthenticated = this.isAuthenticated();
    this.navigationEndSignal();
    const currentUrl = this.router.url.split('?')[0];
    return isAuthenticated && !this.publicRoutes.includes(currentUrl);
  });

  constructor() {
    // 1. Service Worker Update Logic
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      ).subscribe(() => {
        // Automatically reload directly for now to ensure user gets the fix immediately
        // In a polished app, we might show a toast "New version available", but for this critical fix, force reload.
        window.location.reload();
      });

      // Check for updates immediately on load
      this.swUpdate.checkForUpdate().then(found => {
        if (found) console.log('New version found, updating...');
      });
    }

    // 2. Auth Redirect Logic
    effect(() => {
      const event = this.navigationEndSignal();
      if (event instanceof NavigationEnd) {
        if (!this.isAuthenticated() && !this.publicRoutes.includes(event.urlAfterRedirects.split('?')[0])) {
          this.router.navigate(['/login']);
        }
      }
    });
  }
}
