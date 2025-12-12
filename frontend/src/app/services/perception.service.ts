import { Injectable } from '@angular/core';

export interface PerceptionLabels {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

@Injectable({
  providedIn: 'root'
})
export class PerceptionService {

  /**
   * Generate descriptive text for a perception coordinate
   * @param x - x coordinate (0-1 scale, where 0.5 is neutral)
   * @param y - y coordinate (0-1 scale, where 0.5 is neutral)
   * @param labels - The axis labels to use
   * @returns Descriptive text like "mildly Calm and very Satisfied"
   */
  getPerceptionText(x: number, y: number, labels: PerceptionLabels): string {
    const leftLabel = (labels.left || 'Dissatisfied').trim();
    const rightLabel = (labels.right || 'Satisfied').trim();
    const topLabel = (labels.top || 'Calm').trim();
    const bottomLabel = (labels.bottom || 'Stressed').trim();

    const describeAxis = (p: number, minLabel: string, maxLabel: string): { text: string; neutral: boolean } => {
      // Calculate distance from center (0.5 is neutral)
      const dist = Math.abs(p - 0.5);
      // Convert to percentage scale (0-100)
      // Since dist ranges from 0 to 0.5, we multiply by 200 to get 0-100
      const percentage = dist * 200;

      // Determine intensity based on percentage ranges
      // 0-20%: Neutral (0-10% of grid from center)
      // 20-40%: mildly (10-20% of grid from center)
      // 40-70%: moderately (20-35% of grid from center)
      // 70-100%: very (35-50% of grid from center)
      let intensity: string;
      if (percentage < 20) {
        return { text: 'Neutral', neutral: true };
      } else if (percentage < 40) {
        intensity = 'Mildly';
      } else if (percentage < 70) {
        intensity = 'Moderately';
      } else {
        intensity = 'Very';
      }

      // Determine which label to use based on which side of center
      const label = p < 0.5 ? minLabel : maxLabel;
      return { text: `${intensity} ${label}`, neutral: false };
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

