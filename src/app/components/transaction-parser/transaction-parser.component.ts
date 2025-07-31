// src/app/transaction-parser/transaction-parser.component.ts
// Componente Standalone completo para Angular 18+

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

// Services
import { MessageService } from 'primeng/api';

// XLSX
import * as XLSX from 'xlsx';

// Interfaces
export interface T3000Header {
  tipoRegistro: string;
  entidad: string;
  marca: string;
  codigoSubadquirente: string;
  fechaProceso: string;
  horaProceso: string;
  archivo: string;
  descripcionArchivo: string;
  filler: string;
}

export interface T3000Detail {
  tipoRegistro: string;
  numeroComercio: string;
  numeroComercioCentral: string;
  fechaProceso: string;
  importeTransaccion: number;
  codigoMoneda: string;
  numeroTarjeta: string;
  marcaTarjeta: string;
  tipoProducto: string;
  codigoMovimiento: string;
  descripcionMovimiento: string;
  cuotas: number;
  fechaOperacion: string;
  horaOperacion: string;
  fechaOperacionOriginal: string;
  fechaPago: string;
  codigoAutorizacion: string;
  numeroTerminal: string;
  numeroLote: string;
  numeroComprobante: string;
  numeroSeguimiento: string;
  categoriaComercio: string;
  importeSinDescuento: number;
  importeArancel: number;
  ivaArancel: number;
  descuentoFinanciacion: number;
  ivaDescuentoFinanciacion: number;
  arn: string;
  rrn: string;
  reserva: string;
}

export interface T3000Trailer {
  tipoRegistro: string;
  entidad: string;
  codigoSubadquirente: string;
  cantidadRegistros: number;
  filler: string;
}

export interface TransactionSummary {
  totalHeaders: number;
  totalDetails: number;
  totalTrailers: number;
  totalImporte: number;
  transaccionesPorMarca: { [key: string]: number };
  transaccionesPorTipo: { [key: string]: number };
  transaccionesPorMarcaTarjeta: { [key: string]: number };
}

export interface ParsedT3000File {
  headers: T3000Header[];
  details: T3000Detail[];
  trailers: T3000Trailer[];
  summary: TransactionSummary;
}

@Component({
  selector: 'app-transaction-parser',
  standalone: true,
  imports: [
    // Angular Core Modules
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
    InputTextModule
  ],
  providers: [
    MessageService
  ],
  templateUrl: './transaction-parser.component.html',
  styleUrls: ['./transaction-parser.component.css']
})
export class TransactionParserComponent implements OnInit {

  selectedFile: File | null = null;
  parsedData: ParsedT3000File | null = null;
  isLoading = false;

  // Variables para PrimeNG Table
  details: T3000Detail[] = [];
  first = 0;
  rows = 10;

  // Variables para mostrar resumen
  showSummaryDialog = false;
  showValidationDialog = false;
  validationErrors: string[] = [];

  constructor(private messageService: MessageService) {}

  ngOnInit(): void {
    // Inicialización si es necesaria
  }

