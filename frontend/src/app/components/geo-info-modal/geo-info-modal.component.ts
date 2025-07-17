import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface GeoInfoData {
  id: string;
  description: string;
  label: string;
  type?: string;
  value?: number;
  barNumber?: number; // Pre-calculated bar position
  leftLabel?: string; // Dynamic left label
  rightLabel?: string; // Dynamic right label
  hasData?: boolean; // Whether data is available
}

@Component({
  selector: 'app-geo-info-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './geo-info-modal.component.html',
  styleUrl: './geo-info-modal.component.scss'
})
export class GeoInfoModalComponent implements OnInit {
  locationBarNumber: number | null = null;

  constructor(
    public dialogRef: MatDialogRef<GeoInfoModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: GeoInfoData
  ) {}

  ngOnInit(): void {
    // Use the pre-calculated bar number if available, otherwise fallback to middle
    this.locationBarNumber = this.data.barNumber ?? 2;
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
