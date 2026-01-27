import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DataService, OutsourcingContract } from '../../services/data.service';
import { NotificationService } from '../../services/notification.service';
import { ReportService } from '../../services/report.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { OutsourcingFormComponent } from './outsourcing-form/outsourcing-form.component';

@Component({
  selector: 'app-billing',
  templateUrl: './billing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, ModalComponent, OutsourcingFormComponent],
  standalone: true,
})
export class BillingComponent {
  dataService = inject(DataService);
  notificationService = inject(NotificationService);
  reportService = inject(ReportService);

  contracts = this.dataService.outsourcingContracts;
  isModalOpen = signal(false);
  selectedContract = signal<OutsourcingContract | null>(null);
  isConfirmDeleteModalOpen = signal(false);
  contractToDelete = signal<OutsourcingContract | null>(null);

  modalTitle = computed(() => this.selectedContract() ? 'Editar Faturamento' : 'Adicionar Faturamento');

  contractsWithCalculations = computed(() => {
    return this.contracts().map(contract => {
      const totalPagesBw = contract.finalCounterBw - contract.initialCounterBw;
      const totalPagesColor = contract.finalCounterColor - contract.initialCounterColor;
      const exceededPagesBw = Math.max(0, totalPagesBw - contract.includedPagesBw);
      const exceededPagesColor = Math.max(0, totalPagesColor - contract.includedPagesColor);
      const totalCost = (exceededPagesBw * contract.costPerPageBw) + (exceededPagesColor * contract.costPerPageColor);
      return { ...contract, totalPagesBw, totalPagesColor, exceededPagesBw, exceededPagesColor, totalCost };
    });
  });

  openAddModal(): void {
    this.selectedContract.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(contract: OutsourcingContract): void {
    this.selectedContract.set(contract);
    this.isModalOpen.set(true);
  }

  async handleSave(contract: OutsourcingContract): Promise<void> {
    if (this.selectedContract()) {
      // This is mocked
      this.dataService.updateOutsourcingContract(contract);
      this.notificationService.show('Faturamento atualizado com sucesso!', 'success');
    } else {
      const { id, ...newContract } = contract;
      // This is mocked
      this.dataService.addOutsourcingContract(newContract);
      this.notificationService.show('Faturamento adicionado com sucesso!', 'success');
    }
    this.isModalOpen.set(false);
  }

  openConfirmDeleteModal(contract: OutsourcingContract): void {
    this.contractToDelete.set(contract);
    this.isConfirmDeleteModalOpen.set(true);
  }

  async handleDelete(): Promise<void> {
    const contract = this.contractToDelete();
    if (contract) {
      // This is mocked
      this.dataService.deleteOutsourcingContract(contract.id);
      this.notificationService.show('Faturamento excluído com sucesso!', 'success');
    }
    this.isConfirmDeleteModalOpen.set(false);
  }

  generateInvoice(contract: OutsourcingContract): void {
    this.reportService.generateOutsourcingPdf(
      contract,
      'Fatura de Outsourcing de Impressão',
      `fatura_${contract.clientName.replace(/\s/g, '_')}_${contract.startDate}.pdf`
    );
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  getStatusClass(status: 'Aberto' | 'Faturado'): string {
    switch (status) {
      case 'Aberto': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Faturado': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default: return '';
    }
  }
}
