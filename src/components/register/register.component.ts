
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  return password && confirmPassword && password.value !== confirmPassword.value ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterModule]
})
export class RegisterComponent {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  // FIX: Add explicit type to fb to fix type inference issue.
  fb: FormBuilder = inject(FormBuilder);
  // FIX: Add explicit type to router to fix type inference issue.
  router: Router = inject(Router);

  isLoading = signal(false);

  registerForm = this.fb.group({
    fullName: ['', Validators.required],
    companyName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
    agreeTerms: [false, Validators.requiredTrue]
  }, { validators: passwordMatchValidator });

  async onSubmit() {
    if (this.registerForm.invalid) {
      if (this.registerForm.hasError('passwordMismatch')) {
        this.notificationService.show('As senhas não conferem.', 'error');
      } else if (this.registerForm.get('agreeTerms')?.value === false) {
        this.notificationService.show('Você deve aceitar os termos de serviço.', 'error');
      } else {
        this.notificationService.show('Por favor, preencha todos os campos corretamente.', 'error');
      }
      return;
    }

    this.isLoading.set(true);
    const { fullName, companyName, email, password } = this.registerForm.value;

    try {
      const success = await this.authService.register(fullName!, companyName!, email!, password!);
      if (success) {
        this.notificationService.show('Cadastro realizado! Verifique seu e-mail para confirmar a conta.', 'success', 6000);
        this.router.navigate(['/login']);
      } else {
        this.notificationService.show('Este e-mail já está em uso.', 'error');
      }
    } catch (error) {
      this.notificationService.show('Ocorreu um erro ao tentar se cadastrar.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
