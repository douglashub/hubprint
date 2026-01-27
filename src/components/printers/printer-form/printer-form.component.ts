
import { ChangeDetectionStrategy, Component, effect, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Printer, DataService } from '../../../services/data.service';

@Component({
  selector: 'app-printer-form',
  templateUrl: './printer-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
})
export class PrinterFormComponent {
  // FIX: Add explicit type to fb to fix type inference issue.
  fb: FormBuilder = inject(FormBuilder);
  dataService = inject(DataService);

  printer = input<Printer | null>(null);
  save = output<Printer>();
  cancel = output<void>();

  clients = this.dataService.clients;
  technicians = this.dataService.technicians;
  
  printerForm = this.fb.group({
    id: [''],
    client_id: [''],
    client_name: [''],
    location: ['', Validators.required],
    sector: ['', Validators.required],
    asset_number: ['', Validators.required],
    model: ['', Validators.required],
    serial_number: ['', Validators.required],
    ip_address: ['', [Validators.required, Validators.pattern(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)]],
    mac_address: ['', Validators.required],
    technician: [''],
    queue: [''],
    installation_date: ['', Validators.required],
    transformer_number: [''],
    installation_status: ['OK' as Printer['installation_status'], Validators.required],
    adf_processor: [false],
    ak_748: [false],
    finisher: [false],
    cabinet: [false],
    nst_nd: [false],
    inst_ocr: [false],
  });

  constructor() {
    effect(() => {
      const printerToEdit = this.printer();
      if (printerToEdit) {
        this.printerForm.patchValue(printerToEdit);
      } else {
        this.printerForm.reset({
            id: '',
            client_id: '',
            client_name: '',
            location: '',
            sector: '',
            asset_number: '',
            model: '',
            serial_number: '',
            ip_address: '',
            mac_address: '',
            technician: '',
            queue: '',
            installation_date: new Date().toISOString().split('T')[0], // Today's date
            transformer_number: '',
            installation_status: 'OK',
            adf_processor: false,
            ak_748: false,
            finisher: false,
            cabinet: false,
            nst_nd: false,
            inst_ocr: false,
        });
      }
    });
  }

  onSubmit(): void {
    if (this.printerForm.valid) {
      const formValue = this.printerForm.getRawValue();
      
      const selectedClient = this.clients().find(c => c.id === formValue.client_id);
      formValue.client_name = selectedClient?.trade_name || '';

      this.save.emit(formValue as Printer);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
