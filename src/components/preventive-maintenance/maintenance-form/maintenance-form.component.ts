
import { ChangeDetectionStrategy, Component, effect, input, output, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { DataService, PreventiveMaintenance, Printer, Client } from '../../../services/data.service';

const CHECKLIST_ITEMS = [
  'Verificar qualidade de impressão', 'Verificar qualidade da cópia', 'Verificar desgaste de roletes',
  'Verificar unidade de imagem', 'Verificar unidade fusora', 'Verificar desgaste de engrenagens',
  'Verificar desgaste de peças', 'Realizar limpeza interna', 'Realizar limpeza externa',
  'Realizar lubrificação', 'Verificar toner', 'Verificar reservatório de resíduos',
  'Atualizar firmware', 'Verificar conexões - rede, usb, energia'
];

@Component({
  selector: 'app-maintenance-form',
  templateUrl: './maintenance-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  standalone: true,
  providers: [DatePipe]
})
export class MaintenanceFormComponent {
  // FIX: Add explicit type to fb to fix type inference issue.
  fb: FormBuilder = inject(FormBuilder);
  dataService = inject(DataService);
  datePipe = inject(DatePipe);

  maintenance = input<PreventiveMaintenance | null>(null);
  save = output<PreventiveMaintenance>();
  cancel = output<void>();

  printers = this.dataService.printers;
  clients = this.dataService.clients;
  technicians = this.dataService.technicians;
  
  maintenanceForm = this.fb.group({
    id: [''],
    date: ['', Validators.required],
    time: ['', Validators.required],
    printerId: ['', Validators.required],
    assetNumber: [{ value: '', disabled: true }],
    equipmentModel: [{ value: '', disabled: true }],
    clientId: [''],
    clientName: [{ value: '', disabled: true }],
    city: [{ value: '', disabled: true }],
    technicianName: ['', Validators.required],
    clientSignatureName: ['', Validators.required],
    technicianSignature: ['', Validators.required],
    recommendations: [''],
    checklist: this.fb.array([])
  });

  constructor() {
    this.buildChecklist();
    
    effect(() => {
      const maintenanceToEdit = this.maintenance();
      if (maintenanceToEdit) {
        this.maintenanceForm.patchValue(maintenanceToEdit);
        // Ensure checklist is populated correctly when editing
        this.checklist.clear();
        maintenanceToEdit.checklist.forEach(item => {
            this.checklist.push(this.fb.group({
                name: [item.name],
                status: [item.status],
                observation: [item.observation]
            }));
        });
      } else {
        this.maintenanceForm.reset();
        this.setDefaultValues();
      }
    });

    this.maintenanceForm.get('printerId')?.valueChanges.subscribe(printerId => {
      this.onPrinterSelected(printerId);
    });
  }
  
  get checklist() {
    return this.maintenanceForm.get('checklist') as FormArray;
  }

  private buildChecklist(): void {
    CHECKLIST_ITEMS.forEach(item => {
      this.checklist.push(this.fb.group({
        name: [item],
        status: ['OK' as const, Validators.required],
        observation: ['']
      }));
    });
  }

  private setDefaultValues(): void {
    const now = new Date();
    this.maintenanceForm.patchValue({
      date: this.datePipe.transform(now, 'yyyy-MM-dd'),
      time: this.datePipe.transform(now, 'HH:mm'),
      clientSignatureName: '',
      technicianSignature: '',
      recommendations: '',
      technicianName: '',
      printerId: ''
    });
    this.checklist.controls.forEach(control => {
        control.patchValue({ status: 'OK', observation: '' });
    });
  }

  onPrinterSelected(printerId: string | null | undefined): void {
    if (!printerId) {
        this.maintenanceForm.patchValue({ assetNumber: '', equipmentModel: '', clientName: '', city: '', clientId: '' });
        return;
    }

    const printer = this.printers().find(p => p.id === printerId);
    if (printer) {
      const client = this.clients().find(c => c.id === printer.client_id);
      this.maintenanceForm.patchValue({
        assetNumber: printer.asset_number,
        equipmentModel: printer.model,
        clientName: client?.trade_name || 'Uso Interno',
        city: client?.address.city || '',
        clientId: client?.id || ''
      });
    }
  }

  onSubmit(): void {
    if (this.maintenanceForm.valid) {
      this.save.emit(this.maintenanceForm.getRawValue() as PreventiveMaintenance);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
