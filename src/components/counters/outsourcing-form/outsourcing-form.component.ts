
import { ChangeDetectionStrategy, Component, effect, input, output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataService, OutsourcingContract, Printer } from '../../../services/data.service';

@Component({
  selector: 'app-outsourcing-form',
  templateUrl: './outsourcing-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  standalone: true,
})
export class OutsourcingFormComponent {
  // FIX: Add explicit type to fb to fix type inference issue.
  fb: FormBuilder = inject(FormBuilder);
  dataService = inject(DataService);

  contract = input<OutsourcingContract | null>(null);
  save = output<OutsourcingContract>();
  cancel = output<void>();

  clients = this.dataService.clients;
  private allPrinters = this.dataService.printers;
  
  selectedClientId = signal('');

  availablePrinters = computed(() => {
      const clientId = this.selectedClientId();
      if (!clientId) return [];
      return this.allPrinters().filter(p => p.client_id === clientId);
  });
  
  outsourcingForm = this.fb.group({
    id: [''],
    clientId: ['', Validators.required],
    printerId: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    initialCounterBw: [0, [Validators.required, Validators.min(0)]],
    finalCounterBw: [0, [Validators.required, Validators.min(0)]],
    initialCounterColor: [0, [Validators.required, Validators.min(0)]],
    finalCounterColor: [0, [Validators.required, Validators.min(0)]],
    includedPagesBw: [0, [Validators.required, Validators.min(0)]],
    includedPagesColor: [0, [Validators.required, Validators.min(0)]],
    costPerPageBw: [0.10, [Validators.required, Validators.min(0)]],
    costPerPageColor: [0.50, [Validators.required, Validators.min(0)]],
    status: ['Aberto' as OutsourcingContract['status'], Validators.required],
    // Readonly fields for data integrity
    clientName: [''],
    printerModel: [''],
    printerSerialNumber: [''],
  });

  constructor() {
    effect(() => {
      const contractToEdit = this.contract();
      if (contractToEdit) {
        this.outsourcingForm.patchValue(contractToEdit);
        this.selectedClientId.set(contractToEdit.clientId);
      } else {
        this.outsourcingForm.reset({
          id: '',
          clientId: '',
          printerId: '',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          initialCounterBw: 0,
          finalCounterBw: 0,
          initialCounterColor: 0,
          finalCounterColor: 0,
          includedPagesBw: 0,
          includedPagesColor: 0,
          costPerPageBw: 0.10,
          costPerPageColor: 0.50,
          status: 'Aberto'
        });
        this.selectedClientId.set('');
      }
    });

    this.outsourcingForm.get('clientId')?.valueChanges.subscribe(clientId => {
        this.selectedClientId.set(clientId || '');
        this.outsourcingForm.get('printerId')?.reset(''); // Reset printer selection when client changes
    });
  }

  onSubmit(): void {
    if (this.outsourcingForm.valid) {
      const formValue = this.outsourcingForm.getRawValue();
      
      const selectedClient = this.clients().find(c => c.id === formValue.clientId);
      const selectedPrinter = this.allPrinters().find(p => p.id === formValue.printerId);
      
      // Enrich the object with names for display and reporting
      formValue.clientName = selectedClient?.trade_name || '';
      formValue.printerModel = selectedPrinter?.model || '';
      formValue.printerSerialNumber = selectedPrinter?.serial_number || '';

      this.save.emit(formValue as OutsourcingContract);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
