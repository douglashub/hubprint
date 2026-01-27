

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { UiStateService } from '../../../services/ui-state.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule]
})
export class HeaderComponent {
  // FIX: Add explicit types to injected services to resolve type inference issues.
  authService: AuthService = inject(AuthService);
  uiStateService: UiStateService = inject(UiStateService);
  router: Router = inject(Router);
  
  user = this.authService.currentUser;
  isDropdownOpen = signal(false);

  toggleDropdown() {
    this.isDropdownOpen.update(v => !v);
  }

  toggleSidebar() {
    this.uiStateService.toggleSidebar();
  }

  async logout() {
    this.isDropdownOpen.set(false);
    await this.authService.logout();
  }

  navigateToProfile() {
    this.isDropdownOpen.set(false);
    this.router.navigate(['/profile']);
  }
}