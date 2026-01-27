
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService, PrintRule } from '../../services/data.service';
import { NotificationService } from '../../services/notification.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { RuleFormComponent } from './rule-form/rule-form.component';

@Component({
  selector: 'app-rules',
  templateUrl: './rules.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ModalComponent, RuleFormComponent]
})
export class RulesComponent {
  dataService = inject(DataService);
  notificationService = inject(NotificationService);

  rules = this.dataService.rules;
  isModalOpen = signal(false);
  selectedRule = signal<PrintRule | null>(null);
  modalTitle = signal('');

  isConfirmModalOpen = signal(false);
  ruleToDelete = signal<PrintRule | null>(null);

  openAddModal(): void {
    this.selectedRule.set(null);
    this.modalTitle.set('Adicionar Nova Regra');
    this.isModalOpen.set(true);
  }

  openEditModal(rule: PrintRule): void {
    this.selectedRule.set(rule);
    this.modalTitle.set(`Editar Regra: ${rule.description}`);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  handleSave(rule: PrintRule): void {
    if (this.selectedRule()) { // Editing
      this.dataService.updateRule(rule);
      this.notificationService.show('Regra atualizada com sucesso!', 'success');
    } else { // Adding
      const { id, ...newRule } = rule;
      this.dataService.addRule(newRule);
      this.notificationService.show('Regra adicionada com sucesso!', 'success');
    }
    this.closeModal();
  }

  openConfirmDeleteModal(rule: PrintRule): void {
    this.ruleToDelete.set(rule);
    this.isConfirmModalOpen.set(true);
  }

  closeConfirmModal(): void {
    this.isConfirmModalOpen.set(false);
    this.ruleToDelete.set(null);
  }

  handleDelete(): void {
    const rule = this.ruleToDelete();
    if (rule) {
      this.dataService.deleteRule(rule.id);
      this.notificationService.show('Regra excluída com sucesso!', 'success');
    }
    this.closeConfirmModal();
  }
}
