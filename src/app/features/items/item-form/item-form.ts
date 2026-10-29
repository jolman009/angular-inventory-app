import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ItemStore } from '../item-store';
import {
  DETAIL_FIELDS,
  DetailField,
  ITEM_STATUSES,
  Item,
  ItemStatus,
  MEDIA_TYPES,
  MediaType,
  TITLE_LABELS,
} from '../item.model';

@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule],
  templateUrl: './item-form.html',
  styleUrl: './item-form.scss',
})
export class ItemForm {
  private fb = inject(FormBuilder);
  protected store = inject(ItemStore);

  readonly item = input<Item | null>(null);
  readonly done = output<void>();

  protected readonly isEdit = computed(() => this.item() !== null);
  protected readonly types = MEDIA_TYPES;
  protected readonly statuses = ITEM_STATUSES;

  // Type-specific fields: which type we're showing, and which fields it has
  protected readonly currentType = signal<MediaType>('book');
  protected readonly titleLabel = computed(() => TITLE_LABELS[this.currentType()]);
  protected readonly detailFields = signal<DetailField[]>([]);

  // A nested group whose controls are rebuilt whenever the type changes
  protected readonly detailsGroup = new FormGroup<Record<string, AbstractControl>>({});

  form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<MediaType>('book'),
    title: ['', [Validators.required, Validators.maxLength(200)]],
    status: this.fb.nonNullable.control<ItemStatus>('owned'),
    condition: [''],
    purchase_price: this.fb.control<number | null>(null, [Validators.min(0)]),
    notes: [''],
    details: this.detailsGroup,
  });

  constructor() {
    this.buildDetails('book');

    // When the user picks a different type, swap the detail fields
    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(type => this.buildDetails(type));

    // When the item input changes, fill the form (edit) or clear it (add)
    effect(() => {
      const item = this.item();
      if (item) {
        this.form.reset(
          {
            type: item.type,
            title: item.title,
            status: item.status,
            condition: item.condition ?? '',
            purchase_price: item.purchase_price,
            notes: item.notes ?? '',
          },
          { emitEvent: false },
        );
        this.buildDetails(item.type, item.details);
      } else {
        this.form.reset(undefined, { emitEvent: false });
        this.buildDetails(this.form.controls.type.value);
      }
    });
  }

  /** Replace the detail controls with the ones for this type. */
  private buildDetails(type: MediaType, values: Record<string, unknown> = {}) {
    const fields = DETAIL_FIELDS[type];

    for (const key of Object.keys(this.detailsGroup.controls)) {
      this.detailsGroup.removeControl(key);
    }

    for (const f of fields) {
      const raw = values[f.key];
      const validators = f.kind === 'number' ? [Validators.pattern(/^\d+$/)] : [];
      this.detailsGroup.addControl(
        f.key,
        new FormControl<string>(raw == null ? '' : String(raw), {
          nonNullable: true,
          validators,
        }),
      );
    }

    this.currentType.set(type);
    this.detailFields.set(fields);
  }

  /** Turn the detail controls into the object we save in the `details` column. */
  private collectDetails(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const raw = this.detailsGroup.getRawValue();

    for (const f of this.detailFields()) {
      const v = (raw[f.key] ?? '').trim();
      if (!v) continue; // skip empty fields
      out[f.key] = f.kind === 'number' ? Number(v) : v;
    }
    return out;
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
      details: this.collectDetails(),
    };

    const current = this.item();
    if (current) {
      await this.store.update(current.id, fields);
    } else {
      await this.store.add(fields);
    }

    if (this.store.error()) return;

    if (current) this.done.emit();
    else this.form.reset({ type: v.type }); // keep the type so you can add several in a row
  }

  cancel() {
    this.done.emit();
  }
}
