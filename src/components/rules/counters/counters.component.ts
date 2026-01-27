import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService, Printer, PrinterCounters } from '../../../services/data.service';
import { ReportService } from '../../../services/report.service';

@Component({
  selector: 'app-counters',
  templateUrl: './counters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  standalone: true,
})
export class CountersComponent {
  dataService = inject(DataService);
  reportService = inject(ReportService);

  printers = this.dataService.printers;
  private allCounters = this.dataService.printerCounters;
  
  selectedPrinterId = signal<string>('');

  selectedPrinter = computed(() => {
    const id = this.selectedPrinterId();
    if (!id) return null;
    return this.printers().find(p => p.id === id) ?? null;
  });

  selectedPrinterCounters = computed(() => {
    const id = this.selectedPrinterId();
    if (!id) return null;
    return this.allCounters().find(c => c.printerId === id) ?? null;
  });

  onPrinterChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedPrinterId.set(selectElement.value);
  }

  exportAsCsv(): void {
    const printer = this.selectedPrinter();
    const counters = this.selectedPrinterCounters();
    if (printer && counters) {
      this.reportService.generateCountersCsv(printer, counters, `contadores_${printer.serial_number}.csv`);
    }
  }

  exportAsPdf(): void {
    const printer = this.selectedPrinter();
    const counters = this.selectedPrinterCounters();
     if (printer && counters) {
      this.reportService.generateCountersPdf(printer, counters, 'Relatório de Contadores', `contadores_${printer.serial_number}.pdf`);
    }
  }
}
