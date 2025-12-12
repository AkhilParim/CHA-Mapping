import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ConfigurationService, AppConfiguration, ThemeTokens, ThemeConfigResponse } from '../../services/configuration.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatDialogModule],
  templateUrl: './configuration.component.html',
  styleUrl: './configuration.component.scss'
})
export class ConfigurationComponent implements OnInit {
  configForm!: FormGroup;
  uiState: 'idle' | 'saving' | 'refreshing' = 'idle';
  saveSuccess = false;
  saveError: string | null = null;
  themeUiState: 'idle' | 'saving' | 'refreshing' = 'idle';
  themeSaveSuccess = false;
  themeSaveError: string | null = null;
  themeJsonText = '{\n  "--color-text-default": "#1e293b",\n  "--color-text-muted": "#64748b",\n  "--color-text-disabled": "#9ca3af",\n  "--color-text-secondary": "#495057",\n  "--color-accent-50": "#edf2ff",\n  "--color-accent": "#4c6ef5",\n  "--color-accent-hover": "#4f46e5",\n  "--color-accent-active": "#4338ca",\n  "--color-on-accent": "#ffffff"\n}';
  themeBaselineText = '';
  themeDirty = false;

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

    // When Options form changes after a save, clear the success flag so Unsaved status can show
    this.configForm.valueChanges.subscribe(() => {
      if (this.uiState === 'idle') {
        this.saveSuccess = false;
      }
    });

