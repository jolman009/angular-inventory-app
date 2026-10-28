import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Supabase } from '../../../core/supabase';

@Component({
  selector: 'app-item-list',
  imports: [],
  templateUrl: './item-list.html',
  styleUrl: './item-list.scss',
})
export class ItemList {
  protected supabase = inject(Supabase);
  private router = inject(Router);

  async signOut() {
    await this.supabase.client.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
