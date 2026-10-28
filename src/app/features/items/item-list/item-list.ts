import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Supabase } from '../../../core/supabase';
import { ItemForm } from '../item-form/item-form';
import { ItemStore } from '../item-store';
import { ITEM_STATUSES, ItemStatus, MEDIA_TYPES, MediaType } from '../item.model';

@Component({
  selector: 'app-item-list',
  imports: [ItemForm, CurrencyPipe],
  templateUrl: './item-list.html',
  styleUrl: './item-list.scss',
})
export class ItemList implements OnInit {
  protected supabase = inject(Supabase);
  protected store = inject(ItemStore);
  private router = inject(Router);

  protected readonly types = MEDIA_TYPES;
  protected readonly statuses = ITEM_STATUSES;

  ngOnInit() {
    this.store.load();
  }

  onSearch(e: Event) {
    this.store.search.set((e.target as HTMLInputElement).value);
  }
  onTypeFilter(e: Event) {
    this.store.typeFilter.set((e.target as HTMLSelectElement).value as MediaType | 'all');
  }
  onStatusFilter(e: Event) {
    this.store.statusFilter.set((e.target as HTMLSelectElement).value as ItemStatus | 'all');
  }
  onStatusChange(id: string, e: Event) {
    this.store.setStatus(id, (e.target as HTMLSelectElement).value as ItemStatus);
  }

  async signOut() {
    await this.supabase.client.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
