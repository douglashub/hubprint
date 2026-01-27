
import { ChangeDetectionStrategy, Component, effect, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Client } from '../../../services/data.service';
import { ViaCepService } from '../../../services/viacep.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-client-form',
  templateUrl: './client-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
})
export class ClientFormComponent {
  // FIX: Add explicit type to fb to fix type inference issue.
  fb: FormBuilder = inject(FormBuilder);
  viaCepService = inject(ViaCepService);
  notificationService = inject(NotificationService);

  client = input<Client | null>(null);
  save = output<Client>();
  cancel = output<void>();
  
  clientForm = this.fb.group({
    id: [''],
    company_name: ['', Validators.required],
    trade_name: ['', Validators.required],
    cnpj: ['', Validators.required],
    contact_person: ['', Validators.required],
    contact_email: ['', [Validators.required, Validators.email]],
    contact_phone: [''],
    status: ['Ativo' as Client['status'], Validators.required],
    franchise_pages_bw: [0, [Validators.required, Validators.min(0)]],
    franchise_value_bw: [0, [Validators.required, Validators.min(0)]],
    franchise_pages_color: [0, [Validators.required, Validators.min(0)]],
    franchise_value_color: [0, [Validators.required, Validators.min(0)]],
    overage_cost_bw: [0, [Validators.required, Validators.min(0)]],
    overage_cost_color: [0, [Validators.required, Validators.min(0)]],
    address: this.fb.group({
      street: [''],
      number: [''],
      neighborhood: [''],
      city: [''],
      state: [''],
      zip: ['']
    })
  });

  constructor() {
    effect(() => {
      const clientToEdit = this.client();
      if (clientToEdit) {
        this.clientForm.patchValue(clientToEdit);
      } else {
        this.clientForm.reset({
            id: '',
            company_name: '',
            trade_name: '',
            cnpj: '',
            contact_person: '',
            contact_email: '',
            contact_phone: '',
            status: 'Ativo',
            franchise_pages_bw: 5000,
            franchise_value_bw: 200.00,
            franchise_pages_color: 0,
            franchise_value_color: 0,
            overage_cost_bw: 0.10,
            overage_cost_color: 0.50,
            address: { street: '', number: '', neighborhood: '', city: '', state: '', zip: '' }
        });
      }
    });

    this.clientForm.get('address.zip')?.valueChanges.subscribe(zip => {
      if (zip && zip.replace(/\D/g, '').length === 8) {
          this.onCepChange(zip.replace(/\D/g, ''));
      }
    });

    this.clientForm.get('cnpj')?.valueChanges.subscribe(value => {
      if (value) {
        const formattedCnpj = this.formatCnpj(value);
        if (formattedCnpj !== value) {
          this.clientForm.get('cnpj')?.setValue(formattedCnpj, { emitEvent: false });
        }
      }
    });
  }
  
  private formatCnpj(cnpj: string): string {
    const digitsOnly = cnpj.replace(/\D/g, '');
    const limitedDigits = digitsOnly.slice(0, 14);
    
    let masked = limitedDigits;

    if (limitedDigits.length > 12) {
      masked = `${limitedDigits.slice(0, 2)}.${limitedDigits.slice(2, 5)}.${limitedDigits.slice(5, 8)}/${limitedDigits.slice(8, 12)}-${limitedDigits.slice(12, 14)}`;
    } else if (limitedDigits.length > 8) {
      masked = `${limitedDigits.slice(0, 2)}.${limitedDigits.slice(2, 5)}.${limitedDigits.slice(5, 8)}/${limitedDigits.slice(8)}`;
    } else if (limitedDigits.length > 5) {
      masked = `${limitedDigits.slice(0, 2)}.${limitedDigits.slice(2, 5)}.${limitedDigits.slice(5)}`;
    } else if (limitedDigits.length > 2) {
      masked = `${limitedDigits.slice(0, 2)}.${limitedDigits.slice(2)}`;
    }
    
    return masked;
  }

  async onCepChange(cep: string): Promise<void> {
    this.notificationService.show('Buscando CEP...', 'info', 1500);
    const addressData = await this.viaCepService.searchCep(cep);
    if (addressData) {
      this.clientForm.get('address.street')?.setValue(addressData.logradouro);
      this.clientForm.get('address.neighborhood')?.setValue(addressData.bairro);
      this.clientForm.get('address.city')?.setValue(addressData.localidade);
      this.clientForm.get('address.state')?.setValue(addressData.uf);
      this.notificationService.show('Endereço encontrado!', 'success');
    } else {
      this.notificationService.show('CEP não encontrado.', 'error');
    }
  }

  onSubmit(): void {
    if (this.clientForm.valid) {
      this.save.emit(this.clientForm.getRawValue() as Client);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
