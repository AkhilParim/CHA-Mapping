import { AfterViewInit, Component, OnDestroy, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConfigurationService } from '../../services/configuration.service';
import { Subscription } from 'rxjs';
import { EmotionGridComponent, EmotionGridValue } from '../emotion-grid/emotion-grid.component';

@Component({
  selector: 'app-emotion-lookup',
  standalone: true,
  imports: [CommonModule, EmotionGridComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './emotion-lookup.component.html',
  styleUrl: './emotion-lookup.component.scss'
})
export class EmotionLookupComponent implements OnInit, AfterViewInit, OnDestroy {
  // Emotion labels from configuration
  emotionLabelTop = '';
  emotionLabelRight = '';
  emotionLabelBottom = '';
  emotionLabelLeft = '';

  selectedEmotion: EmotionGridValue | null = null;

  copySuccess = false;
  copyError = false;

  private configSubscription?: Subscription;

  constructor(
    private configurationService: ConfigurationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.configSubscription = this.configurationService.configuration$.subscribe(config => {
      if (config) {
        const el = config.configuration.emotionLabels;
        this.emotionLabelTop = el?.top?.trim?.() || '';
        this.emotionLabelRight = el?.right?.trim?.() || '';
        this.emotionLabelBottom = el?.bottom?.trim?.() || '';
        this.emotionLabelLeft = el?.left?.trim?.() || '';
      } else {
        this.emotionLabelTop = '';
        this.emotionLabelRight = '';
        this.emotionLabelBottom = '';
        this.emotionLabelLeft = '';
      }

      // Initialize default emotion after labels are known
      if (!this.selectedEmotion) {
        this.selectedEmotion = {
          x: 0,
          y: 0,
          text: 'Neutral'
        };
      }
    });
  }

  ngAfterViewInit(): void {
    // Ensure we have a default emotion if config arrives late
    if (!this.selectedEmotion) {
      this.selectedEmotion = {
        x: 0,
        y: 0,
        text: 'Neutral'
      };
    }
  }

  ngOnDestroy(): void {
    if (this.configSubscription) {
      this.configSubscription.unsubscribe();
    }
  }

  // Navigation
  goToAddressLookup(): void {
    this.router.navigate(['/address-lookup']);
  }

  // valueChange from grid
  onEmotionChange(value: EmotionGridValue): void {
    this.selectedEmotion = value;
  }

  // Clipboard handling
  async copyEmotion(): Promise<void> {
    if (!this.selectedEmotion) return;

    this.copySuccess = false;
    this.copyError = false;

    // Copy only normalized coordinates; facilitator will compute text client-side
    const payload = {
      x: this.selectedEmotion.x,
      y: this.selectedEmotion.y
    };
    const textToCopy = JSON.stringify(payload);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        this.copySuccess = true;
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        this.copySuccess = successful;
        if (!successful) {
          this.copyError = true;
        }
      }
    } catch (error) {
      console.error('Failed to copy emotion:', error);
      this.copyError = true;
    }

    setTimeout(() => {
      this.copySuccess = false;
      this.copyError = false;
    }, 3000);
  }
}


