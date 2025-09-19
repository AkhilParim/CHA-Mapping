import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfigurationService, ThemeConfigResponse, ThemeTokens } from './services/configuration.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'frontend';

  private configurationService = inject(ConfigurationService);

  ngOnInit(): void {
    // Load theme on startup and apply
    this.configurationService.loadTheme().subscribe({
      next: (resp: ThemeConfigResponse) => this.applyTheme(resp.theme),
      error: () => {}
    });
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
}
