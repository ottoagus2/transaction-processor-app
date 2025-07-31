import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import * as XLSX from 'xlsx';
// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputTextModule } from 'primeng/inputtext';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown'; // ⬅️ Importá este módulo


// Services



// Interfaces actualizadas para matching por RRN vs ARN
export interface TachRecord {
  id?: number;
  matchingKey: string; // RRN primeros 11 caracteres convertido a string

  // Campos específicos del archivo BO Tach
  rrn?: string; // RRN completo original
  medioDePago?: string;
  modoDePago?: string;
  idOperacion?: string;
  idOperador?: string;
  idOperacionMenta?: string;
  numeroOperacionMenta?: string;
  nombreOperador?: string;
  fechaHoraRealizacion?: string;
  fechaHoraAcreditacion?: string;
  familiaProducto?: string;
  tipoMovimiento?: string;
  marcaTarjeta?: string;
  montoBruto?: number;
  fechaPagoTach?: string;
  costoFinanciero?: number;
  comisionAdquiriente?: number;
  comisionTach?: number;
  netoRecibirMerchant?: number;
  rubroComercio?: string;

  // Campos mapeados para compatibilidad
  comercio?: string;
  importe?: number;
  fecha?: string;
  terminal?: string;
  referencia?: string;
  estado?: string;
  [key: string]: any;
}

export interface GlobalProcessingRecord {
  id?: number;
  matchingKey: string; // ARN caracteres 13-23 convertido a string

  // Campos del archivo T3000 Global Processing
  arnCorto?: string;
  numeroComercio?: string;
  numeroComercioCentral?: string;
  fechaProceso?: string;
  importeTransaccion?: number;
  codigoMoneda?: string;
  numeroTarjeta?: string;
  marcaTarjeta?: string;
  tipoProducto?: string;
  codigoMovimiento?: string;
  descripcionMovimiento?: string;
  cuotas?: number;
  fechaOperacion?: string;
  horaOperacion?: string;
  fechaOperacionOriginal?: string;
  fechaPago?: string;
  codigoAutorizacion?: string;
  numeroTerminal?: string;
  numeroLote?: string;
  numeroComprobante?: string;
  numeroSeguimiento?: string;
  categoriaComercio?: string;
  importeSinDescuento?: number;
  importeArancel?: number;
  ivaArancel?: number;
  descuentoFinanciacion?: number;
  ivaDescuentoFinanciacion?: number;
  arn?: string; // ARN completo original
  rrn?: string;

  [key: string]: any;
}

export interface MatchedRecord {
  id: number;
  matchingKey: string; // Clave de matching (RRN vs ARN)
  matchStatus: 'MATCHED' | 'UNMATCHED_TACH' | 'UNMATCHED_GLOBAL';
  tachRecord: TachRecord | null;
  globalRecord: GlobalProcessingRecord | null;

  // Campos combinados para mostrar en la tabla
  comercio?: string;
  importe?: number;
  fecha?: string;
  terminal?: string;
  tarjeta?: string;
  tipo?: string;
  descripcion?: string;
  marca?: string;
  referencia?: string;
  estado?: string;
  rrn?: string;
  arn?: string;
}

export interface MatchingSummary {
  totalTachRecords: number;
  totalGlobalRecords: number;
  totalMatches: number;
  totalUnmatchedTach: number;
  totalUnmatchedGlobal: number;
  matchPercentage: number;
}
@Component({
  selector: 'app-file-matcher',
  standalone: true,
  imports: [ // Angular Core Modules
      CommonModule,
      FormsModule,

      // PrimeNG Modules
      CardModule,
      ButtonModule,
      TableModule,
      ToastModule,
      DialogModule,
      TagModule,
      TooltipModule,
      ProgressSpinnerModule,
      InputTextModule,
       DropdownModule
    ],
    providers: [
      MessageService
    ],
  templateUrl: './file-matcher.component.html',
  styleUrl: './file-matcher.component.scss'
})
export class FileMatcherComponent implements OnInit {

  // Archivos seleccionados
  tachFile: File | null = null;
  globalFile: File | null = null;

  // Datos procesados
  tachRecords: TachRecord[] = [];
  globalRecords: GlobalProcessingRecord[] = [];
  matchedRecords: MatchedRecord[] = [];

  // Estados de la aplicación
  isLoading = false;
  showResults = false;
  showSummaryDialog = false;

  // Configuración de la tabla
  first = 0;
  rows = 25;

  // Resumen de matching
  summary: MatchingSummary = {
    totalTachRecords: 0,
    totalGlobalRecords: 0,
    totalMatches: 0,
    totalUnmatchedTach: 0,
    totalUnmatchedGlobal: 0,
    matchPercentage: 0
  };

