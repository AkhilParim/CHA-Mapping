import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import { Place, PlacesService } from '../../services/places.service';
import { environment } from '../../../environments/environment';
import { ZipWriter, BlobWriter, TextReader } from '@zip.js/zip.js';

interface ExportDialogData {
  journeyDates: string[];
  placesByDate: Map<string, Place[]>;
}

@Component({
  selector: 'app-export-options',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './export-options.component.html',
  styleUrl: './export-options.component.scss'
})
export class ExportOptionsComponent {
  hasActed = false;
  copied = false;
  downloaded = false;

  constructor(
    private dialogRef: MatDialogRef<ExportOptionsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ExportDialogData,
    private placesService: PlacesService
  ) {}

  async onCopyOutput(): Promise<void> {
    try {
      const readable = this.buildReadableText();
      const armored = await this.encryptWithOpenPgp(readable);
      if (!armored) {
        alert('Failed to encrypt. Missing public key?');
        return;
      }
      const doSuccess = () => { this.hasActed = true; this.copied = true; };
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(armored);
        doSuccess();
        return;
      }
      // Legacy fallback
      const ta = document.createElement('textarea');
      ta.value = armored;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      doSuccess();
    } catch {
      alert('Failed to copy encrypted output');
    }
  }

  async onDownloadOutput(): Promise<void> {
    try {
      const password = environment.FACILITATOR_ZIP_PASSWORD;
      if (!password) {
        alert('ZIP password not configured.');
        return;
      }
      const csv = this.buildCsv();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const innerName = `CHA_Mapping_${timestamp}.csv`;
      const zipBlob = await this.createPasswordZip([{ name: innerName, text: csv }], password);
      const fileName = `CHA_Mapping_${timestamp}.zip`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = fileName;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.hasActed = true;
      this.downloaded = true;
    } catch (e) {
      alert('Failed to create password protected file');
    }
  }

  onExit(): void {
    if (!this.hasActed) return;
    this.dialogRef.close(true);
  }

  private buildReadableText(): string {
    const lines: string[] = [];
    lines.push('CHA Mapping Export');
    lines.push('');
    this.data.journeyDates.forEach(date => {
      const places = this.data.placesByDate.get(date) || [];
      if (places.length === 0) return;
      lines.push(`Date: ${date}`);
      places.forEach((place, index) => {
        const fromCoords = place.fromCoordinates ? `${place.fromCoordinates[1]},${place.fromCoordinates[0]}` : '';
        const poiCoords = place.poiCoordinates ? `${place.poiCoordinates[1]},${place.poiCoordinates[0]}` : '';
        const toCoords = place.toCoordinates ? `${place.toCoordinates[1]},${place.toCoordinates[0]}` : '';
        const feeling = place.perception ? place.perception.text : '';
        const perceptionXY = place.perception ? `(${place.perception.x.toFixed(3)},${place.perception.y.toFixed(3)})` : '';
        const parts: string[] = [];
        parts.push(`${index + 1}) ${place.activityType}`);
        if (place.placeLabel) parts.push(`Place: ${place.placeLabel}`);
        if (place.leaveTime) parts.push(`Leave: ${place.leaveTime}`);
        if (place.arriveTime) parts.push(`Arrive: ${place.arriveTime}`);
        if (place.fromAddress) parts.push(`From: ${place.fromAddress}${fromCoords ? ` [${fromCoords}]` : ''}`);
        if (place.poiAddress) parts.push(`POI: ${place.poiAddress}${poiCoords ? ` [${poiCoords}]` : ''}`);
        if (place.geoId) parts.push(`POI GeoID: ${place.geoId}`);
        if (place.timeSpentAtPoi != null) parts.push(`At POI: ${place.timeSpentAtPoi}m`);
        if (place.toAddress) parts.push(`To: ${place.toAddress}${toCoords ? ` [${toCoords}]` : ''}`);
        if (place.transportType) parts.push(`Transport: ${place.transportType}`);
        if (feeling) parts.push(`Feeling: ${feeling}${perceptionXY ? ` ${perceptionXY}` : ''}`);
        if (place.comments) parts.push(`Comments: ${place.comments}`);
        if (place.geoValues?.NDI != null) parts.push(`NDI: ${place.geoValues.NDI}`);
        if (place.geoValues?.tes != null) parts.push(`TES: ${place.geoValues.tes}`);
        if (place.geoValues?.MHLTH_CrudePrev != null) parts.push(`MHLTH: ${place.geoValues.MHLTH_CrudePrev}`);
        lines.push(parts.join(' • '));
      });
      lines.push('');
    });
    return lines.join('\n');
  }

  private buildCsv(): string {
    const headers = [
      'Date',
      'Activity Number',
      'Activity Type',
      'Place Name',
      'From Address',
      'From Address Coordinates',
      'Leave Time',
      'POI Address',
      'POI Coordinates',
      'POI GeoID',
      'Duration at POI (minutes)',
      'To Address',
      'To Address Coordinates',
      'Arrive Time',
      'Transportation',
      'Feeling',
      'Perception Grid Coordinates',
      'Comments',
      'NDI (Neighborhood Deprivation Index)',
      'TES (Tree Equity Score)',
      'MHLTH (Mental Health Crude Prevalence)',
      'Distance From to POI (meters)',
      'Distance POI to To (meters)',
      'Total Distance (meters)'
    ];

    let csvContent = headers.join(',') + '\n';
    this.data.journeyDates.forEach(date => {
      const places = this.data.placesByDate.get(date) || [];
      places.forEach((place, index) => {
        const fromCoords = place.fromCoordinates ? `"${place.fromCoordinates[1]},${place.fromCoordinates[0]}"` : '';
        const poiCoords = place.poiCoordinates ? `"${place.poiCoordinates[1]},${place.poiCoordinates[0]}"` : '';
        const toCoords = place.toCoordinates ? `"${place.toCoordinates[1]},${place.toCoordinates[0]}"` : '';
        const perceptionText = place.perception ? place.perception.text : '';
        const perceptionCoords = place.perception ? `"(${place.perception.x.toFixed(3)},${place.perception.y.toFixed(3)})"` : '';
        const ndiValue = place.geoValues?.NDI ? place.geoValues.NDI.toString() : '';
        const tesValue = place.geoValues?.tes ? place.geoValues.tes.toString() : '';
        const mhlthValue = place.geoValues?.MHLTH_CrudePrev ? place.geoValues.MHLTH_CrudePrev.toString() : '';
        
        // Calculate distances
        let distanceFromToPoi = '';
        let distancePoiToTo = '';
        let totalDistance = '';
        
        if (place.fromCoordinates && place.poiCoordinates) {
          const fromToPoiMeters = this.placesService.calculateDistance(place.fromCoordinates, place.poiCoordinates);
          distanceFromToPoi = Math.round(fromToPoiMeters).toString();
        }
        
        if (place.poiCoordinates && place.toCoordinates) {
          const poiToToMeters = this.placesService.calculateDistance(place.poiCoordinates, place.toCoordinates);
          distancePoiToTo = Math.round(poiToToMeters).toString();
        }
        
        if (distanceFromToPoi && distancePoiToTo) {
          totalDistance = (parseInt(distanceFromToPoi) + parseInt(distancePoiToTo)).toString();
        }
        
        const rowData = [
          date,
          (index + 1).toString(),
          this.escapeCSVField(place.activityType),
          this.escapeCSVField(place.placeLabel || ''),
          this.escapeCSVField(place.fromAddress),
          fromCoords,
          this.escapeCSVField(place.leaveTime || ''),
          this.escapeCSVField(place.poiAddress),
          poiCoords,
          this.escapeCSVField(place.geoId || ''),
          place.timeSpentAtPoi ? place.timeSpentAtPoi.toString() : '',
          this.escapeCSVField(place.toAddress),
          toCoords,
          this.escapeCSVField(place.arriveTime || ''),
          this.escapeCSVField(place.transportType),
          this.escapeCSVField(perceptionText),
          perceptionCoords,
          this.escapeCSVField(place.comments || ''),
          ndiValue,
          tesValue,
          mhlthValue,
          distanceFromToPoi,
          distancePoiToTo,
          totalDistance
        ];
        csvContent += rowData.join(',') + '\n';
      });
    });
    return csvContent;
  }

  private escapeCSVField(field: string): string {
    if (field && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  }

  private toBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  private async encryptWithOpenPgp(plaintext: string): Promise<string | null> {
    try {
      const openpgp = await import('openpgp');
      const resp = await fetch('assets/facilitator.pub');
      if (!resp.ok) return null;
      const pubArmored = (await resp.text()).trim();
      if (!pubArmored || !pubArmored.includes('BEGIN PGP PUBLIC KEY BLOCK')) return null;
      const publicKey = await openpgp.readKey({ armoredKey: pubArmored });
      const message = await openpgp.createMessage({ text: plaintext });
      const encrypted = await openpgp.encrypt({ message, encryptionKeys: publicKey, format: 'armored' });
      return encrypted as string;
    } catch {
      return null;
    }
  }

  private async createPasswordZip(files: { name: string, text: string }[], password: string): Promise<Blob> {
    const writer = new ZipWriter(new BlobWriter('application/zip'));
    for (const f of files) {
      await writer.add(f.name, new TextReader(f.text), {
        password,
        level: 6
      } as any);
    }
    return writer.close();
  }
}


