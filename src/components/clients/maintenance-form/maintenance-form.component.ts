
import { ChangeDetectionStrategy, Component, effect, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MaintenanceSchedule, DataService } from '../../../services/data.service';

@Component({
  selector: 'app-maintenance-form',
  templateUrl: './maintenance-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
})
export class MaintenanceFormComponent {
  // FIX: Add explicit type to fb to fix type inference issue.
  fb: FormBuilder = inject(FormBuilder);
  dataService = inject(DataService);

  schedule = input<MaintenanceSchedule | null>(null);
  save = output<MaintenanceSchedule>();
  cancel = output<void>();

  clients = this.dataService.clients;
  printers = this.dataService.printers;
  technicians = this.dataService.technicians;

  minSelectedCheckboxes(min = 1): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const formArray = control as FormArray;
      if (!formArray) {
        return null;
      }
      const totalSelected = formArray.controls
        .map(ctrl => ctrl.value.selected)
        .reduce((prev, next) => next ? prev + 1 : prev, 0);
      return totalSelected >= min ? null : { required: true };
    };
  }
  
  maintenanceForm = this.fb.group({
    id: [''],
    client_id: ['', Validators.required],
    client_name: [''],
    printers: this.fb.array([], [this.minSelectedCheckboxes(1)]),
    type: ['Preventiva' as MaintenanceSchedule['type'], Validators.required],
    scheduled_date: ['', Validators.required],
    scheduled_time: ['', Validators.required],
    technician: ['', Validators.required],
    description: ['', Validators.required],
    status: ['Agendada' as MaintenanceSchedule['status'], Validators.required]
  });

  constructor() {
    effect(() => {
      const scheduleToEdit = this.schedule();
      if (scheduleToEdit) {
        this.maintenanceForm.patchValue(scheduleToEdit);
        this.maintenanceForm.get('client_id')?.setValue(scheduleToEdit.client_id, { emitEvent: true });
        this.updatePrintersForClient(scheduleToEdit.client_id, scheduleToEdit);
      } else {
        this.maintenanceForm.reset({
          id: '',
          client_id: '',
          client_name: '',
          printers: [],
          type: 'Preventiva',
          scheduled_date: new Date().toISOString().split('T')[0],
          scheduled_time: '09:00',
          technician: '',
          description: '',
          status: 'Agendada'
        });
      }
    });

    this.maintenanceForm.get('client_id')?.valueChanges.subscribe(clientId => {
      if(clientId) {
        this.updatePrintersForClient(clientId, this.schedule());
      }
    });
  }
  
  get printersFormArray() {
    return this.maintenanceForm.get('printers') as FormArray;
  }
  
  private updatePrintersForClient(clientId: string | null, scheduleForEdit: MaintenanceSchedule | null): void {
      const printersArray = this.printersFormArray;
      printersArray.clear();

      if (!clientId) return;

      const clientPrinters = this.printers().filter(p => p.client_id === clientId);
      const selectedPrinterIds = new Set(scheduleForEdit?.printers.map(p => p.id) || []);

      clientPrinters.forEach(printer => {
          const isSelected = !!scheduleForEdit && scheduleForEdit.client_id === clientId && selectedPrinterIds.has(printer.id);
          printersArray.push(this.fb.group({
              id: [printer.id],
              model: [printer.model],
              asset_number: [printer.asset_number],
              selected: [isSelected]
          }));
      });
  }


  onSubmit(): void {
    if (this.maintenanceForm.valid) {
      const formValue = this.maintenanceForm.getRawValue();
      
      const selectedClient = this.clients().find(c => c.id === formValue.client_id);
      
      const selectedPrinters = formValue.printers
        .filter((p: any) => p.selected)
        .map((p: any) => ({ id: p.id, model: p.model, asset_number: p.asset_number }));

      const finalSchedule = {
        ...formValue,
        client_name: selectedClient?.trade_name || '',
        printers: selectedPrinters
      };

      this.save.emit(finalSchedule as MaintenanceSchedule);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
