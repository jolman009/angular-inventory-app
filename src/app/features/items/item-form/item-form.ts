import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ItemStore } from '../item-store';
import { ITEM_STATUSES, ItemStatus, MEDIA_TYPES, MediaType } from '../item.model';

@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule],
  templateUrl: './item-form.html',
  styleUrl: './item-form.scss',
})
export class ItemForm {
  private fb = inject(FormBuilder);
  protected store = inject(ItemStore);

  protected readonly types = MEDIA_TYPES;
  protected readonly statuses = ITEM_STATUSES;

  form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<MediaType>('book'),
    title: ['', [Validators.required, Validators.maxLength(200)]],
    status: this.fb.nonNullable.control<ItemStatus>('owned'),
    condition: [''],
    purchase_price: this.fb.control<number | null>(null, [Validators.min(0)]),
    notes: [''],
  });

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    await this.store.add({
      type: v.type,
      title: v.title.trim(),
      status: v.status,
      condition: v.condition.trim() || null,
      purchase_price: v.purchase_price,
      notes: v.notes.trim() || null,
      details: {},
    });

    if (!this.store.error()) this.form.reset();
  }
}
