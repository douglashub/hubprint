

import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { ViaCepService } from '../../services/viacep.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent]
})
export class ProfileComponent {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  fb: FormBuilder = inject(FormBuilder);
  viaCepService = inject(ViaCepService);
  supabaseService = inject(SupabaseService);
  private supabase = this.supabaseService.supabase;

  user = this.authService.currentUser;
  isEditing = signal(false);
  isAvatarModalOpen = signal(false);
  isCameraModalOpen = signal(false);
  isPinModalOpen = signal(false);
  cameraStream = signal<MediaStream | null>(null);

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;

  profileForm = this.fb.group({
    full_name: ['', Validators.required],
    email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
    cpf: [''],
    phone: [''],
    address: this.fb.group({
      street: [''],
      number: [''],
      neighborhood: [''],
      city: [''],
      state: [''],
      zip: ['']
    }),
    company_profile: this.fb.group({
      isCompanyProfileActive: [false],
      name: [''],
      taxIdType: ['cnpj'],
      taxId: [''],
      tradeName: [''],
      email: ['', [Validators.email]],
      phone: [''],
      stateRegistration: [''],
      municipalRegistration: [''],
      logoUrl: [''],
      address: this.fb.group({
        useUserAddress: [false],
        street: [''],
        number: [''],
        neighborhood: [''],
        city: [''],
        state: [''],
        zip: ['']
      })
    })
  });

