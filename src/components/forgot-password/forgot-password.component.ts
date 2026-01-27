
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterModule]
})
export class ForgotPasswordComponent {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  // FIX: Add explicit type to fb to fix type inference issue.
  fb: FormBuilder = inject(FormBuilder);
  // FIX: Add explicit type to router to fix type inference issue.
  router: Router = inject(Router);

  isLoading = signal(false);
  submitted = signal(false);
  submittedEmail = signal('');

  forgotPasswordForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  async onSubmit() {
    if (this.forgotPasswordForm.invalid) {
      this.notificationService.show('Por favor, insira um e-mail válido.', 'error');
      return;
    }

    this.isLoading.set(true);
    const email = this.forgotPasswordForm.value.email!;

    try {
      await this.authService.forgotPassword(email);
      this.submittedEmail.set(email);
      this.submitted.set(true);
    } catch (error) {
      this.notificationService.show('Ocorreu um erro. Tente novamente mais tarde.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
