
import { Injectable, signal, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

// Interfaces should match the DB schema from banco.sql

export interface Printer {
  id: string;
  company_id: string;
  client_id?: string;
  client_name?: string; // This will be joined
  location: string;
  sector: string;
  asset_number: string;
  model: string;
  serial_number: string;
  adf_processor: boolean;
  ak_748: boolean;
  finisher: boolean;
  cabinet: boolean;
  transformer_number: string;
  installation_date: string;
  nst_nd: boolean;
  inst_ocr: boolean;
  queue: string;
  mac_address: string;
  ip_address: string;
  technician: string;
  installation_status: 'OK' | 'Pendente';
  created_at: string;
}

export interface User {
  id: string;
  full_name: string;
  email: string; // Not in user_profiles table, joined from auth.users
  department: string; 
  role: 'company_admin' | 'user';
  address?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  };
}

export interface PrintJob {
  id: number;
  user_id: string;
  user_name: string;
  printer_id: string;
  printer_name: string;
  document_name: string;
  total_pages: number;
  total_cost: number;
  printed_at: string;
}

export interface PrintRule {
  id: string;
  description: string;
  type: 'quota' | 'restriction';
  scope: 'user' | 'department';
  target_id: string; // user id or department name
  target_name: string;
  limit_pages: number | null;
  limit_cost: number | null;
  action: 'block' | 'alert';
  is_active: boolean;
}

export interface Client {
  id: string;
  company_id: string;
  company_name: string;
  trade_name: string;
  cnpj: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  status: 'Ativo' | 'Inativo';
  franchise_pages_bw: number;
  franchise_value_bw: number;
  franchise_pages_color: number;
  franchise_value_color: number;
  overage_cost_bw: number;
  overage_cost_color: number;
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  };
  created_at: string;
}

export interface MaintenanceSchedule {
    id: string;
    company_id: string;
    client_id: string;
    client_name: string; // Joined
    printers: { id: string; model: string; asset_number: string }[];
    type: 'Preventiva' | 'Corretiva';
    scheduled_date: string; // YYYY-MM-DD
    scheduled_time: string; // HH:mm
    technician: string;
    description: string;
    status: 'Agendada' | 'Em Andamento' | 'Concluída' | 'Cancelada';
    created_at: string;
}


export interface ManualCounterReading {
  id: string;
  company_id: string;
  client_id: string | null;
  printer_id: string;
  initial_date: string;
  final_date: string;
  initial_counter_bw: number;
  final_counter_bw: number;
  initial_counter_color: number;
  final_counter_color: number;
  created_at: string;
}

// Other interfaces remain the same as they were.
export interface PrinterCounters { printerId: string; general: { copy: { color: number; bw: number; }; print: { color: number; bw: number; }; total: { color: number; bw: number; }; }; paperSizes: { a4: { color: number; bw: number; }; b5: { color: number; bw: number; }; a5: { color: number; bw: number; }; folio: { color: number; bw: number; }; oficio: { color: number; bw: number; }; carta: { color: number; bw: number; }; meioCarta: { color: number; bw: number; }; banner1: { color: number; bw: number; }; banner2: { color: number; bw: number; }; outro1: { color: number; bw: number; }; outro2: { color: number; bw: number; }; }; scannedPages: { copy: number; other: number; total: number; }; duplex: { duplex: number; simplex: number; twoInOne: number; fourInOne: number; oneInOne: number; }; }
export interface OutsourcingContract { id: string; clientId: string; clientName: string; printerId: string; printerModel: string; printerSerialNumber: string; startDate: string; endDate: string; initialCounterBw: number; finalCounterBw: number; initialCounterColor: number; finalCounterColor: number; costPerPageBw: number; costPerPageColor: number; includedPagesBw: number; includedPagesColor: number; status: 'Aberto' | 'Faturado'; }
export interface MaintenanceChecklistItem { name: string; status: 'OK' | 'PENDENTE' | 'N/A'; observation: string; }
export interface PreventiveMaintenance { id: string; date: string; time: string; printerId: string; assetNumber: string; equipmentModel: string; clientId: string; clientName: string; city: string; technicianName: string; clientSignatureName?: string; technicianSignature?: string; recommendations: string; checklist: MaintenanceChecklistItem[]; }


