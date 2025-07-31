// app.component.ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  template: `
    <div class="app-container">
      <app-header></app-header>
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
      <footer class="app-footer">
        <div class="footer-content">
          <p>&copy; 2025 Transaction Processor. Desarrollado con Angular y PrimeNG.</p>
          <div class="developer-info">
            <p>Desarrollado por <strong>Agustín Cruz Ottonello</strong></p>
            <div class="social-links">
              <a href="https://www.linkedin.com/in/agustin-cruz-ottonello-82506012a/"
                 target="_blank"
                 rel="noopener noreferrer"
                 class="linkedin-link">
                <i class="pi pi-linkedin"></i>
                Conectar en LinkedIn
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `,
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'transaction-processor-app';
}
