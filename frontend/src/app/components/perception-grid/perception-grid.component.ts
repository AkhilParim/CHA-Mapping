import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PerceptionService } from '../../services/perception.service';

export interface PerceptionGridValue {
  x: number; // normalized -1..1
  y: number; // normalized -1..1
  text: string;
}

@Component({
  selector: 'app-perception-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perception-grid.component.html',
  styleUrl: './perception-grid.component.scss'
})
export class PerceptionGridComponent implements OnChanges {
  constructor(private perceptionService: PerceptionService) {}
  @ViewChild('grid') grid!: ElementRef<HTMLDivElement>;

  @Input() topLabel = 'Calm';
  @Input() rightLabel = 'Satisfied';
  @Input() bottomLabel = 'Stressed';
  @Input() leftLabel = 'Dissatisfied';

  @Input() value: PerceptionGridValue | null = null;
  @Output() valueChange = new EventEmitter<PerceptionGridValue>();

  // Start neutral so Angular never sees a null → object flip during first check
  selectedPerception: PerceptionGridValue = {
    x: 0,
    y: 0,
    text: 'Neutral'
  };
  isDragging = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      if (this.value) {
        this.selectedPerception = { ...this.value };
      } else {
        this.selectedPerception = {
          x: 0,
          y: 0,
          text: 'Neutral'
        };
      }
    }
  }

  // Event handlers wired from template
  onGridClick(event: MouseEvent): void {
    this.updateFromEvent(event);
  }

  onGridMouseDown(event: MouseEvent): void {
    this.isDragging = true;
    this.updateFromEvent(event);
  }

  onGridMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    this.updateFromEvent(event);
  }

  onGridMouseUp(): void {
    this.isDragging = false;
  }

  onGridMouseLeave(): void {
    this.isDragging = false;
  }

  private updateFromEvent(event: MouseEvent): void {
    if (!this.grid) return;
    const rect = this.grid.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.setFromPixel(x, y, rect);
  }

  private setFromPixel(pixelX: number, pixelY: number, rect: DOMRect): void {
    const x = Math.max(0, Math.min(rect.width, pixelX));
    const y = Math.max(0, Math.min(rect.height, pixelY));

    const xPercent = x / rect.width;
    const yPercent = y / rect.height;
    const normalized = this.pixelToNormalized(x, y, rect);

    this.selectedPerception = {
      x: normalized.x,
      y: normalized.y,
      text: this.perceptionService.getPerceptionText(xPercent, yPercent, {
        top: this.topLabel,
        right: this.rightLabel,
        bottom: this.bottomLabel,
        left: this.leftLabel
      })
    };
    this.emitCurrent();
  }

  private emitCurrent(): void {
    if (!this.selectedPerception) return;
    this.valueChange.emit({ ...this.selectedPerception });
  }

  private pixelToNormalized(pixelX: number, pixelY: number, rect: DOMRect): { x: number; y: number } {
    const xPercent = pixelX / rect.width;
    const yPercent = pixelY / rect.height;
    const normalizedX = (xPercent * 2) - 1;
    const normalizedY = (yPercent * 2) - 1;
    return { x: normalizedX, y: normalizedY };
  }

  private normalizedToPixel(normalizedX: number, normalizedY: number, rect: DOMRect): { x: number; y: number } {
    const xPercent = (normalizedX + 1) / 2;
    const yPercent = (normalizedY + 1) / 2;
    const pixelX = xPercent * rect.width;
    const pixelY = yPercent * rect.height;
    return { x: pixelX, y: pixelY };
  }

  getDisplayCoordinates(): { x: number; y: number } | null {
    if (!this.selectedPerception || !this.grid) return null;
    const rect = this.grid.nativeElement.getBoundingClientRect();
    return this.normalizedToPixel(this.selectedPerception.x, this.selectedPerception.y, rect);
  }
}