@Injectable({
  providedIn: 'root',
})
export class DataService {
  private supabase = inject(SupabaseService).supabase;
  private authService = inject(AuthService);

  private printersSignal = signal<Printer[]>([]);
  printers = this.printersSignal.asReadonly();

  private usersSignal = signal<User[]>([]);
  users = this.usersSignal.asReadonly();

  private clientsSignal = signal<Client[]>([]);
  clients = this.clientsSignal.asReadonly();
  
  private maintenanceSchedulesSignal = signal<MaintenanceSchedule[]>([]);
  maintenanceSchedules = this.maintenanceSchedulesSignal.asReadonly();
  
  private printJobsSignal = signal<PrintJob[]>([]);
  printJobs = this.printJobsSignal.asReadonly();

  private manualCounterReadingsSignal = signal<ManualCounterReading[]>([]);
  manualCounterReadings = this.manualCounterReadingsSignal.asReadonly();

  // FIX: Added rules signal to support the rules feature.
  private rulesSignal = signal<PrintRule[]>([]);
  rules = this.rulesSignal.asReadonly();

  // These will remain with mock data for now as they are not editable in the UI
  // and are used for display/reporting features that are secondary to the core CRUD functionality.
  private printerCountersSignal = signal<PrinterCounters[]>([]);
  printerCounters = this.printerCountersSignal.asReadonly();
  private outsourcingContractsSignal = signal<OutsourcingContract[]>([]);
  outsourcingContracts = this.outsourcingContractsSignal.asReadonly();
  private preventiveMaintenancesSignal = signal<PreventiveMaintenance[]>([]);
  preventiveMaintenances = this.preventiveMaintenancesSignal.asReadonly();

  technicians = computed(() => [...new Set(this.users().map(u => u.full_name))]);