  /**
   * Maneja la selección de archivo con input file tradicional
   */
  onFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedFile = target.files[0];
      this.parsedData = null;
      this.details = [];
      this.messageService.add({
        severity: 'info',
        summary: 'Archivo seleccionado',
        detail: `${this.selectedFile.name} - ${(this.selectedFile.size / 1024).toFixed(2)} KB`
      });
    }
  }

  /**
   * Procesa el archivo seleccionado
   */
  parseFile(): void {
    if (!this.selectedFile) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Por favor selecciona un archivo'
      });
      return;
    }

    // Validar tipo de archivo
    if (!this.selectedFile.name.toLowerCase().endsWith('.txt') &&
        !this.selectedFile.name.toLowerCase().endsWith('.dat')) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Por favor selecciona un archivo .txt o .dat'
      });
      return;
    }

    this.isLoading = true;
    this.validationErrors = [];

    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;

      try {
        const result = this.parseT3000File(content);
        this.parsedData = result;
        this.details = result.details;

        // Validar estructura del archivo
        const validation = this.validateFile(result);
        if (!validation.isValid) {
          this.validationErrors = validation.errors;
          this.showValidationDialog = true;
        }

        this.isLoading = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: `Archivo procesado correctamente. ${result.details.length} transacciones encontradas.`
        });
      } catch (error: any) {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al procesar el archivo: ' + error.message
        });
      }
    };

    reader.onerror = () => {
      this.isLoading = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error al leer el archivo'
      });
    };

    reader.readAsText(this.selectedFile, 'UTF-8');
  }

  /**
   * Parsea un archivo T3000 completo
   */
  private parseT3000File(fileContent: string): ParsedT3000File {
    if (!fileContent || fileContent.trim().length === 0) {
      throw new Error('El archivo está vacío');
    }

    const lines = fileContent.split('\n').filter(line => line.trim().length > 0);

    if (lines.length === 0) {
      throw new Error('No se encontraron líneas válidas en el archivo');
    }

    const headers: T3000Header[] = [];
    const details: T3000Detail[] = [];
    const trailers: T3000Trailer[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.length < 300) continue;

      const tipoRegistro = line.substring(0, 1);

      try {
        switch (tipoRegistro) {
          case '1':
            headers.push(this.parseHeader(line));
            break;
          case '2':
            details.push(this.parseDetail(line));
            break;
          case '3':
            trailers.push(this.parseTrailer(line));
            break;
        }
      } catch (error) {
        console.warn(`Error en línea ${i + 1}:`, error);
      }
    }

    if (headers.length === 0 && details.length === 0 && trailers.length === 0) {
      throw new Error('No se pudo parsear ningún registro válido del archivo');
    }

    const summary = this.generateSummary(headers, details, trailers);

    return {
      headers,
      details,
      trailers,
      summary
    };
  }

  /**
   * Parsea el registro cabecera (tipo 1)
   */
  private parseHeader(line: string): T3000Header {
    return {
      tipoRegistro: line.substring(0, 1),
      entidad: line.substring(1, 6).trim(),
      marca: this.getMarcaDescription(line.substring(6, 11)),
      codigoSubadquirente: line.substring(11, 16).trim(),
      fechaProceso: this.formatDate(line.substring(16, 24)),
      horaProceso: this.formatTime(line.substring(24, 32)),
      archivo: line.substring(32, 40).trim(),
      descripcionArchivo: line.substring(40, 70).trim(),
      filler: line.substring(70, 300)
    };
  }

  /**
   * Parsea el registro detalle (tipo 2)
   */
  private parseDetail(line: string): T3000Detail {
    const numeroTarjeta = line.substring(48, 67).trim();
    const marcaTarjeta = this.detectarMarcaTarjeta(numeroTarjeta);

    return {
      tipoRegistro: line.substring(0, 1),
      numeroComercio: line.substring(1, 13).trim(),
      numeroComercioCentral: line.substring(13, 25).trim(),
      fechaProceso: this.formatDate(line.substring(25, 33)),
      importeTransaccion: this.parseAmount(line.substring(33, 45)),
      codigoMoneda: line.substring(45, 48).trim(),
      numeroTarjeta: numeroTarjeta,
      marcaTarjeta: marcaTarjeta,
      tipoProducto: this.getTipoProductoDescription(line.substring(67, 68)),
      codigoMovimiento: line.substring(68, 71).trim(),
      descripcionMovimiento: line.substring(71, 101).trim(),
      cuotas: parseInt(line.substring(101, 103)) || 0,
      fechaOperacion: this.formatDate(line.substring(103, 111)),
      horaOperacion: this.formatTime(line.substring(111, 117)),
      fechaOperacionOriginal: this.formatDate(line.substring(117, 125)),
      fechaPago: this.formatDate(line.substring(125, 133)),
      codigoAutorizacion: line.substring(133, 139).trim(),
      numeroTerminal: line.substring(139, 147).trim(),
      numeroLote: line.substring(147, 152).trim(),
      numeroComprobante: line.substring(152, 160).trim(),
      numeroSeguimiento: line.substring(160, 172).trim(),
      categoriaComercio: line.substring(172, 176).trim(),
      importeSinDescuento: this.parseAmount(line.substring(176, 188)),
      importeArancel: this.parseAmount(line.substring(188, 200)),
      ivaArancel: this.parseAmount(line.substring(200, 212)),
      descuentoFinanciacion: this.parseAmount(line.substring(212, 224)),
      ivaDescuentoFinanciacion: this.parseAmount(line.substring(224, 247)),
      arn: line.substring(247, 270).trim(),
      rrn: line.substring(270, 282).trim(),
      reserva: line.substring(282, 300)
    };
  }

  /**
   * Parsea el registro trailer (tipo 3)
   */
  private parseTrailer(line: string): T3000Trailer {
    return {
      tipoRegistro: line.substring(0, 1),
      entidad: line.substring(1, 6).trim(),
      codigoSubadquirente: line.substring(6, 11).trim(),
      cantidadRegistros: parseInt(line.substring(11, 23)) || 0,
      filler: line.substring(23, 300)
    };
  }

  /**
   * Detecta la marca de tarjeta basado en los primeros dígitos
   */
  private detectarMarcaTarjeta(numeroTarjeta: string): string {
    if (!numeroTarjeta || numeroTarjeta.length < 6) {
      return 'Desconocida';
    }

    const soloNumeros = numeroTarjeta.replace(/[^0-9]/g, '');

    if (soloNumeros.length < 4) {
      return 'Desconocida';
    }

    const firstDigit = soloNumeros.charAt(0);
    const firstTwoDigits = soloNumeros.substring(0, 2);
    const firstFourDigits = soloNumeros.substring(0, 4);

    // Visa: Comienza con 4
    if (firstDigit === '4') {
      return 'Visa';
    }

    // Mastercard: 5100-5599
    if (firstDigit === '5') {
      const range = parseInt(firstFourDigits);
      if (range >= 5100 && range <= 5599) {
        return 'Mastercard';
      }
    }

    // Mastercard nuevos rangos: 2221-2720
    if (firstDigit === '2') {
      const range = parseInt(firstFourDigits);
      if (range >= 2221 && range <= 2720) {
        return 'Mastercard';
      }
    }

    // American Express: 34, 37
    if (firstTwoDigits === '34' || firstTwoDigits === '37') {
      return 'American Express';
    }

    // Discover: 6011, 644-649, 65
    if (firstFourDigits === '6011' || firstTwoDigits === '65') {
      return 'Discover';
    }

    if (firstDigit === '6') {
      const threeDigits = parseInt(soloNumeros.substring(0, 3));
      if (threeDigits >= 644 && threeDigits <= 649) {
        return 'Discover';
      }
    }

    // Diners Club: 300-305, 36, 38
    if (firstTwoDigits === '36' || firstTwoDigits === '38') {
      return 'Diners Club';
    }

    const firstThreeDigits = parseInt(soloNumeros.substring(0, 3));
    if (firstThreeDigits >= 300 && firstThreeDigits <= 305) {
      return 'Diners Club';
    }

    return 'Otra';
  }

  /**
   * Métodos auxiliares de parsing
   */
  private parseAmount(amountStr: string): number {
    try {
      const cleanAmount = amountStr.trim();
      if (!cleanAmount || cleanAmount === '0'.repeat(cleanAmount.length)) {
        return 0;
      }
      if (!/^\d+$/.test(cleanAmount)) {
        return 0;
      }
      return parseInt(cleanAmount) / 100;
    } catch (error) {
      return 0;
    }
  }

  private formatDate(dateStr: string): string {
    try {
      const cleanDate = dateStr.trim();
      if (!cleanDate || cleanDate === '0'.repeat(8) || cleanDate.length !== 8) {
        return '';
      }
      const year = cleanDate.substring(0, 4);
      const month = cleanDate.substring(4, 6);
      const day = cleanDate.substring(6, 8);
      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateStr;
    }
  }

  private formatTime(timeStr: string): string {
    try {
      const cleanTime = timeStr.trim();
      if (!cleanTime || cleanTime === '0'.repeat(6) || cleanTime.length !== 6) {
        return '';
      }
      const hours = cleanTime.substring(0, 2);
      const minutes = cleanTime.substring(2, 4);
      const seconds = cleanTime.substring(4, 6);
      return `${hours}:${minutes}:${seconds}`;
    } catch (error) {
      return timeStr;
    }
  }

  private getMarcaDescription(marca: string): string {
    const marcaCode = marca.trim();
    const marcaMap: { [key: string]: string } = {
      '00001': 'Mastercard',
      '00002': 'Visa',
      '27010': 'Procesadora Local'
    };
    return marcaMap[marcaCode] || `Marca ${marcaCode}`;
  }

  private getTipoProductoDescription(tipo: string): string {
    const tipoMap: { [key: string]: string } = {
      'C': 'Crédito',
      'D': 'Débito',
      'P': 'Prepaga',
      'M': 'Maestro'
    };
    return tipoMap[tipo] || tipo;
  }

  private generateSummary(headers: T3000Header[], details: T3000Detail[], trailers: T3000Trailer[]): TransactionSummary {
    const totalImporte = details.reduce((sum, detail) => sum + detail.importeTransaccion, 0);

    const transaccionesPorMarca = headers.reduce((acc, header) => {
      acc[header.marca] = (acc[header.marca] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    if (Object.keys(transaccionesPorMarca).length === 0) {
      transaccionesPorMarca['General'] = details.length;
    }

    const transaccionesPorTipo = details.reduce((acc, detail) => {
      acc[detail.tipoProducto] = (acc[detail.tipoProducto] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const transaccionesPorMarcaTarjeta = details.reduce((acc, detail) => {
      acc[detail.marcaTarjeta] = (acc[detail.marcaTarjeta] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return {
      totalHeaders: headers.length,
      totalDetails: details.length,
      totalTrailers: trailers.length,
      totalImporte,
      transaccionesPorMarca,
      transaccionesPorTipo,
      transaccionesPorMarcaTarjeta
    };
  }

  private validateFile(parsed: ParsedT3000File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (parsed.headers.length === 0) {
      errors.push('No se encontraron registros de cabecera (tipo 1)');
    }

    if (parsed.details.length === 0) {
      errors.push('No se encontraron registros de detalle (tipo 2)');
    }

    if (parsed.trailers.length === 0) {
      errors.push('No se encontraron registros de trailer (tipo 3)');
    }

    parsed.trailers.forEach((trailer, index) => {
      if (trailer.cantidadRegistros > 0 && trailer.cantidadRegistros !== parsed.details.length) {
        errors.push(`Trailer ${index + 1}: Informa ${trailer.cantidadRegistros} registros pero se encontraron ${parsed.details.length}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Muestra el diálogo de resumen
   */
  showSummary(): void {
    this.showSummaryDialog = true;
  }

  /**
   * ==================== MÉTODOS DE EXPORTACIÓN ====================
   */

  /**
   * Exporta a Excel nativo usando SheetJS
   */
  exportToExcel(): void {
    if (!this.parsedData) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay datos para exportar'
      });
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      // 1. HOJA DE TRANSACCIONES (DETALLES)
      if (this.parsedData.details.length > 0) {
        const detailsData = this.parsedData.details.map((detail, index) => ({
          'ID': index + 1,
          'Tipo Registro': detail.tipoRegistro,
          'Número Comercio': detail.numeroComercio,
          'Comercio Central': detail.numeroComercioCentral,
          'Fecha Proceso': detail.fechaProceso,
          'Importe': detail.importeTransaccion,
          'Moneda': detail.codigoMoneda,
          'Número Tarjeta': detail.numeroTarjeta,
          'Marca Tarjeta': detail.marcaTarjeta,
          'Tipo Producto': detail.tipoProducto,
          'Código Movimiento': detail.codigoMovimiento,
          'Descripción': detail.descripcionMovimiento,
          'Cuotas': detail.cuotas,
          'Fecha Operación': detail.fechaOperacion,
          'Hora Operación': detail.horaOperacion,
          'Fecha Original': detail.fechaOperacionOriginal,
          'Fecha Pago': detail.fechaPago,
          'Autorización': detail.codigoAutorizacion,
          'Terminal': detail.numeroTerminal,
          'Lote': detail.numeroLote,
          'Comprobante': detail.numeroComprobante,
          'Seguimiento': detail.numeroSeguimiento,
          'Categoría': detail.categoriaComercio,
          'Importe Sin Descuento': detail.importeSinDescuento,
          'Arancel': detail.importeArancel,
          'IVA Arancel': detail.ivaArancel,
          'Descuento': detail.descuentoFinanciacion,
          'IVA Descuento': detail.ivaDescuentoFinanciacion,
          'ARN': detail.arn,
          'RRN': detail.rrn
        }));

        const detailsWorksheet = XLSX.utils.json_to_sheet(detailsData);

        // Configurar ancho de columnas
        detailsWorksheet['!cols'] = [
          { wch: 6 },   // ID
          { wch: 5 },   // Tipo Registro
          { wch: 15 },  // Número Comercio
          { wch: 15 },  // Comercio Central
          { wch: 12 },  // Fecha Proceso
          { wch: 12 },  // Importe
          { wch: 8 },   // Moneda
          { wch: 20 },  // Número Tarjeta
          { wch: 15 },  // Marca Tarjeta
          { wch: 12 },  // Tipo Producto
          { wch: 8 },   // Código Movimiento
          { wch: 30 },  // Descripción
          { wch: 8 },   // Cuotas
          { wch: 12 },  // Fecha Operación
          { wch: 10 },  // Hora Operación
          { wch: 12 },  // Fecha Original
          { wch: 12 },  // Fecha Pago
          { wch: 12 },  // Autorización
          { wch: 12 },  // Terminal
          { wch: 8 },   // Lote
          { wch: 12 },  // Comprobante
          { wch: 15 },  // Seguimiento
          { wch: 10 },  // Categoría
          { wch: 15 },  // Importe Sin Descuento
          { wch: 12 },  // Arancel
          { wch: 12 },  // IVA Arancel
          { wch: 12 },  // Descuento
          { wch: 12 },  // IVA Descuento
          { wch: 25 },  // ARN
          { wch: 15 }   // RRN
        ];

        XLSX.utils.book_append_sheet(workbook, detailsWorksheet, 'Transacciones');
      }

      // 2. HOJA DE RESUMEN
      const summaryData = [
        ['RESUMEN DEL ARCHIVO T3000', ''],
        ['', ''],
        ['Concepto', 'Valor'],
        ['Total Headers', this.parsedData.summary.totalHeaders],
        ['Total Transacciones', this.parsedData.summary.totalDetails],
        ['Total Trailers', this.parsedData.summary.totalTrailers],
        ['Importe Total', this.parsedData.summary.totalImporte],
        ['', ''],
        ['DISTRIBUCIÓN POR TIPO DE PRODUCTO', ''],
        ['Tipo', 'Cantidad'],
        ...Object.entries(this.parsedData.summary.transaccionesPorTipo).map(([tipo, count]) => [tipo, count]),
        ['', ''],
        ['DISTRIBUCIÓN POR MARCA DE TARJETA', ''],
        ['Marca', 'Cantidad'],
        ...Object.entries(this.parsedData.summary.transaccionesPorMarcaTarjeta).map(([marca, count]) => [marca, count]),
        ['', ''],
        ['DISTRIBUCIÓN POR MARCA PROCESADORA', ''],
        ['Marca', 'Cantidad'],
        ...Object.entries(this.parsedData.summary.transaccionesPorMarca).map(([marca, count]) => [marca, count])
      ];

      const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWorksheet['!cols'] = [{ wch: 35 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Resumen');

      // 3. HOJA DE HEADERS
      if (this.parsedData.headers.length > 0) {
        const headersData = this.parsedData.headers.map((header, index) => ({
          'ID': index + 1,
          'Tipo Registro': header.tipoRegistro,
          'Entidad': header.entidad,
          'Marca': header.marca,
          'Subadquirente': header.codigoSubadquirente,
          'Fecha Proceso': header.fechaProceso,
          'Hora Proceso': header.horaProceso,
          'Archivo': header.archivo,
          'Descripción': header.descripcionArchivo
        }));

        const headersWorksheet = XLSX.utils.json_to_sheet(headersData);
        headersWorksheet['!cols'] = [
          { wch: 6 }, { wch: 5 }, { wch: 10 }, { wch: 20 }, { wch: 15 },
          { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 40 }
        ];
        XLSX.utils.book_append_sheet(workbook, headersWorksheet, 'Headers');
      }

      // 4. HOJA DE TRAILERS
      if (this.parsedData.trailers.length > 0) {
        const trailersData = this.parsedData.trailers.map((trailer, index) => ({
          'ID': index + 1,
          'Tipo Registro': trailer.tipoRegistro,
          'Entidad': trailer.entidad,
          'Subadquirente': trailer.codigoSubadquirente,
          'Cantidad Registros': trailer.cantidadRegistros,
          'Estado': trailer.cantidadRegistros === this.parsedData!.details.length ? 'Válido' : 'Inconsistente'
        }));

        const trailersWorksheet = XLSX.utils.json_to_sheet(trailersData);
        trailersWorksheet['!cols'] = [
          { wch: 6 }, { wch: 5 }, { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(workbook, trailersWorksheet, 'Trailers');
      }

      // 5. GENERAR Y DESCARGAR
      const fileName = `T3000_${this.selectedFile?.name?.replace(/\.[^/.]+$/, '') || 'transacciones'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      this.messageService.add({
        severity: 'success',
        summary: 'Excel Exportado',
        detail: `Archivo ${fileName} descargado correctamente con ${this.parsedData.details.length} transacciones`
      });

    } catch (error) {
      console.error('Error exportando a Excel:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error al generar el archivo Excel'
      });
    }
  }

  /**
   * Exporta los datos a JSON
   */
  exportToJson(): void {
    if (!this.parsedData) return;

    const dataStr = JSON.stringify(this.parsedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });

    this.downloadFile(dataBlob, 'transacciones_parsed.json');

    this.messageService.add({
      severity: 'success',
      summary: 'Exportado',
      detail: 'Datos exportados a JSON correctamente'
    });
  }

  /**
   * Exporta a CSV mejorado
   */
  exportToCsv(): void {
    if (!this.parsedData) return;

    const csvContent = this.convertToCsvImproved(this.parsedData.details);
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    const dataBlob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    this.downloadFile(dataBlob, 'transacciones_detalle.csv');

    this.messageService.add({
      severity: 'success',
      summary: 'Exportado',
      detail: 'Transacciones exportadas a CSV correctamente'
    });
  }

  /**
   * Exporta headers a CSV
   */
  exportHeadersToCsv(): void {
    if (!this.parsedData) return;

    const csvContent = this.convertToCsvImproved(this.parsedData.headers);
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    const dataBlob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    this.downloadFile(dataBlob, 'transacciones_headers.csv');

    this.messageService.add({
      severity: 'success',
      summary: 'Exportado',
      detail: 'Headers exportados a CSV correctamente'
    });
  }

  /**
   * CSV mejorado con punto y coma como separador
   */
  private convertToCsvImproved(data: any[]): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(';');

    const csvRows = data.map(row =>
      headers.map(header => {
        let value = row[header];

        if (value === null || value === undefined) {
          value = '';
        } else {
          value = String(value);
        }

        // Limpiar para CSV
        value = value.replace(/"/g, '""');
        value = value.replace(/;/g, ',');
        value = value.replace(/\r?\n/g, ' ');

        // Encapsular si contiene separadores
        if (value.includes(';') || value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value}"`;
        }

        return value;
      }).join(';')
    );

    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Descarga un archivo
   */
  private downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Resetea el componente
   */
  reset(): void {
    this.selectedFile = null;
    this.parsedData = null;
    this.details = [];
    this.validationErrors = [];
    this.first = 0;
    this.isLoading = false;

    this.messageService.add({
      severity: 'info',
      summary: 'Reiniciado',
      detail: 'Componente reiniciado correctamente'
    });
  }

  /**
   * ==================== MÉTODOS DE UI Y UTILIDADES ====================
   */

  /**
   * Obtiene el color para el tipo de producto
   */
  getProductTypeColor(tipo: string): string {
    const colorMap: { [key: string]: string } = {
      'Crédito': '#28a745',
      'Débito': '#007bff',
      'Prepaga': '#ffc107',
      'Maestro': '#6f42c1'
    };
    return colorMap[tipo] || '#6c757d';
  }

  /**
   * Obtiene el color para la marca de tarjeta
   */
  getCardBrandColor(marca: string): string {
    const colorMap: { [key: string]: string } = {
      'Visa': '#1a1f71',
      'Mastercard': '#eb001b',
      'American Express': '#006fcf',
      'Discover': '#ff6000',
      'Diners Club': '#0079be',
      'Otra': '#6c757d',
      'Desconocida': '#dc3545'
    };
    return colorMap[marca] || '#6c757d';
  }

  /**
   * Obtiene la severidad para el badge de marca de tarjeta
   */
  getCardBrandSeverity(marca: string): "success" | "secondary" | "info" | "warning" | "danger" | "contrast" | undefined {
    const severityMap: { [key: string]: "success" | "secondary" | "info" | "warning" | "danger" | "contrast" } = {
      'Visa': 'info',
      'Mastercard': 'warning',
      'American Express': 'success',
      'Discover': 'secondary',
      'Diners Club': 'contrast',
      'Otra': 'secondary',
      'Desconocida': 'danger'
    };
    return severityMap[marca] || 'secondary';
  }

  /**
   * Formatea un importe para mostrar
   */
  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  }

  /**
   * Obtiene la severidad para el badge según el tipo de producto
   */
  getProductTypeSeverity(tipo: string): "success" | "secondary" | "info" | "warning" | "danger" | "contrast" | undefined {
    const severityMap: { [key: string]: "success" | "secondary" | "info" | "warning" | "danger" | "contrast" } = {
      'Crédito': 'success',
      'Débito': 'info',
      'Prepaga': 'warning',
      'Maestro': 'secondary'
    };
    return severityMap[tipo] || 'secondary';
  }

  /**
   * Aplica filtro global a la tabla
   */
  applyFilterGlobal(event: Event, dt: any): void {
    const target = event.target as HTMLInputElement;
    dt.filterGlobal(target.value, 'contains');
  }
}
