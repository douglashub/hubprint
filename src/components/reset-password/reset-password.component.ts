import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { NotificationService } from '../../services/notification.service';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent {
    private fb = inject(FormBuilder);
    private supabase = inject(SupabaseService).supabase;
    private router = inject(Router);
    private notificationService = inject(NotificationService);

    isLoading = signal(false);

    resetForm = this.fb.group({
        password: ['', [Validators.required, Validators.minLength(6)]]
    });

    async onSubmit() {
        if (this.resetForm.valid) {
            this.isLoading.set(true);
            const password = this.resetForm.get('password')?.value;

            try {
                const { error } = await this.supabase.auth.updateUser({ password: password! });

                if (error) throw error;

                this.notificationService.show('Senha atualizada com sucesso!', 'success');
                this.router.navigate(['/login']);
            } catch (error: any) {
                this.notificationService.show('Erro ao atualizar senha: ' + error.message, 'error');
            } finally {
                this.isLoading.set(false);
            }
        }
    }
}
