import Dexie, { Table } from 'dexie';
import {
    Printer,
    User,
    Client,
    MaintenanceSchedule,
    PrintJob,
    ManualCounterReading,
    PrintRule,
    OutsourcingContract,
    PreventiveMaintenance
} from './data.service';

export class AppDatabase extends Dexie {
    printers!: Table<Printer, string>;
    users!: Table<User, string>;
    clients!: Table<Client, string>;
    maintenanceSchedules!: Table<MaintenanceSchedule, string>;
    printJobs!: Table<PrintJob, number>; // PrintJob id is currently number in interface
    manualCounterReadings!: Table<ManualCounterReading, string>;
    rules!: Table<PrintRule, string>;
    preventiveMaintenances!: Table<PreventiveMaintenance, string>;
    outsourcingContracts!: Table<OutsourcingContract, string>;

    constructor() {
        super('HubPrintDB');
        this.version(1).stores({
            printers: 'id, company_id, model, client_id',
            users: 'id, company_id, full_name, email',
            clients: 'id, company_id, trade_name',
            maintenanceSchedules: 'id, company_id, status',
            printJobs: 'id, company_id, printer_id, user_id, printed_at',
            manualCounterReadings: 'id, company_id, printer_id, final_date',
            rules: 'id',
            preventiveMaintenances: 'id, company_id',
            outsourcingContracts: 'id'
        });
    }
}

export const db = new AppDatabase();
