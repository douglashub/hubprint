
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { UiStateService } from '../../../services/ui-state.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule]
})
export class SidebarComponent {
  uiStateService = inject(UiStateService);
  isSidebarOpen = this.uiStateService.isSidebarOpen;
  router = inject(Router)
  appVersion = 'v0.9.11';

  navLinks = [
    { path: '/dashboard', icon: 'home', label: 'Dashboard' },
    { path: '/users', icon: 'users', label: 'Usuários' },
    { path: '/printers', icon: 'printer', label: 'Impressoras' },
    { path: '/clients', icon: 'clients', label: 'Clientes' },
    { path: '/counters', icon: 'calculator', label: 'Contadores' },
    { path: '/preventive-maintenance', icon: 'wrench', label: 'Manutenção Preventiva' },
  ];

  onNavLinkClick(): void {
    if (window.innerWidth < 768) { // md breakpoint
      this.uiStateService.closeSidebar();
    }
  }
}
