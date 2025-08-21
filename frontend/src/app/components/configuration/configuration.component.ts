import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfigurationService, AppConfiguration } from '../../services/configuration.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: './configuration.component.html',
  styleUrl: './configuration.component.scss'
})
export class ConfigurationComponent implements OnInit {
  configForm!: FormGroup;
  uiState: 'idle' | 'saving' | 'refreshing' = 'idle';
  saveSuccess = false;
  saveError: string | null = null;

  private currentConfig: AppConfiguration | null = null;

  constructor(
    private fb: FormBuilder,
    public configurationService: ConfigurationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.configForm = this.fb.group({
      activityCsv: ['', [Validators.required]],
      transportCsv: ['', [Validators.required]],
      labelTop: [''],
      labelRight: [''],
      labelBottom: [''],
      labelLeft: ['']
    });

    // Populate form from current configuration
    this.configurationService.configuration$.subscribe(cfg => {
      this.currentConfig = cfg;
      if (cfg?.configuration) {
        const activities = cfg.configuration.activityTypes?.join(', ') || '';
        const transports = cfg.configuration.transportTypes?.join(', ') || '';
        const el = cfg.configuration.emotionLabels || { top: '', right: '', bottom: '', left: '' };
        this.configForm.patchValue({ 
          activityCsv: activities, 
          transportCsv: transports,
          labelTop: el.top || '',
          labelRight: el.right || '',
          labelBottom: el.bottom || '',
          labelLeft: el.left || ''
        }, { emitEvent: false });
      }
    });
  }

  onSubmit(): void {
    this.saveSuccess = false;
    this.saveError = null;

    if (this.configForm.invalid || this.uiState !== 'idle') {
      if (this.configForm.invalid) {
        this.saveError = 'Please enter values for both fields.';
      }
      return;
    }

    const activityCsv: string = this.configForm.value.activityCsv || '';
    const transportCsv: string = this.configForm.value.transportCsv || '';

    const activityTypes = activityCsv.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const transportTypes = transportCsv.split(',').map(s => s.trim()).filter(s => s.length > 0);

    const emotionLabels = {
      top: String(this.configForm.value.labelTop || '').trim(),
      right: String(this.configForm.value.labelRight || '').trim(),
      bottom: String(this.configForm.value.labelBottom || '').trim(),
      left: String(this.configForm.value.labelLeft || '').trim(),
    };

    if (activityTypes.length === 0 || transportTypes.length === 0) {
      this.saveError = 'Please provide at least one value for each list.';
      return;
    }

    const payload: AppConfiguration = this.currentConfig
      ? {
          ...this.currentConfig,
          configuration: {
            ...this.currentConfig.configuration,
            activityTypes,
            transportTypes,
            emotionLabels
          }
        }
      : {
          configuration: {
            activityTypes,
            transportTypes,
            emotionLabels
          }
        } as AppConfiguration;

    this.uiState = 'saving';
    this.configurationService.saveConfiguration(payload).subscribe({
      next: () => {
        this.uiState = 'idle';
        this.saveSuccess = true;
        this.saveError = null;
      },
      error: () => {
        this.uiState = 'idle';
        this.saveSuccess = false;
        this.saveError = 'Failed to save configuration. Please try again.';
      }
    });
  }

  onCancel(): void {
    if (this.uiState !== 'idle') return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Discard changes?',
        message: 'All your changes will be reverted to the last saved values.',
        confirmText: 'Confirm',
        cancelText: 'Go Back',
        isDestructive: false
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.saveSuccess = false;
      this.saveError = null;
      this.uiState = 'refreshing';
      this.configurationService.loadConfiguration().subscribe(() => {
        this.uiState = 'idle';
        this.configForm.markAsPristine();
        this.configForm.markAsUntouched();
      });
    });
  }
} 