    // Populate form from current configuration
    this.configurationService.configuration$.subscribe(cfg => {
      this.currentConfig = cfg;
      if (cfg?.configuration) {
        const activities = cfg.configuration.activityTypes?.join(', ') || '';
        const transports = cfg.configuration.transportTypes?.join(', ') || '';
        const el = cfg.configuration.perceptionLabels || { top: '', right: '', bottom: '', left: '' };
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

    // Load current theme from backend and initialize the editor
    this.configurationService.loadTheme().subscribe({
      next: (resp: ThemeConfigResponse) => {
        const theme = resp?.theme || {};
        if (theme && Object.keys(theme).length > 0) {
          this.themeJsonText = JSON.stringify(theme, null, 2);
        }
        this.themeBaselineText = this.themeJsonText;
        this.themeDirty = false;
      },
      error: () => {}
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

    const perceptionLabels = {
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
            perceptionLabels
          }
        }
      : {
          configuration: {
            activityTypes,
            transportTypes,
            perceptionLabels
          }
        } as AppConfiguration;

    this.uiState = 'saving';
    this.configurationService.saveConfiguration(payload).subscribe({
      next: () => {
        this.uiState = 'idle';
        this.saveSuccess = true;
        this.saveError = null;
        this.configForm.markAsPristine();
        this.configForm.markAsUntouched();
      },
      error: () => {
        this.uiState = 'idle';
        this.saveSuccess = false;
        this.saveError = 'Failed to save configuration. Please try again.';
      }
    });
  }

  // THEME HANDLERS
  onThemeSave(): void {
    this.themeSaveSuccess = false;
    this.themeSaveError = null;
    if (this.themeUiState !== 'idle') return;

    let parsed: ThemeTokens;
    try {
      parsed = JSON.parse(this.themeJsonText);
    } catch (e) {
      this.themeSaveError = 'Invalid JSON. Please fix errors before saving.';
      return;
    }
    // Simple key whitelist enforcement client-side
    const allowedKeys = new Set([
      '--color-text-default','--color-text-muted','--color-text-disabled','--color-text-secondary','--color-accent-50','--color-accent','--color-accent-hover','--color-accent-active','--color-on-accent'
    ]);
    for (const key of Object.keys(parsed)) {
      if (!allowedKeys.has(key)) {
        this.themeSaveError = `Unknown token key: ${key}`;
        return;
      }
    }

    this.themeUiState = 'saving';
    this.configurationService.saveTheme(parsed).subscribe({
      next: () => {
        this.themeUiState = 'idle';
        this.themeSaveSuccess = true;
        // Apply immediately
        this.applyTheme(parsed);
        // Update baseline & dirty state
        this.themeBaselineText = this.themeJsonText;
        this.themeDirty = false;
      },
      error: (err: any) => {
        console.error('Theme save error:', err);
        this.themeUiState = 'idle';
        this.themeSaveSuccess = false;
        this.themeSaveError = err?.error?.errors?.[0] || 'Failed to save theme. Please try again.';
      }
    });
  }

  onThemeResetToDefault(): void {
    if (this.themeUiState !== 'idle') return;
    this.themeJsonText = '{\n  "--color-text-default": "#1e293b",\n  "--color-text-muted": "#64748b",\n  "--color-text-disabled": "#9ca3af",\n  "--color-text-secondary": "#495057",\n  "--color-accent-50": "#edf2ff",\n  "--color-accent": "#4c6ef5",\n  "--color-accent-hover": "#4f46e5",\n  "--color-accent-active": "#4338ca",\n  "--color-on-accent": "#ffffff"\n}';
    this.themeSaveSuccess = false;
    this.themeSaveError = null;
    // Force dirty state to surface the Unsaved status after reset
    this.themeDirty = true;
  }

  private applyTheme(tokens: ThemeTokens) {
    if (!tokens) return;
    const styleId = 'theme-overrides';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const entries = Object.entries(tokens)
      .filter(([_, v]) => typeof v === 'string' && v.trim().length > 0)
      .map(([k, v]) => `${k}: ${v};`)
      .join('\n  ');

    styleEl.textContent = entries.length ? `:root {\n  ${entries}\n}` : '';
  }

  onThemeChange(nextValue: string): void {
    this.themeDirty = nextValue !== this.themeBaselineText;
    // Clear previous success so "Unsaved changes" can show after edits
    this.themeSaveSuccess = false;
  }

  onThemeCancel(): void {
    if (this.themeUiState !== 'idle') return;
    this.themeSaveSuccess = false;
    this.themeSaveError = null;
    this.themeUiState = 'refreshing';
    this.configurationService.loadTheme().subscribe({
      next: (resp: ThemeConfigResponse) => {
        const theme = resp?.theme || {};
        const text = (theme && Object.keys(theme).length > 0)
          ? JSON.stringify(theme, null, 2)
          : '{\n  "--color-text-default": "#1e293b",\n  "--color-text-muted": "#64748b",\n  "--color-text-disabled": "#9ca3af",\n  "--color-text-secondary": "#495057",\n  "--color-accent-50": "#edf2ff",\n  "--color-accent": "#4c6ef5",\n  "--color-accent-hover": "#4f46e5",\n  "--color-accent-active": "#4338ca",\n  "--color-on-accent": "#ffffff"\n}';
        this.themeJsonText = text;
        this.themeBaselineText = text;
        this.themeDirty = false;
        this.themeUiState = 'idle';
      },
      error: () => {
        this.themeUiState = 'idle';
        this.themeSaveError = 'Failed to reload theme.';
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

  onResetToDefault(): void {
    if (this.uiState !== 'idle') return;

    // Hardcoded defaults
    const defaultActivities = ['Home', 'Healthcare', 'Pharmacy', 'Grocery', 'Wellness', 'Other'];
    const defaultTransports = ['Walk', 'Bicycle', 'Drove Myself', 'Driven by Someone Else', 'Bus', 'Train', 'Other'];
    const defaultPerceptionLabels = { top: 'Calm', right: 'Satisfied', bottom: 'Stressed', left: 'Dissatisfied' };

    this.configForm.patchValue({
      activityCsv: defaultActivities.join(', '),
      transportCsv: defaultTransports.join(', '),
      labelTop: defaultPerceptionLabels.top,
      labelRight: defaultPerceptionLabels.right,
      labelBottom: defaultPerceptionLabels.bottom,
      labelLeft: defaultPerceptionLabels.left
    });

    this.configForm.markAsDirty();
    this.saveSuccess = false;
    this.saveError = null;
  }
} 