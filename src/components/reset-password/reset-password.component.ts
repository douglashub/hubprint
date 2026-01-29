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
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    passwordMatchValidator(g: any) {
        return g.get('password').value === g.get('confirmPassword').value
            ? null : { mismatch: true };
    }

    async onSubmit() {
        if (this.resetForm.valid) {
            this.isLoading.set(true);
            const password = this.resetForm.get('password')?.value;

            // DEBUG: Check current session state before attempting update
            const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
            console.log('[ResetPassword] Current Session:', session);
            console.log('[ResetPassword] Session Error:', sessionError);
            console.log('[ResetPassword] Attempting to update password...');

            if (!session) {
                console.error('[ResetPassword] NO SESSION FOUND. Supabase cannot update user without an active session.');
                this.notificationService.show('Sessão perdida. Por favor, clique no link do email novamente.', 'error');
                this.isLoading.set(false);
                return;
            }

            try {
                // IMPORTANT: We use updateUser, which requires an active session.
                const { data, error } = await this.supabase.auth.updateUser({ password: password! });

                console.log('[ResetPassword] Update Result Data:', data);

                if (error) {
                    console.error('[ResetPassword] Update Error:', error);
                    throw error;
                }

                this.notificationService.show('Senha atualizada com sucesso!', 'success');
                this.router.navigate(['/login']);
            } catch (error: any) {
                console.error('[ResetPassword] Catch Error:', error);
                this.notificationService.show('Erro ao atualizar senha: ' + (error.message || JSON.stringify(error)), 'error');
            } finally {
                this.isLoading.set(false);
            }
        }
    }
}
