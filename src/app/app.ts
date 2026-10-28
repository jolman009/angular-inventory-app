import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Supabase } from './core/supabase';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('angular-inventory-app');
  private supabase = inject(Supabase);

  constructor() {
    this.supabase.client
      .from('items')
      .select('*')
      .then(r => console.log('Supabase test:', r));
  }
}
