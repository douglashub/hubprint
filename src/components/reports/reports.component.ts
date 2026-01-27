
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DataService, PrintJob } from '../../services/data.service';
import { ReportService } from '../../services/report.service';
import { ModalComponent } from '../shared/modal/modal.component';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, ModalComponent]
})
export class ReportsComponent {
  dataService = inject(DataService);
  reportService = inject(ReportService);

  printJobs = this.dataService.printJobs;
  
  isDetailModalOpen = signal(false);
  selectedJob = signal<PrintJob | null>(null);

  openJobDetails(job: PrintJob): void {
    this.selectedJob.set(job);
    this.isDetailModalOpen.set(true);
  }

  closeJobDetails(): void {
    this.isDetailModalOpen.set(false);
    this.selectedJob.set(null);
  }

  exportAsCsv(): void {
    const jobs = this.printJobs();
    if (jobs && jobs.length > 0) {
      this.reportService.generateCsv(jobs, 'relatorio_impressoes.csv');
    }
  }

  exportAsPdf(): void {
    const jobs = this.printJobs();
    if (jobs && jobs.length > 0) {
      this.reportService.generatePdf(jobs, 'Relatório de Impressões', 'relatorio_impressoes.pdf');
    }
  }

  formatCurrency(value: number | undefined): string {
    if (value === undefined) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