  dashboardSummary = computed(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const pagesByPrinterMap = new Map<string, number>();
    const costByClientMap = new Map<string, number>();

    // 1. Process automatic print jobs
    const jobs = this.printJobs();
    const monthlyJobs = jobs.filter(j => new Date(j.printed_at) >= startOfMonth);
    let totalCostFromJobs = 0;
    let totalPrintsFromJobs = 0;
    monthlyJobs.forEach(job => {
        totalCostFromJobs += job.total_cost || 0;
        totalPrintsFromJobs += job.total_pages || 0;
        
        const printer = this.printers().find(p => p.id === job.printer_id);
        if (printer) {
            pagesByPrinterMap.set(printer.model, (pagesByPrinterMap.get(printer.model) || 0) + (job.total_pages || 0));

            const client = printer.client_id ? this.clients().find(c => c.id === printer.client_id) : null;
            const clientName = client?.trade_name || 'Uso Interno';
            costByClientMap.set(clientName, (costByClientMap.get(clientName) || 0) + (job.total_cost || 0));
        }
    });

    // 2. Process manual counter readings
    const manualReadings = this.manualCounterReadings();
    const monthlyReadings = manualReadings.filter(r => new Date(r.final_date + 'T00:00:00') >= startOfMonth);
    let totalCostFromReadings = 0;
    let totalPrintsFromReadings = 0;
    monthlyReadings.forEach(reading => {
        const printer = this.printers().find(p => p.id === reading.printer_id);
        const client = printer?.client_id ? this.clients().find(c => c.id === printer.client_id) : null;
        
        const producedBw = reading.final_counter_bw - reading.initial_counter_bw;
        const producedColor = reading.final_counter_color - reading.initial_counter_color;
        const totalPrintsForReading = producedBw + producedColor;
        totalPrintsFromReadings += totalPrintsForReading;

        if (printer) {
            pagesByPrinterMap.set(printer.model, (pagesByPrinterMap.get(printer.model) || 0) + totalPrintsForReading);
        }
        
        const franchiseBw = client?.franchise_pages_bw ?? 0;
        const franchiseValueBw = client?.franchise_value_bw ?? 0;
        const franchiseColor = client?.franchise_pages_color ?? 0;
        const franchiseValueColor = client?.franchise_value_color ?? 0;
        const costBw = client?.overage_cost_bw ?? 0;
        const costColor = client?.overage_cost_color ?? 0;
        const exceededBwPages = Math.max(0, producedBw - franchiseBw);
        const exceededColorPages = Math.max(0, producedColor - franchiseColor);
        const overageCostBw = exceededBwPages * costBw;
        const overageCostColor = exceededColorPages * costColor;
        const totalBilling = franchiseValueBw + franchiseValueColor + overageCostBw + overageCostColor;
        totalCostFromReadings += totalBilling;

        const clientName = client?.trade_name || 'Uso Interno';
        costByClientMap.set(clientName, (costByClientMap.get(clientName) || 0) + totalBilling);
    });

    // 3. Combine totals
    const totalPrints = totalPrintsFromJobs + totalPrintsFromReadings;
    const totalCost = totalCostFromJobs + totalCostFromReadings;

    // 4. Finalize chart data
    const pagesByPrinter = Array.from(pagesByPrinterMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const costByClient = Array.from(costByClientMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    return {
        totalPrints,
        totalCost,
        activePrinters: this.printers().filter(p => p.installation_status === 'OK').length,
        users: this.users().length,
        costByClient,
        pagesByPrinter,
    };
  });

  recentActivity = computed(() => {
    type ActivityItem = {
      id: string;
      user_name: string;
      printer_name: string;
      document_name: string;
      total_pages: number;
      total_cost: number;
      printed_at: string;
    };

    const jobs: ActivityItem[] = this.printJobs().map(job => ({
      ...job,
      id: `job-${job.id}`
    }));

    const readings = this.manualCounterReadings();
    const printers = this.printers();
    const clients = this.clients();

    const transformedReadings: ActivityItem[] = readings.map(reading => {
      const printer = printers.find(p => p.id === reading.printer_id);
      const client = printer?.client_id ? clients.find(c => c.id === printer.client_id) : null;
      
      const producedBw = reading.final_counter_bw - reading.initial_counter_bw;
      const producedColor = reading.final_counter_color - reading.initial_counter_color;
      
      const franchiseBw = client?.franchise_pages_bw ?? 0;
      const franchiseValueBw = client?.franchise_value_bw ?? 0;
      const franchiseColor = client?.franchise_pages_color ?? 0;
      const franchiseValueColor = client?.franchise_value_color ?? 0;
      const costBw = client?.overage_cost_bw ?? 0;
      const costColor = client?.overage_cost_color ?? 0;
      const exceededBwPages = Math.max(0, producedBw - franchiseBw);
      const exceededColorPages = Math.max(0, producedColor - franchiseColor);
      const overageCostBw = exceededBwPages * costBw;
      const overageCostColor = exceededColorPages * costColor;
      const totalBilling = franchiseValueBw + franchiseValueColor + overageCostBw + overageCostColor;

      return {
        id: `manual-${reading.id}`,
        user_name: 'Leitura Manual',
        printer_name: printer?.model || 'N/A',
        document_name: `Faturamento: ${client?.trade_name || 'Uso Interno'}`,
        total_pages: producedBw + producedColor,
        total_cost: totalBilling,
        printed_at: reading.final_date + 'T23:59:59',
      };
    });

    const combined = [...jobs, ...transformedReadings];

    return combined
        .sort((a, b) => new Date(b.printed_at).getTime() - new Date(a.printed_at).getTime())
        .slice(0, 10);
  });


  async loadCompanyData() {
    const profile = this.authService.currentUser();
    if (!profile?.company_id) {
      this.clearData();
      return;
    }
    const companyId = profile.company_id;

    // Fetch all data in parallel
    const [
      clientsRes,
      printersRes,
      usersRes,
      maintenanceRes,
      printJobsRes,
      manualCountersRes,
      maintenanceReportsRes,
    ] = await Promise.all([
      this.supabase.from('clients').select('*').eq('company_id', companyId),
      this.supabase.from('printers').select('*, clients(trade_name)').eq('company_id', companyId),
      this.supabase.from('user_profiles').select('*').eq('company_id', companyId),
      this.supabase.from('maintenance_schedules').select('*, clients(trade_name), maintenance_schedule_printers(printers(*))').eq('company_id', companyId),
      this.supabase.from('print_jobs').select('*, user_profiles(full_name), printers(model)').eq('company_id', companyId),
      this.supabase.from('manual_counter_readings').select('*').eq('company_id', companyId),
      this.supabase.from('preventive_maintenances').select('*').eq('company_id', companyId),
    ]);
    
    // Set signals with fetched data
    if (clientsRes.data) this.clientsSignal.set(clientsRes.data);
    if (printersRes.data) {
        const mappedPrinters = printersRes.data.map((p: any) => ({
            ...p,
            client_name: p.clients?.trade_name || ''
        }));
        this.printersSignal.set(mappedPrinters);
    }
    if (usersRes.data) this.usersSignal.set(usersRes.data as User[]);
    if(maintenanceRes.data) {
        const mappedSchedules = maintenanceRes.data.map((s: any) => ({
            ...s,
            client_name: s.clients?.trade_name || '',
            printers: s.maintenance_schedule_printers.map((msp: any) => msp.printers)
        }));
        this.maintenanceSchedulesSignal.set(mappedSchedules);
    }
    if (printJobsRes.data) {
      const mappedJobs = printJobsRes.data.map((j: any) => ({
          id: j.id,
          user_id: j.user_id,
          user_name: j.user_profiles?.full_name || 'Usuário Desconhecido',
          printer_id: j.printer_id,
          printer_name: j.printers?.model || 'Impressora Desconhecida',
          document_name: j.document_name,
          total_pages: j.total_pages,
          total_cost: j.total_cost,
          printed_at: j.printed_at
      }));
      this.printJobsSignal.set(mappedJobs);
    }
    if(manualCountersRes.data) this.manualCounterReadingsSignal.set(manualCountersRes.data);
    if (maintenanceReportsRes.data) {
        const mappedReports = maintenanceReportsRes.data.map((r: any) => ({
            id: r.id,
            ...r.report_data
        }));
        this.preventiveMaintenancesSignal.set(mappedReports as PreventiveMaintenance[]);
    }
  }

  clearData() {
    this.printersSignal.set([]);
    this.usersSignal.set([]);
    this.clientsSignal.set([]);
    this.maintenanceSchedulesSignal.set([]);
    this.rulesSignal.set([]);
    this.printJobsSignal.set([]);
    this.manualCounterReadingsSignal.set([]);
    this.preventiveMaintenancesSignal.set([]);
  }

  // --- CRUD Methods ---
  private getCompanyId(): string | undefined {
    return this.authService.currentUser()?.company_id;
  }

  // Printers
  async addPrinter(printer: Omit<Printer, 'id' | 'company_id' | 'created_at'>): Promise<boolean> {
    const company_id = this.getCompanyId();
    if (!company_id) return false;

    // The 'printer' object from the form contains 'client_name', which doesn't exist in the DB table.
    // We must remove it before the insert operation.
    const { client_name, ...dbPrinter } = printer as any;

    const { data, error } = await this.supabase
      .from('printers')
      .insert({ ...dbPrinter, company_id })
      .select('*, clients(trade_name)')
      .single();
      
    if (error) {
      console.error("Error adding printer:", error);
      return false;
    }

    if (data) {
      const newPrinter = { ...data, client_name: data.clients?.trade_name || '' };
      this.printersSignal.update(printers => [...printers, newPrinter]);
      return true;
    }

    return false;
  }

  async updatePrinter(updatedPrinter: Printer): Promise<boolean> {
    const { client_name, ...dbPrinter } = updatedPrinter;
    const { data, error } = await this.supabase.from('printers').update(dbPrinter).eq('id', dbPrinter.id).select('*, clients(trade_name)').single();
    
    if (error) {
      console.error("Error updating printer:", error);
      return false;
    }
    
    if (data) {
      this.printersSignal.update(printers => printers.map(p => p.id === data.id ? { ...data, client_name: data.clients?.trade_name || '' } : p));
      return true;
    }
    
    return false;
  }

  async deletePrinter(id: string) {
    const { error } = await this.supabase.from('printers').delete().eq('id', id);
    if (!error) this.printersSignal.update(printers => printers.filter(p => p.id !== id));
    if (error) console.error(error);
  }

  // Users
  async addUser(user: Omit<User, 'id'>) {
     console.warn("addUser is not fully implemented without an invitation flow.");
     // This will create a profile without a login.
     const company_id = this.getCompanyId();
     if (!company_id) return;
     const { data, error } = await this.supabase.from('user_profiles').insert({ ...user, company_id }).select().single();
     if(data) this.usersSignal.update(users => [...users, data as User]);
     if (error) console.error(error);
  }

  async updateUser(updatedUser: User) {
    const { email, ...dbUser } = updatedUser;
    const { data, error } = await this.supabase.from('user_profiles').update(dbUser).eq('id', dbUser.id).select().single();
    if (data) this.usersSignal.update(users => users.map(u => u.id === data.id ? { ...(data as User), email } : u));
    if (error) console.error(error);
  }
  
  async deleteUser(id: string) {
    // Note: This only deletes the profile. The auth user would need to be deleted separately with admin rights.
    const { error } = await this.supabase.from('user_profiles').delete().eq('id', id);
    if (!error) this.usersSignal.update(users => users.filter(u => u.id !== id));
    if (error) console.error(error);
  }

  // Clients
  async addClient(client: Omit<Client, 'id' | 'company_id' | 'created_at'>) {
     const company_id = this.getCompanyId();
     if (!company_id) return;
     const { data, error } = await this.supabase.from('clients').insert({ ...client, company_id }).select().single();
     if(data) this.clientsSignal.update(clients => [...clients, data]);
     if (error) console.error(error);
  }
  async updateClient(updatedClient: Client) {
    const { data, error } = await this.supabase.from('clients').update(updatedClient).eq('id', updatedClient.id).select().single();
    if (data) this.clientsSignal.update(clients => clients.map(c => c.id === data.id ? data : c));
    if (error) console.error(error);
  }
  async deleteClient(id: string) {
    const { error } = await this.supabase.from('clients').delete().eq('id', id);
    if (!error) this.clientsSignal.update(clients => clients.filter(c => c.id !== id));
    if (error) console.error(error);
  }
  
  // Maintenance
  async addMaintenance(schedule: Omit<MaintenanceSchedule, 'id' | 'created_at' | 'client_name'>) {
    const company_id = this.getCompanyId();
    if (!company_id) return;
    const { printers, ...mainSchedule } = schedule;
    const { data, error } = await this.supabase.from('maintenance_schedules').insert({ ...mainSchedule, company_id }).select().single();
    if (error || !data) { console.error(error); return; }
    
    const printerLinks = printers.map(p => ({ schedule_id: data.id, printer_id: p.id }));
    await this.supabase.from('maintenance_schedule_printers').insert(printerLinks);
    
    // Refetch to get joined data for signal
    const { data: newSchedule } = await this.supabase.from('maintenance_schedules').select('*, clients(trade_name), maintenance_schedule_printers(printers(*))').eq('id', data.id).single();
    if(newSchedule) this.maintenanceSchedulesSignal.update(schedules => [...schedules, { ...newSchedule, client_name: newSchedule.clients.trade_name, printers: newSchedule.maintenance_schedule_printers.map((p:any) => p.printers) }]);
  }

  async updateMaintenance(updatedSchedule: MaintenanceSchedule) {
    const { id, status } = updatedSchedule;
    
    const { error } = await this.supabase
      .from('maintenance_schedules')
      .update({ status: status })
      .eq('id', id);

    if (error) {
      console.error("Error updating maintenance status:", error);
      return;
    }

    this.maintenanceSchedulesSignal.update(currentSchedules => 
      currentSchedules.map(schedule => 
        schedule.id === id 
          ? { ...schedule, status: status }
          : schedule
      )
    );
  }

  async deleteMaintenance(id: string) {
    const { error } = await this.supabase.from('maintenance_schedules').delete().eq('id', id);
    if (!error) this.maintenanceSchedulesSignal.update(s => s.filter(x => x.id !== id));
    if (error) console.error(error);
  }

  async deleteMaintenances(idsToDelete: Set<string>) {
    const { error } = await this.supabase.from('maintenance_schedules').delete().in('id', Array.from(idsToDelete));
    if (!error) this.maintenanceSchedulesSignal.update(s => s.filter(x => !idsToDelete.has(x.id)));
    if (error) console.error(error);
  }

  async addManualCounterReading(reading: Omit<ManualCounterReading, 'id' | 'company_id' | 'created_at'>): Promise<boolean> {
    const company_id = this.getCompanyId();
    if (!company_id) return false;

    const { data, error } = await this.supabase.from('manual_counter_readings').insert({ ...reading, company_id }).select().single();
    
    if (error) {
      console.error('Error adding manual counter reading:', error);
      return false;
    }
    
    if (data) {
      this.manualCounterReadingsSignal.update(readings => [...readings, data]);
      return true;
    }
    
    return false;
  }

  async deleteManualCounterReadings(idsToDelete: Set<string>): Promise<void> {
    const { error } = await this.supabase.from('manual_counter_readings').delete().in('id', Array.from(idsToDelete));
    if (!error) {
      this.manualCounterReadingsSignal.update(readings => readings.filter(reading => !idsToDelete.has(reading.id)));
    } else {
      console.error('Error deleting manual counter readings:', error);
    }
  }

  async addPreventiveMaintenance(maintenance: PreventiveMaintenance): Promise<{ success: boolean; error?: string }> {
    const company_id = this.getCompanyId();
    if (!company_id) {
      console.error("[DEBUG] Falha ao obter company_id. Usuário não autenticado?");
      return { success: false, error: 'Usuário não autenticado.' };
    }

    const { id, ...report_data } = maintenance;
    if (!id || !id.includes('_')) {
      console.error("[DEBUG] ID do relatório inválido ou sem separador '_'. ID recebido:", id);
      return { success: false, error: 'ID do relatório inválido.' };
    }
    const [schedule_id, printer_id] = id.split('_');
    
    // DEBUG LOGS
    console.log("--- [DEBUG] addPreventiveMaintenance ---");
    console.log("ID Completo:", id);
    console.log("ID do Agendamento (extraído):", schedule_id);
    console.log("ID da Impressora (extraído):", printer_id);
    console.log("ID da Empresa:", company_id);
    console.log("Dados do Relatório (JSONB):", report_data);

    const insertPayload = { id, company_id, schedule_id, printer_id, report_data };
    console.log("Payload a ser inserido no Supabase:", insertPayload);

    const { data, error } = await this.supabase
      .from('preventive_maintenances')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      // Most detailed error possible
      console.error("[DEBUG] Erro retornado pelo Supabase ao inserir:", JSON.stringify(error, null, 2));
      return { success: false, error: `Código: ${error.code} | Detalhes: ${error.details} | Hint: ${error.hint} | Mensagem: ${error.message}` };
    } 
    
    if (data) {
      console.log("[DEBUG] Inserção no Supabase bem-sucedida. Dados retornados:", data);
      this.preventiveMaintenancesSignal.update(maintenances => [...maintenances, maintenance]);
      return { success: true };
    }

    console.error("[DEBUG] Falha desconhecida. Nenhum dado ou erro retornado pelo Supabase.");
    return { success: false, error: 'Falha desconhecida ao inserir dados. A resposta do servidor foi vazia.' };
  }
  
