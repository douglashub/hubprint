






import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { DataService, MaintenanceSchedule, PreventiveMaintenance, Client, Printer } from '../../../services/data.service';
import { NotificationService } from '../../../services/notification.service';
import { ReportService } from '../../../services/report.service';
import { ModalComponent } from '../../shared/modal/modal.component';

const CHECKLIST_ITEMS = [
  'Verificar qualidade de impressão', 'Realizar teste de cópia', 'Verificar desgaste de roletes',
  'Verificar unidade de imagem', 'Verificar unidade fusora', 'Verificar desgaste de engrenagens',
  'Verificar desgaste de peças', 'Realizar limpeza interna', 'Realizar limpeza externa',
  'Realizar lubrificação', 'Verificar toner', 'Verificar reservatório de resíduos',
  'Atualizar firmware', 'Verificar conexões - rede, usb, energia'
];

@Component({
  selector: 'app-maintenance-execution',
  templateUrl: './maintenance-execution.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  standalone: true,
})
export class MaintenanceExecutionComponent {
  // Services
  // FIX: Add explicit types to injected services to fix type inference issues.
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private fb: FormBuilder = inject(FormBuilder);
  private dataService = inject(DataService);
  private notificationService = inject(NotificationService);
  private reportService = inject(ReportService);

  // State Signals
  private scheduleId = toSignal(this.route.params.pipe(map(p => p['id'])));
  isFinalized = signal(false);
  isNewReport = signal(true);
  isReportPreviewModalOpen = signal(false);
  isExportDropdownOpen = signal(false);
  isPageExportDropdownOpen = signal(false);

  // Computed Signals for data retrieval
  schedule = computed(() => this.dataService.maintenanceSchedules().find(s => s.id === this.scheduleId()));
  client = computed(() => {
    const s = this.schedule();
    if (!s) return null;
    return this.dataService.clients().find(c => c.id === s.client_id);
  });
  printersForSchedule = computed(() => this.schedule()?.printers ?? []);

  areAllPrintersServiced = computed(() => {
    const currentSchedule = this.schedule();
    if (!currentSchedule || currentSchedule.printers.length === 0) return false;

    const reports = this.dataService.preventiveMaintenances();
    return currentSchedule.printers.every(p => 
      reports.some(r => r.id === this.getReportId(currentSchedule.id, p.id))
    );
  });

  // Form Definition
  maintenanceForm = this.fb.group({
    id: [''],
    date: ['', Validators.required],
    time: ['', Validators.required],
    printerId: ['', Validators.required], // This will be our dropdown control
    assetNumber: [''],
    equipmentModel: [''],
    clientId: [''],
    clientName: [''],
    city: [''],
    technicianName: ['', Validators.required],
    recommendations: [''],
    checklist: this.fb.array([])
  });

  // Control for bulk status update
  bulkStatusControl = new FormControl<'OK' | 'PENDENTE' | 'N/A' | null>(null);


  constructor() {
    // Effect to initialize the form when the schedule and printers are loaded.
    effect(() => {
        const printers = this.printersForSchedule();
        const currentPrinterId = this.maintenanceForm.get('printerId')?.value;

        // Only run initialization if printers are available and none is selected yet.
        if (printers.length > 0 && !currentPrinterId) {
            const firstPrinterId = printers[0].id;
            // Set the value without triggering the valueChanges subscription.
            this.maintenanceForm.get('printerId')?.setValue(firstPrinterId, { emitEvent: false });
            // Manually call the data loading logic for the initial setup.
            this.loadDataForPrinter(firstPrinterId);
        } else if (printers.length === 0 && this.scheduleId()) {
            this.notificationService.show('Agendamento não contém impressoras.', 'error');
        }
    }, { allowSignalWrites: true });

    // Subscribe to subsequent (user-driven) printer selection changes.
    this.maintenanceForm.get('printerId')?.valueChanges.subscribe(printerId => {
        if (printerId) {
            this.loadDataForPrinter(printerId);
        }
    });

    // Subscribe to bulk status changes
    this.bulkStatusControl.valueChanges.subscribe(status => {
      if (status) {
        this.setAllChecklistItems(status);
        // Using a timeout to allow the UI to update before resetting the control.
        // This makes the radio button "flash" and become available for another click.
        setTimeout(() => this.bulkStatusControl.reset(null, { emitEvent: false }), 100);
      }
    });
  }