  // Filtros
  selectedMatchStatus: string = '';
  matchStatusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Coincidencias', value: 'MATCHED' },
    { label: 'Tach sin coincidencia', value: 'UNMATCHED_TACH' },
    { label: 'Global sin coincidencia', value: 'UNMATCHED_GLOBAL' }
  ];

  constructor(private messageService: MessageService) {}

  ngOnInit(): void {}

  onTachFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.tachFile = target.files[0];
      this.validateFile(this.tachFile, 'Tach BackOffice');
    }
  }

  onGlobalFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.globalFile = target.files[0];
      this.validateFile(this.globalFile, 'Global Processing T3000');
    }
  }

  private validateFile(file: File, type: string): void {
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: `${type}: Solo se permiten archivos Excel (.xlsx, .xls)`
      });
      return;
    }

    this.messageService.add({
      severity: 'info',
      summary: 'Archivo seleccionado',
      detail: `${type}: ${file.name} - ${(file.size / 1024).toFixed(2)} KB`
    });
  }

  async processFiles(): Promise<void> {
    if (!this.tachFile || !this.globalFile) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Por favor selecciona ambos archivos'
      });
      return;
    }

    this.isLoading = true;
    this.showResults = false;

    try {
      // Procesar archivo de Tach
      console.log('Procesando archivo Tach BO...');
      this.tachRecords = await this.processTachFile(this.tachFile);

      // Procesar archivo de Global Processing
      console.log('Procesando archivo T3000...');
      this.globalRecords = await this.processGlobalFile(this.globalFile);

      // DEBUG: Verificar datos antes del matching
      this.debugMatching();

      // Realizar matching
      console.log('Realizando matching por RRN vs ARN...');
      this.performMatching();

      // Generar resumen
      this.generateSummary();

      this.showResults = true;
      this.isLoading = false;

      const message = `Matching completado por RRN vs ARN:
      - Registros BO: ${this.summary.totalTachRecords}
      - Registros T3000: ${this.summary.totalGlobalRecords}
      - Coincidencias: ${this.summary.totalMatches}
      - % Coincidencia: ${this.summary.matchPercentage.toFixed(2)}%`;

      this.messageService.add({
        severity: this.summary.totalMatches > 0 ? 'success' : 'warn',
        summary: this.summary.totalMatches > 0 ? 'Éxito' : 'Advertencia',
        detail: message
      });

    } catch (error: any) {
      this.isLoading = false;
      console.error('Error completo:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error al procesar los archivos: ' + error.message
      });
    }
  }

  /**
   * Extrae los primeros 11 caracteres del RRN para matching
   */
  private extractRRNMatchingKey(rrn: string): string {
    if (!rrn) return '';
    const rrnStr = rrn.toString();
    const first11 = rrnStr.substring(0, 11);
    console.log(`RRN original: "${rrn}" -> Primeros 11: "${first11}"`);
    return first11;
  }

  /**
   * Extrae los caracteres 13-23 del ARN para matching
   */
  private extractARNMatchingKey(arn: string): string {
    if (!arn) return '';
    const arnStr = arn.toString();
    const chars13to23 = arnStr.substring(12, 23); // substring(12, 23) extrae caracteres 13-23
    console.log(`ARN original: "${arn}" -> Chars 13-23: "${chars13to23}"`);
    return chars13to23;
  }

  /**
   * Procesa el archivo Excel de Tach (BackOffice) - Extrae primeros 11 chars de RRN
   */
  private async processTachFile(file: File): Promise<TachRecord[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const headers = jsonData[0] as string[];
          const records: TachRecord[] = [];

          console.log('Headers del archivo BO Tach:', headers);

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;

            const record: any = {};

            // Mapear headers a propiedades
            headers.forEach((header, index) => {
              if (row[index] !== undefined) {
                record[header] = row[index];
              }
            });

            // BUSCAR CAMPO RRN (obligatorio para matching)
            const rrnValue = record['RRN'] || record['rrn'] || record['Rrn'];

            if (rrnValue) {
              // Extraer primeros 11 caracteres del RRN
              const matchingKey = this.extractRRNMatchingKey(rrnValue);

              if (matchingKey) {
                const processedRecord: TachRecord = {
                  matchingKey: matchingKey,
                  rrn: rrnValue.toString(),

                  // Mapear campos específicos del BO
                  medioDePago: record['Medio de pago'] || '',
                  modoDePago: record['Modo de pago'] || '',
                  idOperacion: record['ID de operación'] || record['ID de operaciÃ³n'] || '',
                  nombreOperador: record['Nombre del operador'] || '',
                  fechaHoraRealizacion: record['Fecha y hora de realizaciÃ³n'] || '',
                  marcaTarjeta: record['Marca de la tarjeta'] || '',
                  montoBruto: this.parseAmount(record['Monto bruto']),
                  tipoMovimiento: record['Tipo de movimiento'] || '',
                  familiaProducto: record['Familia de producto'] || '',
                  rubroComercio: record['Rubro del comercio'] || '',

                  // Campos para compatibilidad en la tabla
                  comercio: record['Nombre del operador'] || '',
                  importe: this.parseAmount(record['Monto bruto']),
                  fecha: record['Fecha y hora de realizaciÃ³n'] || '',
                  referencia: record['Número de operación Menta'] || record['NÃºmero de operaciÃ³n Menta'] || '',
                  estado: record['Tipo de movimiento'] || '',
                  terminal: ''
                };

                records.push(processedRecord);
              }
            }
          }

          console.log(`Procesados ${records.length} registros de Tach BO con RRN válido`);
          if (records.length > 0) {
            console.log('Primer registro ejemplo Tach:', records[0]);
            console.log('Matching key ejemplo:', records[0].matchingKey);
          }

          resolve(records);
        } catch (error) {
          console.error('Error procesando archivo Tach:', error);
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Error al leer el archivo de Tach'));
      reader.readAsBinaryString(file);
    });
  }

  /**
   * Procesa el archivo Excel de Global Processing (T3000) - Extrae chars 13-23 de ARN
   */
  private async processGlobalFile(file: File): Promise<GlobalProcessingRecord[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const headers = jsonData[0] as string[];
          const records: GlobalProcessingRecord[] = [];

          console.log('Headers del archivo T3000:', headers);

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;

            const record: any = {};

            // Mapear headers a propiedades
            headers.forEach((header, index) => {
              if (row[index] !== undefined) {
                record[header] = row[index];
              }
            });

            // BUSCAR CAMPO ARN (obligatorio para matching)
            const arnValue = record['arn'] || record['ARN'] || record['Arn'];

            if (arnValue) {
              // Extraer caracteres 13-23 del ARN
              const matchingKey = this.extractARNMatchingKey(arnValue);

              if (matchingKey) {
                const processedRecord: GlobalProcessingRecord = {
                  matchingKey: matchingKey,
                  arn: arnValue.toString(),

                  // Mapear campos específicos del T3000
                  arnCorto: record['arn corto'] || '',
                  numeroComercio: record['numeroComercio'] || '',
                  numeroComercioCentral: record['numeroComercioCentral'] || '',
                  fechaProceso: record['fechaProceso'] || '',
                  importeTransaccion: this.parseAmount(record['importeTransaccion']),
                  codigoMoneda: record['codigoMoneda'] || '',
                  numeroTarjeta: record['numeroTarjeta'] || '',
                  marcaTarjeta: record['marcaTarjeta'] || '',
                  tipoProducto: record['tipoProducto'] || '',
                  descripcionMovimiento: record['descripcionMovimiento'] || '',
                  fechaOperacion: record['fechaOperacion'] || '',
                  numeroTerminal: record['numeroTerminal'] || '',
                  codigoAutorizacion: record['codigoAutorizacion'] || '',
                  rrn: record['rrn'] || ''
                };

                records.push(processedRecord);
              }
            }
          }

          console.log(`Procesados ${records.length} registros de T3000 con ARN válido`);
          if (records.length > 0) {
            console.log('Primer registro ejemplo T3000:', records[0]);
            console.log('Matching key ejemplo:', records[0].matchingKey);
          }

          resolve(records);
        } catch (error) {
          console.error('Error procesando archivo T3000:', error);
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Error al leer el archivo de Global Processing'));
      reader.readAsBinaryString(file);
    });
  }

  /**
   * Realiza el matching entre ambos archivos por RRN vs ARN
   */
  private performMatching(): void {
    this.matchedRecords = [];
    let idCounter = 1;

    // Crear mapa de Global Processing para búsqueda rápida por matching key
    const globalMap = new Map<string, GlobalProcessingRecord>();
    this.globalRecords.forEach(record => {
      globalMap.set(record.matchingKey, record);
    });

    // Crear set para trackear registros de Global ya matcheados
    const matchedGlobalKeys = new Set<string>();

    console.log('Iniciando matching...');
    console.log('Total registros Tach:', this.tachRecords.length);
    console.log('Total registros Global:', this.globalRecords.length);

    // Procesar registros de Tach
    this.tachRecords.forEach(tachRecord => {
      const globalRecord = globalMap.get(tachRecord.matchingKey);

      if (globalRecord) {
        // Coincidencia encontrada por matching key
        console.log(`MATCH ENCONTRADO: ${tachRecord.matchingKey}`);
        this.matchedRecords.push({
          id: idCounter++,
          matchingKey: tachRecord.matchingKey,
          matchStatus: 'MATCHED',
          tachRecord: tachRecord,
          globalRecord: globalRecord,
          comercio: tachRecord.comercio || globalRecord.numeroComercio || '',
          importe: tachRecord.importe || globalRecord.importeTransaccion || 0,
          fecha: tachRecord.fecha || globalRecord.fechaOperacion || '',
          terminal: globalRecord.numeroTerminal || '',
          tarjeta: globalRecord.numeroTarjeta || '',
          tipo: globalRecord.tipoProducto || '',
          descripcion: globalRecord.descripcionMovimiento || '',
          marca: tachRecord.marcaTarjeta || globalRecord.marcaTarjeta || '',
          referencia: tachRecord.referencia || '',
          estado: tachRecord.estado || '',
          rrn: tachRecord.rrn || globalRecord.rrn || '',
          arn: globalRecord.arn || ''
        });

        matchedGlobalKeys.add(tachRecord.matchingKey);
      } else {
        // Registro de Tach sin coincidencia
        this.matchedRecords.push({
          id: idCounter++,
          matchingKey: tachRecord.matchingKey,
          matchStatus: 'UNMATCHED_TACH',
          tachRecord: tachRecord,
          globalRecord: null,
          comercio: tachRecord.comercio || '',
          importe: tachRecord.importe || 0,
          fecha: tachRecord.fecha || '',
          terminal: '',
          tarjeta: '',
          tipo: '',
          descripcion: '',
          marca: tachRecord.marcaTarjeta || '',
          referencia: tachRecord.referencia || '',
          estado: tachRecord.estado || '',
          rrn: tachRecord.rrn || '',
          arn: ''
        });
      }
    });

    // Agregar registros de Global Processing que no tuvieron coincidencia
    this.globalRecords.forEach(globalRecord => {
      if (!matchedGlobalKeys.has(globalRecord.matchingKey)) {
        this.matchedRecords.push({
          id: idCounter++,
          matchingKey: globalRecord.matchingKey,
          matchStatus: 'UNMATCHED_GLOBAL',
          tachRecord: null,
          globalRecord: globalRecord,
          comercio: globalRecord.numeroComercio || '',
          importe: globalRecord.importeTransaccion || 0,
          fecha: globalRecord.fechaOperacion || '',
          terminal: globalRecord.numeroTerminal || '',
          tarjeta: globalRecord.numeroTarjeta || '',
          tipo: globalRecord.tipoProducto || '',
          descripcion: globalRecord.descripcionMovimiento || '',
          marca: globalRecord.marcaTarjeta || '',
          referencia: '',
          estado: '',
          rrn: globalRecord.rrn || '',
          arn: globalRecord.arn || ''
        });
      }
    });

    console.log(`Matching completado: ${this.matchedRecords.filter(r => r.matchStatus === 'MATCHED').length} coincidencias`);
  }

  /**
   * DEBUG: Verificar coincidencias por RRN vs ARN
   */
  debugMatching(): void {
    console.log('=== DEBUG MATCHING POR RRN vs ARN ===');
    console.log('Registros Tach BO:', this.tachRecords.length);
    console.log('Registros T3000:', this.globalRecords.length);

    if (this.tachRecords.length > 0) {
      console.log('Ejemplo RRN completo Tach:', this.tachRecords[0].rrn);
      console.log('Ejemplo matching key Tach (primeros 11):', this.tachRecords[0].matchingKey);
    }

    if (this.globalRecords.length > 0) {
      console.log('Ejemplo ARN completo T3000:', this.globalRecords[0].arn);
      console.log('Ejemplo matching key T3000 (chars 13-23):', this.globalRecords[0].matchingKey);
    }

    // Verificar coincidencias por matching key
    const tachKeys = this.tachRecords.map(r => r.matchingKey);
    const globalKeys = this.globalRecords.map(r => r.matchingKey);

    const coincidencias = tachKeys.filter(key => globalKeys.includes(key));
    console.log('Coincidencias por matching key:', coincidencias.length);
    console.log('Primeras 5 coincidencias:', coincidencias.slice(0, 5));

    // Mostrar algunos matching keys de cada archivo para comparar
    console.log('Primeros 5 matching keys Tach:', tachKeys.slice(0, 5));
    console.log('Primeros 5 matching keys T3000:', globalKeys.slice(0, 5));
  }

  /**
   * Método auxiliar para parsear importes
   */
  private parseAmount(amountStr: any): number {
    if (!amountStr) return 0;

    const cleanStr = amountStr.toString()
      .replace(/\$/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '.')
      .trim();

    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
  }

  private generateSummary(): void {
    const matches = this.matchedRecords.filter(r => r.matchStatus === 'MATCHED');
    const unmatchedTach = this.matchedRecords.filter(r => r.matchStatus === 'UNMATCHED_TACH');
    const unmatchedGlobal = this.matchedRecords.filter(r => r.matchStatus === 'UNMATCHED_GLOBAL');

    this.summary = {
      totalTachRecords: this.tachRecords.length,
      totalGlobalRecords: this.globalRecords.length,
      totalMatches: matches.length,
      totalUnmatchedTach: unmatchedTach.length,
      totalUnmatchedGlobal: unmatchedGlobal.length,
      matchPercentage: this.tachRecords.length > 0 ? (matches.length / this.tachRecords.length) * 100 : 0
    };
  }

  getFilteredRecords(): MatchedRecord[] {
    if (!this.selectedMatchStatus) {
      return this.matchedRecords;
    }
    return this.matchedRecords.filter(record => record.matchStatus === this.selectedMatchStatus);
  }

  getFilteredRecordsCount(): number {
    return this.getFilteredRecords().length;
  }

  getTotalUnmatched(): number {
    return this.summary.totalUnmatchedTach + this.summary.totalUnmatchedGlobal;
  }

  getUnmatchedTachRecords(): MatchedRecord[] {
    return this.matchedRecords.filter(r => r.matchStatus === 'UNMATCHED_TACH');
  }

  getUnmatchedGlobalRecords(): MatchedRecord[] {
    return this.matchedRecords.filter(r => r.matchStatus === 'UNMATCHED_GLOBAL');
  }

  exportToExcel(): void {
    if (!this.matchedRecords || this.matchedRecords.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay datos para exportar'
      });
      return;
    }

    try {
      const exportData = this.matchedRecords.map(record => ({
        'Matching Key': record.matchingKey,
        'Estado': this.getMatchStatusLabel(record.matchStatus),
        'RRN Completo (Tach)': record.rrn || '',
        'ARN Completo (Global)': record.arn || '',
        'Comercio': record.comercio || '',
        'Importe': record.importe || 0,
        'Fecha': record.fecha || '',
        'Terminal': record.terminal || '',
        'Tarjeta': record.tarjeta || '',
        'Marca': record.marca || '',
        'Tipo': record.tipo || '',
        'Descripción': record.descripcion || '',
        'Tach - Referencia': record.referencia || '',
        'Tach - Estado': record.estado || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados Matching');

      const summaryData = [
        ['Concepto', 'Cantidad', 'Porcentaje'],
        ['Total Registros Tach', this.summary.totalTachRecords, ''],
        ['Total Registros Global', this.summary.totalGlobalRecords, ''],
        ['Coincidencias', this.summary.totalMatches, `${this.summary.matchPercentage.toFixed(2)}%`],
        ['Tach sin coincidencia', this.summary.totalUnmatchedTach, ''],
        ['Global sin coincidencia', this.summary.totalUnmatchedGlobal, '']
      ];

      const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Resumen');

      const fileName = `matching_rrn_arn_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: `Archivo exportado: ${fileName}`
      });

    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error al exportar el archivo: ' + error
      });
    }
  }

  getMatchStatusLabel(status: string): string {
    switch (status) {
      case 'MATCHED':
        return 'Coincidencia';
      case 'UNMATCHED_TACH':
        return 'Tach sin coincidencia';
      case 'UNMATCHED_GLOBAL':
        return 'Global sin coincidencia';
      default:
        return 'Desconocido';
    }
  }

  getMatchStatusSeverity(status: string): "success" | "secondary" | "info" | "warning" | "danger" | "contrast" | undefined {
    switch (status) {
      case 'MATCHED':
        return 'success';
      case 'UNMATCHED_TACH':
        return 'warning';
      case 'UNMATCHED_GLOBAL':
        return 'info';
      default:
        return 'secondary';
    }
  }

  formatAmount(amount: number | undefined): string {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  }

  reset(): void {
    this.tachFile = null;
    this.globalFile = null;
    this.tachRecords = [];
    this.globalRecords = [];
    this.matchedRecords = [];
    this.showResults = false;
    this.selectedMatchStatus = '';
    this.first = 0;

    this.messageService.add({
      severity: 'info',
      summary: 'Reiniciado',
      detail: 'Componente reiniciado correctamente'
    });
  }
}

