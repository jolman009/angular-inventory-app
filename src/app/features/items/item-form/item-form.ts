import { Component, computed, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ItemStore } from '../item-store';
import { ITEM_STATUSES, Item, ItemStatus, MEDIA_TYPES, MediaType } from '../item.model';

@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule],
  templateUrl: './item-form.html',
  styleUrl: './item-form.scss',
})
export class ItemForm {
  private fb = inject(FormBuilder);
  protected store = inject(ItemStore);

  // Data in from the parent: the item to edit, or null for "add" mode
  readonly item = input<Item | null>(null);
  // Event out to the parent: "I'm finished editing"
  readonly done = output<void>();

  protected readonly isEdit = computed(() => this.item() !== null);
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

  constructor() {
    // Whenever the item input changes, fill the form (edit) or clear it (add)
    effect(() => {
      const item = this.item();
      if (item) {
        this.form.reset({
          type: item.type,
          title: item.title,
          status: item.status,
          condition: item.condition ?? '',
          purchase_price: item.purchase_price,
          notes: item.notes ?? '',
        });
      } else {
        this.form.reset();
      }
    });
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const fields = {
      type: v.type,
      title: v.title.trim(),
      status: v.status,
      condition: v.condition.trim() || null,
      purchase_price: v.purchase_price,
      notes: v.notes.trim() || null,
    };

    const current = this.item();
    if (current) {
      await this.store.update(current.id, fields);
    } else {
      await this.store.add({ ...fields, details: {} });
    }

    if (this.store.error()) return;

    if (current) this.done.emit();
    else this.form.reset();
  }

  cancel() {
    this.done.emit();
  }
}
