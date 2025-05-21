import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { animate, style, transition, trigger } from '@angular/animations';
import { Place } from '../../services/places.service';

interface SummaryData {
  journeyDates: string[];
  placesByDate: Map<string, Place[]>;
}

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule
  ],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ])
    ])
  ],
  templateUrl: './summary.component.html',
  styleUrl: './summary.component.scss'
})
export class SummaryComponent implements OnInit {
  journeyDates: string[] = [];
  placesByDate: Map<string, Place[]> = new Map();
  totalPlaces = 0;
  
  constructor(
    public dialogRef: MatDialogRef<SummaryComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SummaryData
  ) {}

  ngOnInit(): void {
    this.journeyDates = this.data.journeyDates;
    this.placesByDate = this.data.placesByDate;
    
    // Calculate total places
    this.totalPlaces = Array.from(this.placesByDate.values())
      .reduce((total, places) => total + places.length, 0);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onSubmit(): void {
    this.downloadAsCSV();
    this.dialogRef.close(true);
  }

  // Format time for display
  formatTime(time: string): string {
    if (!time) return '';
    
    try {
      const [hour, minute] = time.split(':').map(part => parseInt(part, 10));
      if (isNaN(hour) || isNaN(minute)) return time;
      
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
    } catch {
      return time;
    }
  }

  public downloadAsCSV(): void {
    // Define the CSV headers
    const headers = [
      'Date', 
      'Activity Number', 
      'Activity Type', 
      'Place Name', 
      'Start Time', 
      'End Time', 
      'From Location', 
      'To Location', 
      'Transportation', 
      'Feeling', 
      'Comments'
    ];
    
    // Create CSV content starting with headers
    let csvContent = headers.join(',') + '\n';
    
    // Add data rows
    this.journeyDates.forEach(date => {
      const places = this.placesByDate.get(date) || [];
      places.forEach((place, index) => {
        const rowData = [
          date,
          (index + 1).toString(),
          this.escapeCSVField(place.activityType),
          this.escapeCSVField(place.placeLabel || ''),
          this.formatTime(place.startTime),
          this.formatTime(place.endTime),
          this.escapeCSVField(place.fromAddress),
          this.escapeCSVField(place.toAddress),
          this.escapeCSVField(place.transportType),
          this.escapeCSVField(place.emotion?.emoji || ''),
          this.escapeCSVField(place.comments || '')
        ];
        csvContent += rowData.join(',') + '\n';
      });
    });
    
    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Generate a unique timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `CHA_Mapping_${timestamp}.csv`;
    
    // Create a download link and trigger the download
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  private escapeCSVField(field: string): string {
    // If the field contains commas, quotes, or newlines, wrap it in quotes
    // and escape any existing quotes
    if (field && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  }
} 