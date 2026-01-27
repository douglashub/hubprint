
import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class DashboardComponent {
  dataService = inject(DataService);

  summary = this.dataService.dashboardSummary;
  recentActivity = this.dataService.recentActivity;
  
  maxCostByClient = computed(() => {
    const costs = this.summary().costByClient;
    if (!costs || costs.length === 0) return 1;
    return Math.max(...costs.map(d => d.value));
  });

  maxPagesByPrinter = computed(() => {
    const pages = this.summary().pagesByPrinter;
    if (!pages || pages.length === 0) return 1;
    return Math.max(...pages.map(p => p.value));
  });

  formatCurrency(value: number | undefined): string {
    if (value === undefined) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatNumber(value: number | undefined): string {
    if (value === undefined) return '0';
    return value.toLocaleString('pt-BR');
  }

  getBarWidth(value: number, max: number): string {
    if (!value || !max) return '0%';
    const percentage = (value / (max || 1)) * 100;
    return `${percentage}%`;
  }
}
