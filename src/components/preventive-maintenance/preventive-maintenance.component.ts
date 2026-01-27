import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DataService, MaintenanceSchedule, Client } from '../../services/data.service';
import { NotificationService } from '../../services/notification.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { MaintenanceFormComponent } from '../clients/maintenance-form/maintenance-form.component';
import { ReportService } from '../../services/report.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-preventive-maintenance',
  templateUrl: './preventive-maintenance.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, ModalComponent, MaintenanceFormComponent],
  standalone: true,
  providers: [DatePipe],
})
export class PreventiveMaintenanceComponent {
  dataService = inject(DataService);
  notificationService = inject(NotificationService);
  reportService = inject(ReportService);
  router: Router = inject(Router);
  datePipe = inject(DatePipe);

  private allSchedules = this.dataService.maintenanceSchedules;
  searchTerm = signal('');

  schedules = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const all = this.allSchedules();
    if (!term) return all;

    return all.filter(schedule => {
        const dateStr = this.datePipe.transform(schedule.scheduled_date, 'dd/MM/yyyy') || '';
        const printersStr = schedule.printers.map(p => `${p.model} ${p.asset_number}`).join(' ').toLowerCase();

        return (
            schedule.client_name.toLowerCase().includes(term) ||
            dateStr.includes(term) ||
            schedule.scheduled_time.includes(term) ||
            printersStr.includes(term) ||
            schedule.type.toLowerCase().includes(term) ||
            schedule.technician.toLowerCase().includes(term) ||
            schedule.status.toLowerCase().includes(term)
        );
    });
  });

  isMaintenanceModalOpen = signal(false);
  selectedSchedule = signal<MaintenanceSchedule | null>(null);
  isConfirmMaintenanceDeleteModalOpen = signal(false);
  scheduleToDelete = signal<MaintenanceSchedule | null>(null);

  isDetailModalOpen = signal(false);
  scheduleForDetails = signal<MaintenanceSchedule | null>(null);

  clientForDetails = computed(() => {
    const schedule = this.scheduleForDetails();
    if (!schedule) return null;
    return this.dataService.clients().find(c => c.id === schedule.client_id) ?? null;
  });

  selectedScheduleIds = signal(new Set<string>());
  isConfirmDeleteSelectedModalOpen = signal(false);

  isAnyScheduleSelected = computed(() => this.selectedScheduleIds().size > 0);
  
  isAllSchedulesSelected = computed(() => {
    const visibleSchedules = this.schedules();
    if (visibleSchedules.length === 0) return false;
    const selectedIds = this.selectedScheduleIds();
    return visibleSchedules.every(s => selectedIds.has(s.id));
  });

  maintenanceModalTitle = computed(() => this.selectedSchedule() ? 'Editar Agendamento' : 'Novo Agendamento de Manutenção');

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  toggleSelection(id: string): void {
    this.selectedScheduleIds.update(ids => {
      const newIds = new Set(ids);
      newIds.has(id) ? newIds.delete(id) : newIds.add(id);
      return newIds;
    });
  }

  toggleSelectAll(): void {
    const visibleScheduleIds = this.schedules().map(s => s.id);
    this.selectedScheduleIds.update(currentIds => {
      const newIds = new Set(currentIds);
      this.isAllSchedulesSelected() ? visibleScheduleIds.forEach(id => newIds.delete(id)) : visibleScheduleIds.forEach(id => newIds.add(id));
      return newIds;
    });
  }

  openConfirmDeleteSelectedModal(): void {
    if (this.isAnyScheduleSelected()) this.isConfirmDeleteSelectedModalOpen.set(true);
  }

  async handleDeleteSelected(): Promise<void> {
    const idsToDelete = this.selectedScheduleIds();
    await this.dataService.deleteMaintenances(idsToDelete);
    this.notificationService.show(`${idsToDelete.size} agendamento(s) excluído(s) com sucesso!`, 'success');
    this.selectedScheduleIds.set(new Set());
    this.isConfirmDeleteSelectedModalOpen.set(false);
  }

  openAddMaintenanceModal(): void {
    this.selectedSchedule.set(null);
    this.isMaintenanceModalOpen.set(true);
  }

  openEditMaintenanceModal(schedule: MaintenanceSchedule): void {
    this.selectedSchedule.set(schedule);
    this.isMaintenanceModalOpen.set(true);
  }

  async handleSaveMaintenance(schedule: MaintenanceSchedule): Promise<void> {
    if (this.selectedSchedule()) {
      await this.dataService.updateMaintenance(schedule);
      this.notificationService.show('Agendamento atualizado com sucesso!', 'success');
    } else {
      const { id, company_id, created_at, client_name, ...newSchedule } = schedule;
      await this.dataService.addMaintenance(newSchedule as any);
      this.notificationService.show('Manutenção agendada com sucesso!', 'success');
    }
    this.isMaintenanceModalOpen.set(false);
  }

  openConfirmDeleteMaintenanceModal(schedule: MaintenanceSchedule): void {
    this.scheduleToDelete.set(schedule);
    this.isConfirmMaintenanceDeleteModalOpen.set(true);
  }
  
  async handleDeleteMaintenance(): Promise<void> {
    const schedule = this.scheduleToDelete();
    if (schedule) {
      await this.dataService.deleteMaintenance(schedule.id);
      this.notificationService.show('Agendamento excluído com sucesso!', 'success');
    }
    this.isConfirmMaintenanceDeleteModalOpen.set(false);
  }

  openDetailModal(schedule: MaintenanceSchedule): void {
    this.scheduleForDetails.set(schedule);
    this.isDetailModalOpen.set(true);
  }

  closeDetailModal(): void {
    this.isDetailModalOpen.set(false);
  }

  startMaintenance(scheduleId: string): void {
    this.closeDetailModal();
    this.router.navigate(['/maintenance-execution', scheduleId]);
  }

  generateDetailsPdf(): void {
    const schedule = this.scheduleForDetails();
    const client = this.clientForDetails();
    if (schedule) {
      this.reportService.generateMaintenanceDetailPdf(schedule, client);
      this.notificationService.show('PDF gerado com sucesso!', 'success');
    } else {
      this.notificationService.show('Não foi possível gerar o PDF. Dados incompletos.', 'error');
    }
  }

  formatPrintersList(printers: { model: string; asset_number: string }[]): string {
    if (!printers || printers.length === 0) return 'N/A';
    return printers.map(p => `${p.model} (${p.asset_number})`).join(', ');
  }

  formatPrintersShortList(printers: { model: string }[]): string {
    if (!printers || printers.length === 0) return 'N/A';
    return printers.map(p => p.model).join(', ');
  }

  getMaintenanceStatusClass(status: MaintenanceSchedule['status']): string {
    switch (status) {
      case 'Agendada': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Em Andamento': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Concluída': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Cancelada': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return '';
    }
  }
}
