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
import { resizeImage } from '../../../core/resize-image';
import { ItemStore } from '../item-store';
import {
  DETAIL_FIELDS,
  DetailField,
  ITEM_STATUSES,
  Item,
  ItemStatus,
  MEDIA_TYPES,
  MediaType,
  NewItem,
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

  // type-specific fields
  protected readonly currentType = signal<MediaType>('book');
  protected readonly detailFields = signal<DetailField[]>([]);
  protected readonly titleLabel = computed(() => TITLE_LABELS[this.currentType()]);
  protected readonly detailsGroup = new FormGroup<Record<string, AbstractControl>>({});

  // photo state
  protected readonly saving = signal(false);
  protected readonly imageError = signal<string | null>(null);
  private readonly pendingFile = signal<Blob | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly removeImage = signal(false);
  private objectUrl: string | null = null;

  /** What to show in the photo box: a newly chosen photo, else the saved one. */
  protected readonly displayImage = computed(() => {
    const preview = this.previewUrl();
    if (preview) return preview;
    if (this.removeImage()) return null;
    const path = this.item()?.image_path;
    return path ? (this.store.imageUrls()[path] ?? null) : null;
  });

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

    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(type => this.buildDetails(type));

    effect(() => {
      const item = this.item();
      this.clearPendingImage();

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

  private collectDetails(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const raw = this.detailsGroup.getRawValue();

    for (const f of this.detailFields()) {
      const v = String(raw[f.key] ?? '').trim();
      if (!v) continue;
      out[f.key] = f.kind === 'number' ? Number(v) : v;
    }
    return out;
  }

  // ---- photo handling ----
  private clearPendingImage() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.pendingFile.set(null);
    this.previewUrl.set(null);
    this.removeImage.set(false);
    this.imageError.set(null);
  }

  async onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // lets you pick the same file again later
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.imageError.set('Please choose an image file.');
      return;
    }

    try {
      const blob = await resizeImage(file);
      this.clearPendingImage();
      this.pendingFile.set(blob);
      this.objectUrl = URL.createObjectURL(blob);
      this.previewUrl.set(this.objectUrl);
    } catch {
      this.imageError.set('Could not read that image. Try a JPEG or PNG.');
    }
  }

  removePhoto() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.pendingFile.set(null);
    this.previewUrl.set(null);
    // if the item already has a saved photo, mark it for removal on save
    this.removeImage.set(!!this.item()?.image_path);
  }

  // ---- save ----
  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const v = this.form.getRawValue();
    const fields: NewItem = {
      type: v.type,
      title: v.title.trim(),
      status: v.status,
      condition: v.condition.trim() || null,
      purchase_price: v.purchase_price,
      notes: v.notes.trim() || null,
      details: this.collectDetails(),
    };

    // Photo: upload a new one, or mark the existing one for removal
    let uploadedPath: string | null = null;
    const file = this.pendingFile();
    if (file) {
      uploadedPath = await this.store.uploadImage(file);
      if (!uploadedPath) {
        this.saving.set(false);
        return;
      }
      fields.image_path = uploadedPath;
    } else if (this.removeImage()) {
      fields.image_path = null;
    }

    const current = this.item();
    if (current) await this.store.update(current.id, fields);
    else await this.store.add(fields);

    if (this.store.error()) {
      // saving the item failed, so don't leave an orphan file behind
      if (uploadedPath) await this.store.deleteFile(uploadedPath);
      this.saving.set(false);
      return;
    }

    this.clearPendingImage();
    if (current) this.done.emit();
    else this.form.reset({ type: v.type });
    this.saving.set(false);
  }

  cancel() {
    this.done.emit();
  }
}
