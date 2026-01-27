
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterModule]
})
export class LoginComponent {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  // FIX: Add explicit type to fb to fix type inference issue.
  fb: FormBuilder = inject(FormBuilder);
  
  isLoading = signal(false);
  
  loginForm = this.fb.group({
    email: ['viniedoug@gmail.com', [Validators.required, Validators.email]],
    password: ['Teste@123', [Validators.required]]
  });

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.notificationService.show('Por favor, preencha os campos corretamente.', 'error');
      return;
    }

    this.isLoading.set(true);
    const { email, password } = this.loginForm.value;

    try {
      const result = await this.authService.login(email!, password!);
      if (!result.success) {
        if (result.error && result.error.includes('Email not confirmed')) {
          this.notificationService.show('E-mail não confirmado. Verifique sua caixa de entrada.', 'error', 5000);
        } else {
          this.notificationService.show('E-mail ou senha inválidos.', 'error');
        }
      } else {
        this.notificationService.show('Login realizado com sucesso!', 'success');
      }
    } catch (error) {
      this.notificationService.show('Ocorreu um erro ao tentar fazer login.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
