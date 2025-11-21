import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface EmotionGridValue {
  x: number; // normalized -1..1
  y: number; // normalized -1..1
  text: string;
}

@Component({
  selector: 'app-emotion-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './emotion-grid.component.html',
  styleUrl: './emotion-grid.component.scss'
})
export class EmotionGridComponent implements OnChanges {
  @ViewChild('grid') grid!: ElementRef<HTMLDivElement>;

  @Input() topLabel = 'Calm';
  @Input() rightLabel = 'Satisfied';
  @Input() bottomLabel = 'Stressed';
  @Input() leftLabel = 'Dissatisfied';

  @Input() value: EmotionGridValue | null = null;
  @Output() valueChange = new EventEmitter<EmotionGridValue>();

  // Start neutral so Angular never sees a null → object flip during first check
  selectedEmotion: EmotionGridValue = {
    x: 0,
    y: 0,
    text: 'Neutral'
  };
  isDragging = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      if (this.value) {
        this.selectedEmotion = { ...this.value };
      } else {
        this.selectedEmotion = {
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

    this.selectedEmotion = {
      x: normalized.x,
      y: normalized.y,
      text: this.getEmotionText(xPercent, yPercent)
    };
    this.emitCurrent();
  }

  private emitCurrent(): void {
    if (!this.selectedEmotion) return;
    this.valueChange.emit({ ...this.selectedEmotion });
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
    if (!this.selectedEmotion || !this.grid) return null;
    const rect = this.grid.nativeElement.getBoundingClientRect();
    return this.normalizedToPixel(this.selectedEmotion.x, this.selectedEmotion.y, rect);
  }

  private getEmotionText(x: number, y: number): string {
    const leftLabel = (this.leftLabel || 'Dissatisfied').trim();
    const rightLabel = (this.rightLabel || 'Satisfied').trim();
    const topLabel = (this.topLabel || 'Calm').trim();
    const bottomLabel = (this.bottomLabel || 'Stressed').trim();

    const describeAxis = (p: number, minLabel: string, maxLabel: string): { text: string; neutral: boolean } => {
      const neutralBand = 0.1;
      const dist = Math.abs(p - 0.5);
      if (dist <= neutralBand) return { text: 'Neutral', neutral: true };

      const normalized = Math.min(1, Math.max(0, (dist - neutralBand) / (0.5 - neutralBand)));
      const bucket = Math.max(1, Math.min(5, Math.ceil(normalized * 5)));
      const pct = bucket * 20;

      return { text: p < 0.5 ? `${pct}% ${minLabel}` : `${pct}% ${maxLabel}`, neutral: false };
    };

    const xRes = describeAxis(x, leftLabel, rightLabel);
    const yRes = describeAxis(y, topLabel, bottomLabel);

    if (xRes.neutral && yRes.neutral) {
      return 'Neutral';
    }

    const xText = xRes.neutral ? `Neutral (${leftLabel}–${rightLabel})` : xRes.text;
    const yText = yRes.neutral ? `Neutral (${topLabel}–${bottomLabel})` : yRes.text;
    return `${xText} and ${yText}`;
  }
}


