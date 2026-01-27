import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService, Client } from '../../services/data.service';
import { NotificationService } from '../../services/notification.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { ClientFormComponent } from './client-form/client-form.component';
import { ReportService } from '../../services/report.service';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ModalComponent, ClientFormComponent]
})
export class ClientsComponent {
  dataService = inject(DataService);
  notificationService = inject(NotificationService);
  reportService = inject(ReportService);

  private allClients = this.dataService.clients;
  searchTerm = signal('');

  clients = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.allClients();
    return this.allClients().filter(client =>
      client.trade_name.toLowerCase().includes(term) ||
      client.cnpj.includes(term) ||
      client.contact_person.toLowerCase().includes(term) ||
      client.contact_email.toLowerCase().includes(term) ||
      client.status.toLowerCase().includes(term)
    );
  });
  
  isClientModalOpen = signal(false);
  selectedClient = signal<Client | null>(null);
  clientModalTitle = computed(() => this.selectedClient() ? `Editar Cliente: ${this.selectedClient()?.trade_name}` : 'Adicionar Novo Cliente');

  isConfirmClientDeleteModalOpen = signal(false);
  clientToDelete = signal<Client | null>(null);

  isDetailModalOpen = signal(false);
  clientForDetails = signal<Client | null>(null);

  selectedClientIds = signal(new Set<string>());

  isAllClientsSelected = computed(() => {
    const visibleClients = this.clients();
    if (visibleClients.length === 0) return false;
    const selectedIds = this.selectedClientIds();
    return visibleClients.every(client => selectedIds.has(client.id));
  });
  
  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  toggleSelection(id: string): void {
    this.selectedClientIds.update(ids => {
      const newIds = new Set(ids);
      newIds.has(id) ? newIds.delete(id) : newIds.add(id);
      return newIds;
    });
  }

  toggleSelectAll(): void {
    const visibleClientIds = this.clients().map(c => c.id);
    this.selectedClientIds.update(currentIds => {
      const newIds = new Set(currentIds);
      this.isAllClientsSelected() ? visibleClientIds.forEach(id => newIds.delete(id)) : visibleClientIds.forEach(id => newIds.add(id));
      return newIds;
    });
  }

  openAddClientModal(): void {
    this.selectedClient.set(null);
    this.isClientModalOpen.set(true);
  }

  openEditClientModal(client: Client): void {
    this.selectedClient.set(client);
    this.isClientModalOpen.set(true);
  }

  async handleSaveClient(client: Client): Promise<void> {
    if (this.selectedClient()) {
      await this.dataService.updateClient(client);
      this.notificationService.show('Cliente atualizado com sucesso!', 'success');
    } else {
      const { id, company_id, created_at, ...newClient } = client;
      await this.dataService.addClient(newClient as any);
      this.notificationService.show('Cliente adicionado com sucesso!', 'success');
    }
    this.isClientModalOpen.set(false);
  }

  openConfirmDeleteClientModal(client: Client): void {
    this.clientToDelete.set(client);
    this.isConfirmClientDeleteModalOpen.set(true);
  }

  async handleDeleteClient(): Promise<void> {
    const client = this.clientToDelete();
    if (client) {
      await this.dataService.deleteClient(client.id);
      this.notificationService.show('Cliente excluído com sucesso!', 'success');
    }
    this.isConfirmClientDeleteModalOpen.set(false);
  }

  openDetailModal(client: Client): void {
    this.clientForDetails.set(client);
    this.isDetailModalOpen.set(true);
  }

  closeDetailModal(): void {
    this.isDetailModalOpen.set(false);
    this.clientForDetails.set(null);
  }

  editClientFromDetails(): void {
    const clientToEdit = this.clientForDetails();
    if (clientToEdit) {
      this.closeDetailModal();
      this.openEditClientModal(clientToEdit);
    }
  }

  generateClientsPdf(): void {
    const allClients = this.clients();
    const selectedIds = this.selectedClientIds();
    const clientsToReport = selectedIds.size > 0 ? allClients.filter(c => selectedIds.has(c.id)) : allClients;

    if (clientsToReport.length > 0) {
      this.reportService.generateClientsPdf(clientsToReport, 'Relatório de Clientes', 'relatorio_clientes.pdf');
      this.notificationService.show(`Relatório PDF com ${clientsToReport.length} cliente(s) gerado com sucesso!`, 'success');
    } else {
      this.notificationService.show('Nenhum cliente selecionado para gerar o relatório.', 'info');
    }
  }
}
