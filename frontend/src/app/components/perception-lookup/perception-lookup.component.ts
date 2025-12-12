import { AfterViewInit, Component, OnDestroy, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConfigurationService } from '../../services/configuration.service';
import { Subscription } from 'rxjs';
import { PerceptionGridComponent, PerceptionGridValue } from '../perception-grid/perception-grid.component';

@Component({
  selector: 'app-perception-lookup',
  standalone: true,
  imports: [CommonModule, PerceptionGridComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './perception-lookup.component.html',
  styleUrl: './perception-lookup.component.scss'
})
export class PerceptionLookupComponent implements OnInit, AfterViewInit, OnDestroy {
  // Perception labels from configuration
  perceptionLabelTop = '';
  perceptionLabelRight = '';
  perceptionLabelBottom = '';
  perceptionLabelLeft = '';

  selectedPerception: PerceptionGridValue | null = null;

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
        const el = config.configuration.perceptionLabels;
        this.perceptionLabelTop = el?.top?.trim?.() || '';
        this.perceptionLabelRight = el?.right?.trim?.() || '';
        this.perceptionLabelBottom = el?.bottom?.trim?.() || '';
        this.perceptionLabelLeft = el?.left?.trim?.() || '';
      } else {
        this.perceptionLabelTop = '';
        this.perceptionLabelRight = '';
        this.perceptionLabelBottom = '';
        this.perceptionLabelLeft = '';
      }

      // Initialize default perception after labels are known
      if (!this.selectedPerception) {
        this.selectedPerception = {
          x: 0,
          y: 0,
          text: 'Neutral'
        };
      }
    });
  }

  ngAfterViewInit(): void {
    // Ensure we have a default perception if config arrives late
    if (!this.selectedPerception) {
      this.selectedPerception = {
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
  onPerceptionChange(value: PerceptionGridValue): void {
    this.selectedPerception = value;
  }

  // Clipboard handling
  async copyPerception(): Promise<void> {
    if (!this.selectedPerception) return;

    this.copySuccess = false;
    this.copyError = false;

    // Copy only normalized coordinates; facilitator will compute text client-side
    const payload = {
      x: this.selectedPerception.x,
      y: this.selectedPerception.y
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
      console.error('Failed to copy perception:', error);
      this.copyError = true;
    }

    setTimeout(() => {
      this.copySuccess = false;
      this.copyError = false;
    }, 3000);
  }
}