  private getReportId(scheduleId: string, printerId: string): string {
      return `${scheduleId}_${printerId}`;
  }

  private loadDataForPrinter(printerId: string): void {
      const scheduleId = this.scheduleId();
      if (!scheduleId) return;

      const reportId = this.getReportId(scheduleId, printerId);
      const existingReport = this.dataService.preventiveMaintenances().find(pm => pm.id === reportId);
      
      const printer = this.printersForSchedule().find(p => p.id === printerId);
      if (!printer) return;
      
      if (existingReport) {
          this.isNewReport.set(false);
          this.isFinalized.set(true);

          // Reset the form with the report's data, which also clears the form array.
          this.maintenanceForm.reset(existingReport, { emitEvent: false });

          // The checklist array is now empty. We need to rebuild it with the saved data.
          this.checklist.clear();
          existingReport.checklist.forEach(item => {
              this.checklist.push(this.fb.group({
                  name: [item.name],
                  status: [item.status],
                  observation: [item.observation]
              }));
          });
          
          this.maintenanceForm.disable({ emitEvent: false });
          this.maintenanceForm.get('printerId')?.enable({ emitEvent: false }); // Allow changing printer even if finalized
      } else {
          this.isNewReport.set(true);
          this.isFinalized.set(false);
          this.initializeNewReport(printer);
          this.maintenanceForm.enable({ emitEvent: false });
      }
  }
  
  private initializeNewReport(printer: { id: string, model: string, asset_number: string }): void {
    const currentSchedule = this.schedule();
    if (!currentSchedule) {
      this.notificationService.show('Agendamento não encontrado.', 'error');
      this.router.navigate(['/preventive-maintenance']);
      return;
    }

    const currentClient = this.client();
    
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // Format: HH:mm

    // Manually patch values instead of using reset to avoid validation state issues
    this.maintenanceForm.patchValue({
        id: this.getReportId(currentSchedule.id, printer.id),
        date: currentDate,
        time: currentTime,
        printerId: printer.id,
        assetNumber: printer.asset_number,
        equipmentModel: printer.model,
        clientId: currentClient?.id || '',
        clientName: currentClient?.trade_name || 'N/A',
        city: currentClient?.address?.city || '',
        technicianName: currentSchedule.technician,
        recommendations: '',
    }, { emitEvent: false });

    // FIX: Replaced `setControl` with `clear` and `push` to avoid strong-typing issues with FormArray.
    this.checklist.clear();
    CHECKLIST_ITEMS.forEach(item => 
      this.checklist.push(this.fb.group({
        name: this.fb.control(item),
        status: this.fb.control<'OK' | 'PENDENTE' | 'N/A'>('OK', Validators.required),
        observation: this.fb.control('')
      }))
    );
    
    // Manually reset the form's dirty/touched state
    this.maintenanceForm.markAsPristine();
    this.maintenanceForm.markAsUntouched();
    
    if (currentSchedule.status === 'Agendada') {
        this.dataService.updateMaintenance({ ...currentSchedule, status: 'Em Andamento' });
        this.notificationService.show('Manutenção iniciada.', 'info');
    }
  }

  get checklist() {
    return this.maintenanceForm.get('checklist') as FormArray;
  }

  setAllChecklistItems(status: 'OK' | 'PENDENTE' | 'N/A'): void {
    this.checklist.controls.forEach(control => {
      control.get('status')?.patchValue(status);
    });
    this.checklist.markAsDirty();
  }

