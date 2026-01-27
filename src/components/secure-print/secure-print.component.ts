import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { DataService, PrintJob } from '../../services/data.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-secure-print',
  templateUrl: './secure-print.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe]
})
export class SecurePrintComponent {
  dataService = inject(DataService);
  notificationService = inject(NotificationService);

  pendingJobs = toSignal(this.dataService.getPendingJobs(), { initialValue: [] });

  formatCurrency(value: number | undefined): string {
    if (value === undefined) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  release(job: PrintJob): void {
    this.dataService.releaseJob(job.id);
    this.notificationService.show(`Trabalho "${job.document_name}" liberado com sucesso!`, 'success');
  }

  cancel(job: PrintJob): void {
    this.dataService.cancelJob(job.id);
    this.notificationService.show(`Trabalho "${job.document_name}" cancelado.`, 'info');
  }
}