  // MOCKED for now
  // FIX: Added mock methods for rules management.
  addRule(rule: Omit<PrintRule, 'id'>): void { const newRule: PrintRule = { id: `pr-${Date.now()}`, ...rule, target_name: rule.target_name || rule.target_id }; this.rulesSignal.update(rules => [...rules, newRule]); }
  updateRule(updatedRule: PrintRule): void { this.rulesSignal.update(rules => rules.map(r => r.id === updatedRule.id ? updatedRule : r)); }
  deleteRule(id: string): void { this.rulesSignal.update(rules => rules.filter(r => r.id !== id)); }
  addOutsourcingContract(contract: Omit<OutsourcingContract, 'id'>): void { const newContract: OutsourcingContract = { id: `oc${Date.now()}`, ...contract }; this.outsourcingContractsSignal.update(contracts => [...contracts, newContract]); }
  updateOutsourcingContract(updatedContract: OutsourcingContract): void { this.outsourcingContractsSignal.update(contracts => contracts.map(c => c.id === updatedContract.id ? updatedContract : c)); }
  deleteOutsourcingContract(id: string): void { this.outsourcingContractsSignal.update(contracts => contracts.filter(c => c.id !== id)); }
  
  // --- API-like Methods for components ---
  getPrintJobsStream() { return toObservable(this.printJobs); }
  getDepartments() { return signal(['Financeiro', 'Marketing', 'RH', 'Diretoria', 'TI']).asReadonly(); }
  getPendingJobs() { return toObservable(signal([])); } // Mocked
  releaseJob(id: number) {}
  cancelJob(id: number) {}
}
