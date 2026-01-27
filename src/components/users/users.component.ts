import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService, User } from '../../services/data.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { UserFormComponent } from './user-form/user-form.component';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ModalComponent, UserFormComponent]
})
export class UsersComponent {
  dataService = inject(DataService);
  notificationService = inject(NotificationService);
  authService = inject(AuthService);

  private allUsers = this.dataService.users;
  private currentUser = this.authService.currentUser;

  users = computed(() => {
    const currentUser = this.currentUser();
    const userList = this.allUsers();

    if (!currentUser) return [];
    
    // In a real RLS setup, Supabase would already filter this.
    // This is a client-side safeguard.
    if (currentUser.role === 'company_admin') return userList;
    
    return userList.filter(user => user.role !== 'company_admin');
  });

  isModalOpen = signal(false);
  selectedUser = signal<User | null>(null);
  
  modalTitle = signal('');

  isConfirmModalOpen = signal(false);
  userToDelete = signal<User | null>(null);

  openAddModal(): void {
    this.selectedUser.set(null);
    this.modalTitle.set('Adicionar Membro da Equipe');
    this.isModalOpen.set(true);
  }

  openEditModal(user: User): void {
    this.selectedUser.set(user);
    this.modalTitle.set(`Editar Usuário: ${user.full_name}`);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  async handleSave(user: User): Promise<void> {
    if (this.selectedUser()) { // Editing
      await this.dataService.updateUser(user);
      this.notificationService.show('Usuário atualizado com sucesso!', 'success');
    } else { // Adding
      const { id, ...newUser } = user;
      await this.dataService.addUser(newUser);
      this.notificationService.show(`Perfil para ${user.email} criado! Um convite precisa ser enviado para habilitar o login.`, 'success', 6000);
    }
    this.closeModal();
  }

  openConfirmDeleteModal(user: User): void {
    this.userToDelete.set(user);
    this.isConfirmModalOpen.set(true);
  }

  closeConfirmModal(): void {
    this.isConfirmModalOpen.set(false);
    this.userToDelete.set(null);
  }

  async handleDelete(): Promise<void> {
    const user = this.userToDelete();
    if (user) {
      await this.dataService.deleteUser(user.id);
      this.notificationService.show('Perfil de usuário excluído com sucesso!', 'success');
    }
    this.closeConfirmModal();
  }
}
