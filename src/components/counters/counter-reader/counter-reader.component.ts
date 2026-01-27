
import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataService, ManualCounterReading } from '../../../services/data.service';
import { NotificationService } from '../../../services/notification.service';
import { ReportService } from '../../../services/report.service';
import { ModalComponent } from '../../shared/modal/modal.component';

@Component({
  selector: 'app-counter-reader',
  templateUrl: './counter-reader.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, ModalComponent],
  standalone: true,
  providers: [DatePipe],
})
export class CounterReaderComponent {
  dataService = inject(DataService);
  notificationService = inject(NotificationService);
  fb: FormBuilder = inject(FormBuilder);
  datePipe = inject(DatePipe);
  reportService = inject(ReportService);

  clients = this.dataService.clients;
  printers = this.dataService.printers;
  private allManualReadings = this.dataService.manualCounterReadings;
  
  selectedClientId = signal<string>('');
  selectedPrinterId = signal<string>('');
  selectedHistoryIds = signal(new Set<string>());
  isConfirmDeleteModalOpen = signal(false);
  isNewReadingFormVisible = signal(false);

  counterForm = this.fb.group({
    initialDate: ['', Validators.required],
    finalDate: ['', Validators.required],
    initialCounterBw: [0, [Validators.required, Validators.min(0)]],
    finalCounterBw: [0, [Validators.required, Validators.min(0)]],
    initialCounterColor: [0, [Validators.required, Validators.min(0)]],
    finalCounterColor: [0, [Validators.required, Validators.min(0)]],
  });

  selectedClientDetails = computed(() => {
    const clientId = this.selectedClientId();
    if (!clientId || clientId === 'internal') return null;
    return this.clients().find(c => c.id === clientId) ?? null;
  });

  availablePrinters = computed(() => {
    const clientId = this.selectedClientId();
    if (!clientId) return [];
    if (clientId === 'internal') {
        return this.printers().filter(p => !p.client_id);
    }
    return this.printers().filter(p => p.client_id === clientId);
  });

  selectedPrinter = computed(() => {
    const id = this.selectedPrinterId();
    if (!id) return null;
    return this.printers().find(p => p.id === id) ?? null;
  });

  historyForSelectedPrinter = computed(() => {
    const printerId = this.selectedPrinterId();
    if (!printerId) return [];
    
    const printer = this.printers().find(p => p.id === printerId);
    if (!printer) return [];

    const client = printer.client_id ? this.clients().find(c => c.id === printer.client_id) : null;
    const franchiseBw = client?.franchise_pages_bw ?? 0;
    const franchiseValueBw = client?.franchise_value_bw ?? 0;
    const franchiseColor = client?.franchise_pages_color ?? 0;
    const franchiseValueColor = client?.franchise_value_color ?? 0;
    const costBw = client?.overage_cost_bw ?? 0;
    const costColor = client?.overage_cost_color ?? 0;

    const history = this.allManualReadings().filter(r => r.printer_id === printerId);

    return history.map(reading => {
      const producedBw = reading.final_counter_bw - reading.initial_counter_bw;
      const producedColor = reading.final_counter_color - reading.initial_counter_color;
      const exceededBwPages = Math.max(0, producedBw - franchiseBw);
      const exceededColorPages = Math.max(0, producedColor - franchiseColor);
      const overageCostBw = exceededBwPages * costBw;
      const overageCostColor = exceededColorPages * costColor;
      const totalBilling = franchiseValueBw + franchiseValueColor + overageCostBw + overageCostColor;
      return { 
        ...reading,
        id: reading.id, // Ensure id is present
        printerModel: printer.model,
        printerSerialNumber: printer.serial_number,
        clientName: client?.trade_name || 'Uso Interno',
        initialDate: reading.initial_date,
        finalDate: reading.final_date,
        producedBw, 
        producedColor, 
        overageCostBw, 
        overageCostColor, 
        franchiseBw, 
        franchiseColor, 
        exceededBwPages, 
        exceededColorPages, 
        franchiseValueBw, 
        franchiseValueColor, 
        totalBilling 
      };
    });
  });

  isAllHistorySelected = computed(() => {
    const history = this.historyForSelectedPrinter();
    const selected = this.selectedHistoryIds();
    return history.length > 0 && history.every(item => selected.has(item.id));
  });
  
  isAnyHistorySelected = computed(() => this.selectedHistoryIds().size > 0);

  onClientChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedClientId.set(selectElement.value);
    this.selectedPrinterId.set('');
    this.selectedHistoryIds.set(new Set());
    this.isNewReadingFormVisible.set(false);
  }

  onPrinterChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const printerId = selectElement.value;
    this.selectedPrinterId.set(printerId);
    this.selectedHistoryIds.set(new Set());
    this.isNewReadingFormVisible.set(false);
    if (printerId) this.resetForm();
  }

  openNewReadingForm(): void {
    this.resetForm();
    this.isNewReadingFormVisible.set(true);
  }

  cancelNewReading(): void {
    this.isNewReadingFormVisible.set(false);
  }

  async onSubmit(): Promise<void> {
    if (this.counterForm.invalid) { this.notificationService.show('Por favor, preencha todos os campos corretamente.', 'error'); return; }
    const printer = this.selectedPrinter();
    if (!printer) { this.notificationService.show('Impressora selecionada inválida.', 'error'); return; }
    const formValue = this.counterForm.getRawValue();
    if (formValue.finalCounterBw! < formValue.initialCounterBw! || formValue.finalCounterColor! < formValue.initialCounterColor!) { this.notificationService.show('O contador final deve ser maior ou igual ao inicial.', 'error'); return; }

    const newReading: Omit<ManualCounterReading, 'id' | 'company_id' | 'created_at'> = {
        printer_id: printer.id,
        client_id: printer.client_id || null,
        initial_date: formValue.initialDate!,
        final_date: formValue.finalDate!,
        initial_counter_bw: formValue.initialCounterBw!,
        final_counter_bw: formValue.finalCounterBw!,
        initial_counter_color: formValue.initialCounterColor!,
        final_counter_color: formValue.finalCounterColor!
    };

    const success = await this.dataService.addManualCounterReading(newReading);
    if (success) {
      this.notificationService.show('Leitura de contador salva com sucesso!', 'success');
      this.resetForm();
      this.isNewReadingFormVisible.set(false);
    } else {
      this.notificationService.show('Erro ao salvar a leitura. Tente novamente.', 'error');
    }
  }

  generatePdfReport(): void {
    const selectedIds = this.selectedHistoryIds();
    if (selectedIds.size === 0) {
        this.notificationService.show('Por favor, selecione pelo menos um registro do histórico para gerar o relatório.', 'info');
        return;
    }

    const client = this.selectedClientDetails();
    const printer = this.selectedPrinter();
    
    if (!printer) {
        this.notificationService.show('Impressora não encontrada para gerar o relatório.', 'error');
        return;
    }

    const fullHistory = this.historyForSelectedPrinter();
    const selectedHistory = fullHistory.filter(item => selectedIds.has(item.id));

    if (selectedHistory.length > 0) {
        const title = `Relatório de Leituras Manuais`;
        const filename = `relatorio_leituras_${printer.asset_number}_${new Date().toISOString().split('T')[0]}.pdf`;
        
        this.reportService.generateManualCountersPdf(client, printer, selectedHistory, title, filename);
        
        this.notificationService.show(`Relatório com ${selectedHistory.length} registro(s) gerado com sucesso!`, 'success');
    } else {
        this.notificationService.show('Nenhum registro correspondente encontrado para gerar o relatório.', 'error');
    }
  }

  toggleHistorySelection(id: string): void {
    this.selectedHistoryIds.update(ids => {
      ids.has(id) ? ids.delete(id) : ids.add(id);
      return new Set(ids);
    });
  }

  toggleSelectAllHistory(): void {
    const allIds = this.historyForSelectedPrinter().map(item => item.id);
    this.isAllHistorySelected() ? this.selectedHistoryIds.set(new Set()) : this.selectedHistoryIds.set(new Set(allIds));
  }

  openConfirmDeleteModal(): void {
    if (this.isAnyHistorySelected()) this.isConfirmDeleteModalOpen.set(true);
  }

  async handleDelete(): Promise<void> {
    const idsToDelete = this.selectedHistoryIds();
    await this.dataService.deleteManualCounterReadings(idsToDelete);
    this.notificationService.show('Registros selecionados excluídos com sucesso!', 'success');
    this.selectedHistoryIds.set(new Set());
    this.isConfirmDeleteModalOpen.set(false);
  }

  private resetForm(): void {
     this.counterForm.reset({
        initialDate: this.datePipe.transform(new Date(), 'yyyy-MM-dd'),
        finalDate: this.datePipe.transform(new Date(), 'yyyy-MM-dd'),
        initialCounterBw: 0,
        finalCounterBw: 0,
        initialCounterColor: 0,
        finalCounterColor: 0,
    });
  }
}
