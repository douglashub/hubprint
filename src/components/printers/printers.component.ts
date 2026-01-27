
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DataService, Printer } from '../../services/data.service';
import { NotificationService } from '../../services/notification.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { PrinterFormComponent } from './printer-form/printer-form.component';
import { ReportService } from '../../services/report.service';

@Component({
  selector: 'app-printers',
  templateUrl: './printers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ModalComponent, PrinterFormComponent, DatePipe]
})
export class PrintersComponent {
  dataService = inject(DataService);
  notificationService = inject(NotificationService);
  reportService = inject(ReportService);
  
  private readonly allPrinters = this.dataService.printers;
  searchTerm = signal('');

  printers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) {
      return this.allPrinters();
    }
    return this.allPrinters().filter(printer =>
      printer.model.toLowerCase().includes(term) ||
      (printer.client_name || '').toLowerCase().includes(term) ||
      printer.location.toLowerCase().includes(term) ||
      printer.sector.toLowerCase().includes(term) ||
      printer.asset_number.toLowerCase().includes(term) ||
      printer.serial_number.toLowerCase().includes(term) ||
      printer.ip_address.toLowerCase().includes(term) ||
      printer.installation_status.toLowerCase().includes(term)
    );
  });
  
  isModalOpen = signal(false);
  selectedPrinter = signal<Printer | null>(null);
  modalTitle = signal('');

  isConfirmModalOpen = signal(false);
  printerToDelete = signal<Printer | null>(null);

  statusClass = computed(() => {
    return (status: Printer['installation_status']) => {
        switch (status) {
            case 'OK': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'Pendente': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            default: return '';
        }
    }
  });

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  openAddModal(): void {
    this.selectedPrinter.set(null);
    this.modalTitle.set('Adicionar Nova Impressora');
    this.isModalOpen.set(true);
  }

  openEditModal(printer: Printer): void {
    this.selectedPrinter.set(printer);
    this.modalTitle.set(`Editar Impressora: ${printer.model}`);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  async handleSave(printer: Printer): Promise<void> {
    let success = false;
    if (this.selectedPrinter()) {
      success = await this.dataService.updatePrinter(printer);
      if (success) {
        this.notificationService.show('Impressora atualizada com sucesso!', 'success');
      } else {
        this.notificationService.show('Erro ao atualizar a impressora. Verifique os dados e tente novamente.', 'error');
      }
    } else {
      const { id, company_id, created_at, ...newPrinter } = printer;
      success = await this.dataService.addPrinter(newPrinter as any);
      if (success) {
        this.notificationService.show('Impressora adicionada com sucesso!', 'success');
      } else {
        this.notificationService.show('Erro ao adicionar a impressora. Verifique os dados e tente novamente.', 'error');
      }
    }
    
    if (success) {
      this.closeModal();
    }
  }

  openConfirmDeleteModal(printer: Printer): void {
    this.printerToDelete.set(printer);
    this.isConfirmModalOpen.set(true);
  }

  closeConfirmModal(): void {
    this.isConfirmModalOpen.set(false);
    this.printerToDelete.set(null);
  }

  async handleDelete(): Promise<void> {
    const printer = this.printerToDelete();
    if (printer) {
      await this.dataService.deletePrinter(printer.id);
      this.notificationService.show('Impressora excluída com sucesso!', 'success');
    }
    this.closeConfirmModal();
  }

  exportAsCsv(): void {
    const printers = this.printers();
    if (printers && printers.length > 0) {
      this.reportService.generatePrintersCsv(printers, 'lista_impressoras.csv');
    }
  }

  exportAsPdf(): void {
    const printers = this.printers();
    if (printers && printers.length > 0) {
      this.reportService.generatePrintersPdf(printers, 'Lista de Impressoras', 'lista_impressoras.pdf');
    }
  }
}