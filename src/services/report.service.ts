
import { Injectable, inject } from '@angular/core';
import { PrintJob, Printer, PrinterCounters, OutsourcingContract, PreventiveMaintenance, Client, ManualCounterReading, MaintenanceSchedule, DataService } from './data.service';
import { DatePipe } from '@angular/common';
import { AuthService } from './auth.service';

// This tells TypeScript that jspdf and its autoTable plugin exist as global variables,
// as they are loaded from a <script> tag in index.html.
declare var jspdf: any;
declare var pdfMake: any;

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private datePipe = new DatePipe('en-US');
  private dataService = inject(DataService);
  private authService = inject(AuthService);

  /**
   * Generates a CSV file from an array of print jobs and triggers a download.
   * @param data The array of PrintJob objects.
   * @param filename The desired filename for the downloaded file.
   */
  generateCsv(data: PrintJob[], filename: string): void {
    const header = ['Usuário', 'Impressora', 'Documento', 'Total de Páginas', 'Custo Total', 'Data da Impressão'];
    const csvRows = [header.join(',')];

    data.forEach(job => {
      const row = [
        `"${job.user_name}"`,
        `"${job.printer_name}"`,
        `"${job.document_name}"`,
        job.total_pages,
        job.total_cost.toFixed(2).replace('.', ','),
        `"${this.datePipe.transform(job.printed_at, 'dd/MM/yyyy HH:mm:ss')}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    this.downloadFile(csvContent, 'text/csv;charset=utf-8;', filename);
  }

  /**
   * Generates a PDF file from an array of print jobs and triggers a download.
   * @param data The array of PrintJob objects.
   * @param title The title to display at the top of the PDF document.
   * @param filename The desired filename for the downloaded file.
   */
  async generatePdf(data: PrintJob[], title: string, filename: string): Promise<void> {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();

    const startY = await this.drawHeader(doc, title);

    const head = [['Usuário', 'Impressora', 'Documento', 'Págs', 'Custo', 'Data']];
    const body = data.map(job => [
      job.user_name,
      job.printer_name,
      job.document_name,
      job.total_pages,
      job.total_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      this.datePipe.transform(job.printed_at, 'dd/MM/yy HH:mm') || ''
    ]);

    (doc as any).autoTable({
      startY,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [29, 78, 216] } // primary-700 color
    });

    doc.save(filename);
  }

  /**
   * Generates a CSV file from an array of printers and triggers a download.
   * @param data The array of Printer objects.
   * @param filename The desired filename for the downloaded file.
   */
  generatePrintersCsv(data: Printer[], filename: string): void {
    const header = [
      'Cliente', 'Localização', 'Setor', 'Patrimônio', 'Modelo', 'N° de Série',
      'Data Instalação', 'Fila', 'IP', 'MAC Address', 'Técnico', 'Status',
      'ADF', 'AK-748', 'Finalizador', 'Gabinete', 'NST. ND', 'INST. OCR', 'N° Transformador'
    ];
    const csvRows = [header.join(',')];

    data.forEach(p => {
      const row = [
        `"${p.client_name || 'Uso Interno'}"`,
        `"${p.location}"`, `"${p.sector}"`, `"${p.asset_number}"`, `"${p.model}"`, `"${p.serial_number}"`,
        `"${this.datePipe.transform(p.installation_date, 'dd/MM/yyyy')}"`,
        `"${p.queue}"`, `"${p.ip_address}"`, `"${p.mac_address}"`, `"${p.technician}"`, `"${p.installation_status}"`,
        p.adf_processor ? 'Sim' : 'Não',
        p.ak_748 ? 'Sim' : 'Não',
        p.finisher ? 'Sim' : 'Não',
        p.cabinet ? 'Sim' : 'Não',
        p.nst_nd ? 'Sim' : 'Não',
        p.inst_ocr ? 'Sim' : 'Não',
        `"${p.transformer_number}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    this.downloadFile(csvContent, 'text/csv;charset=utf-8;', filename);
  }

  /**
   * Generates a PDF file from an array of printers and triggers a download.
   * @param data The array of Printer objects.
   * @param title The title to display at the top of the PDF document.
   * @param filename The desired filename for the downloaded file.
   */
  async generatePrintersPdf(data: Printer[], title: string, filename: string): Promise<void> {
    const { jsPDF } = jspdf;
    const doc = new jsPDF('landscape');

    const startY = await this.drawHeader(doc, title);

    const head = [['Cliente', 'Localização', 'Modelo', 'N° Série', 'IP', 'Status']];
    const body = data.map(p => [
      p.client_name || 'Interno',
      p.location,
      p.model,
      p.serial_number,
      p.ip_address,
      p.installation_status
    ]);

    (doc as any).autoTable({
      startY,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [29, 78, 216] } // primary-700 color
    });

    doc.save(filename);
  }

  async generateClientsPdf(data: Client[], title: string, filename: string): Promise<void> {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    const primaryColor = '#1d4ed8'; // From tailwind config primary-700

    // Draw header first (awaits logo loading)
    let lastY = await this.drawHeader(doc, title);

    const head = [['Nome Fantasia', 'CNPJ', 'Contato', 'Email', 'Telefone', 'Cidade/UF', 'Status']];
    const body = data.map(client => [
      client.trade_name,
      client.cnpj,
      client.contact_person,
      client.contact_email,
      client.contact_phone,
      `${client.address.city}/${client.address.state}`,
      client.status
    ]);

    (doc as any).autoTable({
      startY: lastY + 5,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: '#ffffff',
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { cellWidth: 35 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 30 },
        5: { cellWidth: 'auto' },
        6: { cellWidth: 20, halign: 'center' },
      },
      alternateRowStyles: {
        fillColor: '#f9fafb' // gray-50
      },
      didDrawPage: (data: any) => {
        // Footer only
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
        const pageCount = doc.internal.getNumberOfPages();
        doc.setLineWidth(0.5);
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
        doc.setFontSize(8);
        doc.setTextColor('#6b7280'); // gray-500
        doc.text(`Página ${data.pageNumber} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
    });

    doc.save(filename);
  }

  generateCountersCsv(printer: Printer, counters: PrinterCounters, filename: string): void {
    let csvContent = `Relatório de Contadores para Impressora: ${printer.model} (${printer.serial_number})\n\n`;

    csvContent += "Contadores,Colorido,P&B,Total\n";
    csvContent += `Copiar,${counters.general.copy.color},${counters.general.copy.bw},${counters.general.copy.color + counters.general.copy.bw}\n`;
    csvContent += `Impressora,${counters.general.print.color},${counters.general.print.bw},${counters.general.print.color + counters.general.print.bw}\n`;
    csvContent += `Total,${counters.general.total.color},${counters.general.total.bw},${counters.general.total.bw + counters.general.total.color}\n\n`;

    csvContent += "Tamanho Papel,Colorido,P&B,Total\n";
    Object.entries(counters.paperSizes).forEach(([key, value]) => {
      const paperName = key.charAt(0).toUpperCase() + key.slice(1);
      csvContent += `${paperName},${value.color},${value.bw},${value.color + value.bw}\n`;
    });
    csvContent += "\n";

    csvContent += "Páginas Digitalizadas,Total\n";
    csvContent += `Copiar,${counters.scannedPages.copy}\n`;
    csvContent += `Outro,${counters.scannedPages.other}\n`;
    csvContent += `Total,${counters.scannedPages.total}\n\n`;

    csvContent += "Modo de Impressão,Total\n";
    csvContent += `Duplex,${counters.duplex.duplex}\n`;
    csvContent += `Uma face,${counters.duplex.simplex}\n`;
    csvContent += `2 em 1,${counters.duplex.twoInOne}\n`;
    csvContent += `4 em 1,${counters.duplex.fourInOne}\n`;
    csvContent += `1 em 1,${counters.duplex.oneInOne}\n`;

    this.downloadFile(csvContent, 'text/csv;charset=utf-8;', filename);
  }

  async generateCountersPdf(printer: Printer, counters: PrinterCounters, title: string, filename: string): Promise<void> {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    let lastY = await this.drawHeader(doc, title);

    doc.setFontSize(11);
    doc.setTextColor('#646464');
    doc.text(`Impressora: ${printer.model} | Serial: ${printer.serial_number}`, 14, lastY);
    lastY += 4;

    const autoTable = (doc as any).autoTable;

    autoTable({
      startY: lastY + 5,
      head: [['Contadores', 'Colorido', 'P&B', 'Total']],
      body: [
        ['Copiar', counters.general.copy.color, counters.general.copy.bw, counters.general.copy.color + counters.general.copy.bw],
        ['Impressora', counters.general.print.color, counters.general.print.bw, counters.general.print.color + counters.general.print.bw],
        ['Total', counters.general.total.color, counters.general.total.bw, counters.general.total.color + counters.general.total.bw]
      ],
      theme: 'grid',
      headStyles: { fillColor: [29, 78, 216] },
      didDrawPage: (data: any) => { lastY = data.cursor.y; }
    });

    autoTable({
      startY: lastY + 5,
      head: [['Tamanho Papel', 'Colorido', 'P&B', 'Total']],
      body: Object.entries(counters.paperSizes).map(([key, value]) => [
        key.charAt(0).toUpperCase() + key.slice(1),
        value.color,
        value.bw,
        value.color + value.bw
      ]),
      theme: 'grid',
      headStyles: { fillColor: [29, 78, 216] },
      didDrawPage: (data: any) => { lastY = data.cursor.y; }
    });

    const halfWidth = doc.internal.pageSize.width / 2;

    autoTable({
      startY: lastY + 5,
      head: [['Páginas Digitalizadas', 'Total']],
      body: [
        ['Copiar', counters.scannedPages.copy],
        ['Outro', counters.scannedPages.other],
        ['Total', counters.scannedPages.total]
      ],
      theme: 'grid',
      headStyles: { fillColor: [29, 78, 216] },
      tableWidth: halfWidth - 20,
      margin: { left: 14 },
      didDrawPage: (data: any) => { lastY = data.cursor.y; }
    });

    autoTable({
      startY: lastY + 5 - (doc.lastAutoTable.finalY - doc.lastAutoTable.startY),
      head: [['Modo de Impressão', 'Total']],
      body: [
        ['Duplex', counters.duplex.duplex],
        ['Uma face', counters.duplex.simplex],
        ['2 em 1', counters.duplex.twoInOne],
        ['4 em 1', counters.duplex.fourInOne],
        ['1 em 1', counters.duplex.oneInOne]
      ],
      theme: 'grid',
      headStyles: { fillColor: [29, 78, 216] },
      tableWidth: halfWidth - 20,
      margin: { left: halfWidth + 6 },
      didDrawPage: (data: any) => { lastY = Math.max(lastY, data.cursor.y); }
    });

    doc.save(filename);
  }

  async generateOutsourcingPdf(contract: OutsourcingContract, title: string, filename: string): Promise<void> {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    let lastY = await this.drawHeader(doc, title);

    doc.setFontSize(12);
    doc.text(`Cliente: ${contract.clientName}`, 14, lastY);
    lastY += 6;
    doc.text(`Impressora: ${contract.printerModel} (${contract.printerSerialNumber})`, 14, lastY);
    lastY += 6;
    doc.text(`Período: ${this.datePipe.transform(contract.startDate, 'dd/MM/yyyy')} a ${this.datePipe.transform(contract.endDate, 'dd/MM/yyyy')}`, 14, lastY);
    lastY += 10;

    const totalPagesBw = contract.finalCounterBw - contract.initialCounterBw;
    const totalPagesColor = contract.finalCounterColor - contract.initialCounterColor;
    const exceededPagesBw = Math.max(0, totalPagesBw - contract.includedPagesBw);
    const exceededPagesColor = Math.max(0, totalPagesColor - contract.includedPagesColor);
    const costBw = exceededPagesBw * contract.costPerPageBw;
    const costColor = exceededPagesColor * contract.costPerPageColor;
    const totalCost = costBw + costColor;

    (doc as any).autoTable({
      startY: lastY,
      head: [['Descrição', 'P&B (Monocromático)', 'Colorido']],
      body: [
        ['Contador Final', contract.finalCounterBw.toLocaleString('pt-BR'), contract.finalCounterColor.toLocaleString('pt-BR')],
        ['Contador Inicial', contract.initialCounterBw.toLocaleString('pt-BR'), contract.initialCounterColor.toLocaleString('pt-BR')],
        { content: 'Produção do Período', styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } },
        ['Total de Páginas', totalPagesBw.toLocaleString('pt-BR'), totalPagesColor.toLocaleString('pt-BR')],
      ],
      theme: 'grid',
      headStyles: { fillColor: [29, 78, 216] }
    });

    (doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Faturamento', 'P&B (Monocromático)', 'Colorido']],
      body: [
        ['Franquia Inclusa', contract.includedPagesBw.toLocaleString('pt-BR'), contract.includedPagesColor.toLocaleString('pt-BR')],
        ['Páginas Excedentes', exceededPagesBw.toLocaleString('pt-BR'), exceededPagesColor.toLocaleString('pt-BR')],
        ['Custo por Excedente', formatCurrency(contract.costPerPageBw), formatCurrency(contract.costPerPageColor)],
        { content: 'Custo Excedente', styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } },
        ['Total a Faturar', formatCurrency(costBw), formatCurrency(costColor)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [29, 78, 216] }
    });

    doc.setFontSize(14);
    doc.text(`Total Geral a Faturar: ${formatCurrency(totalCost)}`, 14, (doc as any).lastAutoTable.finalY + 15);


    doc.save(filename);
  }

  async generatePreventiveMaintenancePdf(data: PreventiveMaintenance[], filename: string): Promise<void> {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    const primaryColor = '#1d4ed8';

    // Await header drawing to ensure logo is loaded
    // Note: Since this report can have multiple pages (one per maintenance), 
    // we need to handle this carefully.

    // We will iterate and add pages.

    for (let i = 0; i < data.length; i++) {
      const report = data[i];
      if (i > 0) doc.addPage(); // Add new page for subsequent reports

      // Draw Standard Header
      let yPos = await this.drawHeader(doc, 'PLANO DE MANUTENÇÃO PREVENTIVA', { noLine: false });

      // Report Metadata Table (Client, Date, Equipment)
      const metadata = [
        ['Data:', `${this.datePipe.transform(report.date, 'dd/MM/yyyy')} ${report.time}`, 'Patrimônio:', report.assetNumber],
        ['Cliente:', report.clientName, 'Cidade:', report.city],
        ['Equipamento:', report.equipmentModel, 'Técnico:', report.technicianName]
      ];

      // We can use a simple autoTable for metadata or text. autoTable is cleaner.
      (doc as any).autoTable({
        startY: yPos + 5,
        body: metadata,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 25 },
          1: { cellWidth: 70 },
          2: { fontStyle: 'bold', cellWidth: 25 },
          3: { cellWidth: 'auto' }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Checklist Table
      const checklistHead = [['ITEM', 'OK', 'PENDENTE', 'N/A', 'OBSERVAÇÕES']];
      const checklistBody = report.checklist.map(item => [
        item.name,
        item.status === 'OK' ? 'X' : '',
        item.status === 'PENDENTE' ? 'X' : '',
        item.status === 'N/A' ? 'X' : '',
        item.observation || ''
      ]);

      (doc as any).autoTable({
        startY: yPos,
        head: checklistHead,
        body: checklistBody,
        theme: 'grid',
        headStyles: {
          fillColor: '#eeeeee',
          textColor: 'black',
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 'auto' }, // Item
          1: { cellWidth: 15, halign: 'center' }, // OK
          2: { cellWidth: 20, halign: 'center' }, // PENDENTE
          3: { cellWidth: 15, halign: 'center' }, // N/A
          4: { cellWidth: 50 } // OBS
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 20;

      // Signature / Footer Area
      // Check if we need a new page for signatures
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Recommendations
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Recomendações / Ações Corretivas:', 14, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const splitRecs = doc.splitTextToSize(report.recommendations || 'Nenhuma.', 180);
      doc.text(splitRecs, 14, yPos);
      yPos += (splitRecs.length * 5) + 15;

      // Signatures
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      const pageWidth = doc.internal.pageSize.width;

      // Client Signature Line
      doc.setLineWidth(0.5);
      doc.line(14, yPos, 90, yPos); // Line
      doc.setFontSize(8);
      doc.text('Assinatura do Cliente', 14, yPos + 5);

      // Date Line
      doc.line(110, yPos, 160, yPos);
      doc.text('Data', 110, yPos + 5);

      // Technician Signature
      yPos += 20;
      doc.line(14, yPos, 90, yPos);
      doc.text(`Técnico: ${report.technicianName}`, 14, yPos + 5);
    }

    doc.save(filename);
  }

  generatePreventiveMaintenanceDoc(data: PreventiveMaintenance[], filename: string): void {
    const pageBreak = `<br clear="all" style="page-break-before: always; mso-break-type: page-break;">`;
    let allPagesHtml = '';

    data.forEach((report, index) => {
      const checklistRows = report.checklist.map(item => `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.status === 'OK' ? 'X' : ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.status === 'PENDENTE' ? 'X' : ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.status === 'N/A' ? 'X' : ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.observation || ''}</td>
            </tr>
        `).join('');

      const singleReportHtml = `
            <div style="width: 100%; max-width: 800px; margin: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="font-size: 12pt; font-weight: bold;">ALUCOM SOLUÇÕES TECNOLÓGICAS</td>
                        <td style="border: 1px solid black; padding: 8px; text-align: center; font-weight: bold;">
                            PLANO DE MANUTENÇÃO PREVENTIVA EM EQUIPAMENTOS
                        </td>
                    </tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9pt;">
                    <tr>
                        <td style="border: 1px solid black; padding: 5px;"><b>Data:</b> ${this.datePipe.transform(report.date, 'dd/MM/yyyy')} ${report.time}</td>
                        <td style="border: 1px solid black; padding: 5px;"><b>Patrimônio:</b> ${report.assetNumber}</td>
                        <td style="border: 1px solid black; padding: 5px;"><b>Equipamento:</b> ${report.equipmentModel}</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="border: 1px solid black; padding: 5px;"><b>Cliente:</b> ${report.clientName}</td>
                        <td style="border: 1px solid black; padding: 5px;"><b>Cidade:</b> ${report.city}</td>
                    </tr>
                </table>

                <h3 style="margin-top: 20px; font-size: 11pt;">Checklist de Itens</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                    <thead style="background-color: #f2f2f2;">
                        <tr>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">ITEM</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">OK</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">PENDENTE</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">N/A</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">OBSERVAÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>${checklistRows}</tbody>
                </table>
                
                <div style="margin-top: 50px; font-size: 9pt;">
                    <table style="width: 100%;"><tr><td style="width: 60%;"><p>Assinatura do cliente:</p><div style="border-bottom: 1px solid black; height: 30px; margin-top: 20px;"></div></td><td style="width: 40%; text-align: right;"><p>Data: ____________________</p></td></tr></table>
                    <div style="border: 1px solid black; padding: 10px; margin-top: 20px; text-align: center;"><b>ÁREA DESTINADA AO RESPONSÁVEL TÉCNICO</b><table style="width: 100%; margin-top: 10px; text-align: left;"><tr><td style="width: 50%;">Técnico: ${report.technicianName}</td><td style="width: 50%;">Assinatura: <div style="border-bottom: 1px solid black; height: 20px; display: inline-block; width: 70%;"></div></td></tr></table></div>
                    <div style="border: 1px solid black; padding: 10px; margin-top: 10px; min-height: 50px;"><b>Recomendações/ações corretivas:</b><p>${report.recommendations || ''}</p></div>
                </div>
            </div>`;

      allPagesHtml += singleReportHtml;
      if (index < data.length - 1) {
        allPagesHtml += pageBreak;
      }
    });

    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Relatório de Manutenção</title></head>
        <body style="font-family: Arial, sans-serif; font-size: 10pt;">${allPagesHtml}</body>
        </html>`;
    this.downloadFile(htmlContent, 'application/msword', filename);
  }

  generatePreventiveMaintenanceXls(data: PreventiveMaintenance[], filename: string): void {
    let tableRows = '';
    data.forEach(report => {
      tableRows += `
            <tr>
                <td colspan="3" style="font-weight: bold; background-color: #eeeeee;">Relatório para ${report.equipmentModel} (Patrimônio: ${report.assetNumber})</td>
            </tr>
            <tr><td>Data</td><td colspan="2">${this.datePipe.transform(report.date, 'dd/MM/yyyy')} ${report.time}</td></tr>
            <tr><td>Cliente</td><td colspan="2">${report.clientName}</td></tr>
            <tr><td>Técnico</td><td colspan="2">${report.technicianName}</td></tr>
            <tr style="font-weight: bold;"><td>Item Checklist</td><td>Status</td><td>Observação</td></tr>
        `;
      report.checklist.forEach(item => {
        tableRows += `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.status}</td>
                    <td>${item.observation || ''}</td>
                </tr>
            `;
      });
      tableRows += `
            <tr><td>Recomendações</td><td colspan="2">${report.recommendations || 'Nenhuma.'}</td></tr>
            <tr><td colspan="3" style="background-color: #ffffff;"></td></tr>
        `;
    });

    const htmlContent = `
        <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset='utf-8'></head>
        <body>
            <h1>Relatórios de Manutenção Preventiva</h1>
            <table border="1">${tableRows}</table>
        </body>
        </html>`;
    this.downloadFile(htmlContent, 'application/vnd.ms-excel', filename);
  }

  generatePreventiveMaintenanceXml(data: PreventiveMaintenance[], filename: string): void {
    const escapeXml = (unsafe: string | undefined | null): string => {
      if (unsafe === null || unsafe === undefined) return '';
      return unsafe.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c] || c));
    };

    const reportsXml = data.map(report => {
      const checklistItems = report.checklist.map(item => `
            <item>
                <nome>${escapeXml(item.name)}</nome>
                <status>${item.status}</status>
                <observacao>${escapeXml(item.observation)}</observacao>
            </item>`).join('');
      return `
        <relatorioManutencao>
            <id>${report.id}</id>
            <data>${report.date}</data>
            <hora>${report.time}</hora>
            <cliente id="${report.clientId}">${escapeXml(report.clientName)}</cliente>
            <equipamento id="${report.printerId}">
                <modelo>${escapeXml(report.equipmentModel)}</modelo>
                <patrimonio>${escapeXml(report.assetNumber)}</patrimonio>
            </equipamento>
            <tecnico>${escapeXml(report.technicianName)}</tecnico>
            <checklist>${checklistItems}</checklist>
            <recomendacoes>${escapeXml(report.recommendations)}</recomendacoes>
        </relatorioManutencao>`;
    }).join('');

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
    <relatoriosManutencao>${reportsXml}</relatoriosManutencao>`;
    this.downloadFile(xmlContent.trim(), 'application/xml', filename);
  }

  generatePreventiveMaintenanceTxt(data: PreventiveMaintenance[], filename: string): void {
    const separator = `\n\n-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\n\n`;

    const txtContent = data.map(report => {
      let singleReportContent = `RELATÓRIO DE MANUTENÇÃO PREVENTIVA\n`;
      singleReportContent += `========================================\n`;
      singleReportContent += `Data: ${this.datePipe.transform(report.date, 'dd/MM/yyyy')} às ${report.time}\n`;
      singleReportContent += `Cliente: ${report.clientName}\n`;
      singleReportContent += `Equipamento: ${report.equipmentModel} (Patrimônio: ${report.assetNumber})\n`;
      singleReportContent += `Técnico: ${report.technicianName}\n`;
      singleReportContent += `========================================\n\n`;

      singleReportContent += `CHECKLIST DE ITENS\n`;
      singleReportContent += `----------------------------------------\n`;
      report.checklist.forEach(item => {
        singleReportContent += `- [${item.status.padEnd(8)}] ${item.name}\n`;
        if (item.observation) {
          singleReportContent += `  Observação: ${item.observation}\n`;
        }
      });
      singleReportContent += `----------------------------------------\n\n`;

      singleReportContent += `RECOMENDAÇÕES / AÇÕES CORRETIVAS\n`;
      singleReportContent += `----------------------------------------\n`;
      singleReportContent += `${report.recommendations || 'Nenhuma recomendação.'}\n`;
      singleReportContent += `----------------------------------------\n`;
      return singleReportContent;
    }).join(separator);

    this.downloadFile(txtContent, 'text/plain', filename);
  }


  generatePreventiveMaintenancesCsv(data: PreventiveMaintenance[], filename: string): void {
    const header = [
      'Data', 'Hora', 'Cliente', 'Cidade', 'Equipamento', 'Patrimônio', 'Técnico', 'Recomendações'
    ];
    const csvRows = [header.join(',')];

    data.forEach(m => {
      const row = [
        `"${this.datePipe.transform(m.date, 'dd/MM/yyyy')}"`,
        `"${m.time}"`,
        `"${m.clientName}"`,
        `"${m.city}"`,
        `"${m.equipmentModel}"`,
        `"${m.assetNumber}"`,
        `"${m.technicianName}"`,
        `"${m.recommendations.replace(/"/g, '""')}"` // Escape double quotes
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    this.downloadFile(csvContent, 'text/csv;charset=utf-8;', filename);
  }

  async generatePreventiveMaintenancesPdf(data: PreventiveMaintenance[], title: string, filename: string): Promise<void> {
    const { jsPDF } = jspdf;
    const doc = new jsPDF('landscape');

    const startY = await this.drawHeader(doc, title);

    const head = [['Data', 'Cliente', 'Equipamento', 'Patrimônio', 'Técnico']];
    const body = data.map(m => [
      this.datePipe.transform(m.date, 'dd/MM/yyyy') || '',
      m.clientName,
      m.equipmentModel,
      m.assetNumber,
      m.technicianName
    ]);

    (doc as any).autoTable({
      startY,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [29, 78, 216] } // primary-700 color
    });

    doc.save(filename);
  }

  async generateManualCountersPdf(client: Client | null, printer: Printer, history: (ManualCounterReading & { overageCostBw?: number; overageCostColor?: number; producedBw?: number; producedColor?: number; franchiseBw?: number; franchiseColor?: number; exceededBwPages?: number; exceededColorPages?: number; franchiseValueBw?: number; franchiseValueColor?: number; totalBilling?: number; })[], title: string, filename: string): Promise<void> {
    const { jsPDF } = jspdf;
    const doc = new jsPDF('landscape');
    let finalY = await this.drawHeader(doc, title);

    // Client Details
    doc.setFontSize(12);
    doc.setTextColor('#646464');
    doc.text('DADOS DO CLIENTE', 14, finalY);
    doc.setLineWidth(0.5);
    doc.line(14, finalY + 2, 200, finalY + 2);
    finalY += 10;

    if (client) {
      (doc as any).autoTable({
        startY: finalY,
        body: [
          ['Nome Fantasia:', client.trade_name],
          ['CNPJ:', client.cnpj],
          ['Endereço:', `${client.address.street}, ${client.address.number} - ${client.address.city}`],
          ['Contato:', `${client.contact_person} (${client.contact_phone})`],
        ],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { cellWidth: 'auto' } }
      });
      finalY = (doc as any).lastAutoTable.finalY;
    } else {
      doc.setFontSize(9);
      doc.text('Uso Interno', 14, finalY);
      finalY += 5;
    }


    // Printer Details
    doc.setFontSize(12);
    doc.setTextColor('#646464');
    doc.text('DADOS DA IMPRESSORA', 14, finalY + 8);
    doc.line(14, finalY + 10, 200, finalY + 10);
    finalY += 18;

    (doc as any).autoTable({
      startY: finalY,
      body: [
        ['Modelo:', printer.model],
        ['Patrimônio:', printer.asset_number],
        ['Nº de Série:', printer.serial_number],
        ['Localização:', `${printer.location} - ${printer.sector}`],
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { cellWidth: 'auto' } }
    });
    finalY = (doc as any).lastAutoTable.finalY;

    // History Table
    doc.setFontSize(12);
    doc.setTextColor('#646464');
    doc.text('HISTÓRICO DE LEITURAS', 14, finalY + 10);
    finalY += 12;

    const head = [['Período', 'Produção\n(P&B/Cor)', 'Franquia Pgs\n(P&B / Cor)', 'Valor Franquia\n(P&B / Cor)', 'Exced. Pgs\n(P&B / Cor)', 'Custo Exced.\n(P&B / Cor)', 'Total Faturado']];
    const body = history.map(item => [
      // FIX: Use snake_case properties 'initial_date' and 'final_date' from the ManualCounterReading type.
      `${this.datePipe.transform(item.initial_date, 'dd/MM/yy')} a ${this.datePipe.transform(item.final_date, 'dd/MM/yy')}`,
      `${(item.producedBw ?? 0).toLocaleString('pt-BR')} / ${(item.producedColor ?? 0).toLocaleString('pt-BR')}`,
      `${(item.franchiseBw ?? 0).toLocaleString('pt-BR')} / ${(item.franchiseColor ?? 0).toLocaleString('pt-BR')}`,
      `${(item.franchiseValueBw ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / ${(item.franchiseValueColor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      { content: `${(item.exceededBwPages ?? 0).toLocaleString('pt-BR')} / ${(item.exceededColorPages ?? 0).toLocaleString('pt-BR')}`, styles: { fontStyle: 'bold' } },
      `${(item.overageCostBw ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / ${(item.overageCostColor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      { content: (item.totalBilling ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), styles: { fontStyle: 'bold' } }
    ]);

    (doc as any).autoTable({
      startY: finalY,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [29, 78, 216] }, // primary-700 color
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      }
    });

    doc.save(filename);
  }

  async generateMaintenanceDetailPdf(schedule: MaintenanceSchedule, client: Client | null): Promise<void> {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    let yPos = await this.drawHeader(doc, 'Detalhes do Agendamento');
    const leftMargin = 14;
    const rightMargin = doc.internal.pageSize.width - 14;
    const colWidth = (rightMargin - leftMargin) / 2;
    yPos += 5;

    if (client) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalhes do Cliente', leftMargin, yPos);
      yPos += 5;
      doc.setLineWidth(0.5);
      doc.line(leftMargin, yPos, rightMargin, yPos); // Horizontal line
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const clientDetails = [
        { label: 'Nome Fantasia', value: client.trade_name },
        { label: 'CNPJ', value: client.cnpj },
        { label: 'Contato', value: client.contact_person },
        { label: 'Telefone', value: client.contact_phone },
        { label: 'CEP', value: client.address.zip },
        { label: 'Endereço Completo', value: `${client.address.street}, ${client.address.number} - ${client.address.neighborhood}, ${client.address.city} - ${client.address.state}`, span: 2 },
      ];

      clientDetails.forEach(detail => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${detail.label}:`, leftMargin, yPos);
        doc.setFont('helvetica', 'normal');
        const valueLines = doc.splitTextToSize(detail.value, colWidth * (detail.span || 1) - 5);
        doc.text(valueLines, leftMargin + 40, yPos);
        yPos += (valueLines.length * 5) + 3;
      });

      yPos += 5;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalhes do Agendamento', leftMargin, yPos);
    yPos += 5;
    doc.setLineWidth(0.5);
    doc.line(leftMargin, yPos, rightMargin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    const printersList = schedule.printers.map(p => `${p.model} (${p.asset_number})`).join(', ');

    const scheduleDetails = [
      { label: 'Data e Hora', value: `${this.datePipe.transform(schedule.scheduled_date, 'dd/MM/yyyy')} às ${schedule.scheduled_time}` },
      { label: 'Tipo', value: schedule.type },
      { label: 'Técnico', value: schedule.technician },
      { label: 'Status', value: schedule.status },
      { label: 'Impressoras', value: printersList, span: 2 },
      { label: 'Descrição', value: schedule.description, span: 2 }
    ];

    scheduleDetails.forEach(detail => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${detail.label}:`, leftMargin, yPos);
      doc.setFont('helvetica', 'normal');
      const valueLines = doc.splitTextToSize(detail.value, colWidth * (detail.span || 2) - 30);
      doc.text(valueLines, leftMargin + 30, yPos);
      yPos += (valueLines.length * 5) + 4;
    });

    const filename = `agendamento_${schedule.client_name.replace(/\s+/g, '_')}_${schedule.scheduled_date}.pdf`;
    doc.save(filename);
  }

  private async getBase64ImageFromURL(url: string): Promise<string> {
    try {
      const response = await fetch(url, { mode: 'cors' }); // Ensure CORS mode
      if (!response.ok) {
        console.error('Failed to fetch image:', response.statusText);
        return '';
      }
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Error loading image', e);
      return '';
    }
  }

  private drawHeaderContent(doc: any, title: string, companyName: string, options?: { noLine?: boolean, logoDataUrl?: string }): number {
    const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    const primaryColor = '#1d4ed8';

    // Company Name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor);

    // Calculate text width to position logo
    const textWidth = doc.getTextWidth(companyName);
    const textX = pageWidth - 14;
    doc.text(companyName, textX, 20, { align: 'right' });

    // Logo
    if (options?.logoDataUrl && options.logoDataUrl.length > 100) { // Simple check to ensure it's a real data URL
      const logoHeight = 15;
      const logoWidth = 15; // Aspect ratio might be an issue, assuming square or small icon
      // Position to the left of text
      const logoX = textX - textWidth - logoWidth - 5;

      try {
        // Auto-detect format from data URL if possible (jsPDF usually handles this if we omit format or match it)
        // If data URL starts with data:image/jpeg, passing 'PNG' makes it fail silently or show nothing.
        // Let's deduce format.
        let format = 'PNG';
        if (options.logoDataUrl.startsWith('data:image/jpeg') || options.logoDataUrl.startsWith('data:image/jpg')) {
          format = 'JPEG';
        }

        doc.addImage(options.logoDataUrl, format, logoX, 8, logoWidth, logoHeight);
      } catch (e) {
        console.warn('Could not add logo to PDF', e);
      }
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#374151'); // gray-700
    doc.text(title, 14, 22);

    if (!options?.noLine) {
      doc.setDrawColor('#d1d5db');
      doc.setLineWidth(0.5);
      doc.line(14, 30, pageWidth - 14, 30);
    }

    return 38; // The Y position where the content should start
  }

  private async drawHeader(doc: any, title: string, options?: { noLine?: boolean }): Promise<number> {
    const company = this.authService.currentUser()?.company_profile;
    const companyName = (company?.isCompanyProfileActive ? company?.tradeName : '') || 'HUB PRINT';

    let logoDataUrl = '';
    if (company?.logoUrl) {
      logoDataUrl = await this.getBase64ImageFromURL(company.logoUrl);
    }

    return this.drawHeaderContent(doc, title, companyName, { ...options, logoDataUrl });
  }

  /**
   * Creates a Blob from content and triggers a browser download.
   */
  private downloadFile(content: string, mimeType: string, filename: string): void {
    const blob = new Blob([`\uFEFF${content}`], { type: mimeType }); // \uFEFF for BOM to support special chars in Excel
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