  async finalizeMaintenance(): Promise<void> {
    if (this.maintenanceForm.invalid) {
      this.maintenanceForm.markAllAsTouched();
      this.notificationService.show('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    const reportData = this.maintenanceForm.getRawValue() as PreventiveMaintenance;
    // DEBUG LOG
    console.log("--- INICIANDO FINALIZAÇÃO DE MANUTENÇÃO ---");
    console.log("Dados brutos do formulário a serem salvos:", reportData);

    let success = true;
    let errorMessage: string | undefined;

    if (this.isNewReport()) {
      // DEBUG LOG
      console.log("É um novo relatório. Chamando dataService.addPreventiveMaintenance...");
      const result = await this.dataService.addPreventiveMaintenance(reportData);
      success = result.success;
      errorMessage = result.error;
      // DEBUG LOG
      console.log("Resultado do dataService:", result);
    }

    if (!success) {
      const detailMessage = errorMessage ? `Detalhes: ${errorMessage}` : 'A manutenção não foi finalizada.';
      // DEBUG LOG
      console.error(`FALHA AO FINALIZAR MANUTENÇÃO. ${detailMessage}`);
      this.notificationService.show(`Erro: Falha ao salvar o relatório. ${detailMessage}`, 'error', 15000); // Increased duration to read the error
      return; // Stop execution if save failed
    }

    this.notificationService.show(`Manutenção para ${reportData.equipmentModel} foi salva.`, 'success');

    const associatedSchedule = this.schedule();
    if (!associatedSchedule) return;

    // After saving, find the first printer in the schedule that does NOT have a report in the service.
    // We must re-get the reports signal *after* the save has completed.
    const allReportsNow = this.dataService.preventiveMaintenances();
    const nextPrinter = associatedSchedule.printers.find(p => 
        !allReportsNow.some(r => r.id === this.getReportId(associatedSchedule.id, p.id))
    );

    if (nextPrinter) {
      // If we found a next printer, navigate to it.
      this.notificationService.show(`Agora, preencha os dados para ${nextPrinter.model} (Patrimônio: ${nextPrinter.asset_number}).`, 'info', 4000);
      this.maintenanceForm.get('printerId')?.setValue(nextPrinter.id, { emitEvent: false });
      this.loadDataForPrinter(nextPrinter.id);
    } else {
      // If NO next printer was found, all are complete.
      if (associatedSchedule.status !== 'Concluída') {
        this.dataService.updateMaintenance({ ...associatedSchedule, status: 'Concluída' });
      }
      this.notificationService.show('Todas as manutenções do agendamento foram concluídas!', 'info');
      this.isFinalized.set(true);
      this.maintenanceForm.disable({ emitEvent: false });
      this.maintenanceForm.get('printerId')?.enable({ emitEvent: false });
      this.isReportPreviewModalOpen.set(true);
    }
  }

  openReportModal(): void {
    this.isReportPreviewModalOpen.set(true);
  }
  
  generateReportAndSave(format: 'pdf' | 'doc' | 'xls' | 'xml' | 'txt'): void {
    const currentSchedule = this.schedule();
    if (!currentSchedule) {
        this.notificationService.show('Agendamento não encontrado para gerar relatório.', 'error');
        return;
    }

    const allReports = this.dataService.preventiveMaintenances();
    const reportsForThisSchedule = currentSchedule.printers
        .map(printer => {
            const reportId = this.getReportId(currentSchedule.id, printer.id);
            return allReports.find(r => r.id === reportId);
        })
        .filter((r): r is PreventiveMaintenance => r !== undefined);

    if (reportsForThisSchedule.length === 0) {
        this.notificationService.show('Nenhum relatório de manutenção finalizado foi encontrado para este agendamento.', 'error');
        return;
    }
    
    const clientName = reportsForThisSchedule[0].clientName.replace(/\s+/g, '_');
    const date = reportsForThisSchedule[0].date;
    const filename = `manutencao_${clientName}_${date}`;

    switch (format) {
        case 'pdf':
            this.reportService.generatePreventiveMaintenancePdf(reportsForThisSchedule, `${filename}.pdf`);
            break;
        case 'doc':
            this.reportService.generatePreventiveMaintenanceDoc(reportsForThisSchedule, `${filename}.doc`);
            break;
        case 'xls':
            this.reportService.generatePreventiveMaintenanceXls(reportsForThisSchedule, `${filename}.xls`);
            break;
        case 'xml':
            this.reportService.generatePreventiveMaintenanceXml(reportsForThisSchedule, `${filename}.xml`);
            break;
        case 'txt':
            this.reportService.generatePreventiveMaintenanceTxt(reportsForThisSchedule, `${filename}.txt`);
            break;
    }

    this.isExportDropdownOpen.set(false);
    this.isPageExportDropdownOpen.set(false);
    this.isReportPreviewModalOpen.set(false);
    
    this.notificationService.show(`Relatório ${format.toUpperCase()} com ${reportsForThisSchedule.length} equipamento(s) gerado com sucesso!`, 'success');
    this.router.navigate(['/preventive-maintenance']);
  }

  goBack(): void {
    this.router.navigate(['/preventive-maintenance']);
  }
}