  pinForm = this.fb.group({
    newPin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]]
  });

  constructor() {
    this.profileForm.get('address.zip')?.valueChanges.subscribe(zip => {
      if (zip && zip.replace(/\D/g, '').length === 8) this.onCepChange(zip.replace(/\D/g, ''), 'address');
    });

    const companyForm = this.profileForm.get('company_profile') as FormGroup;
    const companyAddressForm = companyForm.get('address') as FormGroup;

    companyAddressForm.get('zip')?.valueChanges.subscribe(zip => {
      if (zip && zip.replace(/\D/g, '').length === 8 && !companyAddressForm.get('useUserAddress')?.value) this.onCepChange(zip.replace(/\D/g, ''), 'company_profile.address');
    });

    companyForm.get('isCompanyProfileActive')?.valueChanges.subscribe(isActive => this.updateCompanySectionState(isActive, companyForm.get('taxIdType')?.value, companyAddressForm.get('useUserAddress')?.value));

    companyAddressForm.get('useUserAddress')?.valueChanges.subscribe(useUserAddress => {
      this.updateCompanyAddressState(useUserAddress);
      // FIX: Use `getRawValue()` to ensure the full address object, including the 'zip'
      // property, is passed to `patchValue`. This resolves a TypeScript error where
      // the inferred type of `.value` was incorrect due to other partial updates.
      if (useUserAddress) {
        companyAddressForm.patchValue(this.profileForm.get('address')?.getRawValue() || {});
      }
    });

    effect(() => {
      const stream = this.cameraStream();
      const video = this.videoElement?.nativeElement;
      if (stream && video) {
        video.srcObject = stream;
      }
    });
  }

  private updateCompanySectionState(isActive: boolean, taxIdType: string, useUserAddress: boolean): void {
    const companyForm = this.profileForm.get('company_profile') as FormGroup;
    const fieldsToToggle = ['name', 'taxIdType', 'taxId', 'email', 'phone', 'stateRegistration', 'municipalRegistration', 'address'];
    fieldsToToggle.forEach(field => isActive ? companyForm.get(field)?.enable() : companyForm.get(field)?.disable());
    if (isActive) {
      this.updateTradeNameState();
      this.updateCompanyAddressState(useUserAddress);
    }
  }

  private updateTradeNameState(): void {
    const tradeNameControl = this.profileForm.get('company_profile.tradeName');
    if (this.profileForm.get('company_profile.isCompanyProfileActive')?.value) tradeNameControl?.enable();
    else tradeNameControl?.disable();
  }

  private updateCompanyAddressState(useUserAddress: boolean | null | undefined): void {
    const companyAddressForm = this.profileForm.get('company_profile.address') as FormGroup;
    const addressControls = ['street', 'number', 'neighborhood', 'city', 'state', 'zip'];
    if (useUserAddress) addressControls.forEach(c => companyAddressForm.get(c)?.disable());
    else if (this.profileForm.get('company_profile.isCompanyProfileActive')?.value) addressControls.forEach(c => companyAddressForm.get(c)?.enable());
  }

  async onCepChange(cep: string, targetPath: 'address' | 'company_profile.address'): Promise<void> {
    this.notificationService.show('Buscando CEP...', 'info', 1500);
    const addressData = await this.viaCepService.searchCep(cep);
    const addressFormGroup = this.profileForm.get(targetPath);
    if (addressData) {
      // FIX: Replaced the `patchValue` call with individual `setValue` calls on form controls. This resolves a TypeScript error related to patching a partial object onto a form group with a complex union type. This approach is more type-safe and also preserves the intended logic of not updating the 'zip' field to prevent infinite loops.
      addressFormGroup?.get('street')?.setValue(addressData.logradouro);
      addressFormGroup?.get('neighborhood')?.setValue(addressData.bairro);
      addressFormGroup?.get('city')?.setValue(addressData.localidade);
      addressFormGroup?.get('state')?.setValue(addressData.uf);
      addressFormGroup?.get('number')?.setValue('');
      // NOTE: We do not update the 'zip' field here. The user has already typed it,
      // and updating it again (especially if the API returns a formatted version)
      // could re-trigger this 'valueChanges' subscription, causing an infinite loop.
      this.notificationService.show('Endereço encontrado!', 'success');
    } else {
      this.notificationService.show('CEP não encontrado.', 'error');
    }
  }

  toggleEdit(): void {
    if (!this.isEditing()) {
      const currentUser = this.user();
      if (currentUser) {
        const { company_profile: company, ...userFields } = currentUser;
        this.profileForm.patchValue({ ...userFields, company_profile: company });
        const companyForm = this.profileForm.get('company_profile') as FormGroup;
        const companyAddressForm = companyForm.get('address') as FormGroup;
        this.updateCompanySectionState(companyForm.value.isCompanyProfileActive, companyForm.value.taxIdType, companyAddressForm.value.useUserAddress);
      }
    }
    this.isEditing.update(v => !v);
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.notificationService.show('Formulário inválido. Verifique os campos.', 'error');
      return;
    }
    await this.authService.updateCurrentUser(this.profileForm.getRawValue() as any);
    this.isEditing.set(false);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  async onAvatarFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.notificationService.show('Por favor, selecione um arquivo de imagem.', 'error');
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    try {
      this.notificationService.show('Enviando imagem...', 'info', 10000);
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentUser.id}/avatar-${Date.now()}.${fileExt}`;

      const { error } = await this.supabase.storage
        .from('assets')
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      const { data } = this.supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      if (!data.publicUrl) {
        throw new Error('Não foi possível obter a URL pública da imagem.');
      }

      await this.authService.updateUserAvatar(data.publicUrl);
      this.isAvatarModalOpen.set(false);
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      this.notificationService.show(`Erro ao enviar imagem: ${error.message}`, 'error');
    }
  }

  async onLogoFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.notificationService.show('Por favor, selecione um arquivo de imagem.', 'error');
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    try {
      this.notificationService.show('Enviando logo...', 'info', 10000);
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentUser.id}/${currentUser.company_id}/logo-${Date.now()}.${fileExt}`;

      const { error } = await this.supabase.storage
        .from('assets')
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      const { data } = this.supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      if (!data.publicUrl) {
        throw new Error('Não foi possível obter a URL pública da imagem.');
      }

      this.profileForm.get('company_profile.logoUrl')?.setValue(data.publicUrl);
      this.notificationService.show('Pré-visualização do logo atualizada!', 'success');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      this.notificationService.show(`Erro ao enviar logo: ${error.message}`, 'error');
    }
  }

  async startCamera(): Promise<void> {
    this.isAvatarModalOpen.set(false);
    this.isCameraModalOpen.set(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.cameraStream.set(stream);
    } catch (err) {
      console.error('Error accessing camera:', err);
      this.notificationService.show('Não foi possível acessar a câmera. Verifique as permissões no seu navegador.', 'error', 5000);
      this.isCameraModalOpen.set(false);
    }
  }

  private dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error("Invalid data URL");
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  async captureImage(): Promise<void> {
    const video = this.videoElement?.nativeElement;
    const canvas = this.canvasElement?.nativeElement;
    const currentUser = this.authService.currentUser();

    if (!video || !canvas || !currentUser) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    const file = this.dataURLtoFile(dataUrl, `capture-${Date.now()}.png`);

    this.stopCamera();

    try {
      this.notificationService.show('Enviando imagem...', 'info', 10000);
      const filePath = `${currentUser.id}/avatar-${Date.now()}.png`;

      const { error } = await this.supabase.storage
        .from('assets')
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      const { data } = this.supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      if (!data.publicUrl) {
        throw new Error('Não foi possível obter a URL pública da imagem.');
      }

      await this.authService.updateUserAvatar(data.publicUrl);
    } catch (error: any) {
      console.error('Error uploading captured image:', error);
      this.notificationService.show(`Erro ao enviar imagem: ${error.message}`, 'error');
    }
  }

  stopCamera(): void {
    const stream = this.cameraStream();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    this.cameraStream.set(null);
    this.isCameraModalOpen.set(false);
  }

  openPinModal(): void {
    this.pinForm.reset();
    this.isPinModalOpen.set(true);
  }

  async savePin(): Promise<void> {
    if (this.pinForm.invalid) {
      this.notificationService.show('PIN inválido. Deve conter 4 dígitos.', 'error');
      return;
    }
    const newPin = this.pinForm.get('newPin')?.value;
    if (newPin) {
      await this.authService.updateCurrentUserPin(newPin);
      this.notificationService.show('PIN atualizado com sucesso!', 'success');
      this.isPinModalOpen.set(false);
    }
  }
}