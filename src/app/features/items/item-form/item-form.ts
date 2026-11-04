import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
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
  CardValuation,
  DETAIL_FIELDS,
  DetailField,
  ITEM_STATUSES,
  Item,
  ItemStatus,
  MEDIA_TYPES,
  MediaType,
  NewItem,
  TITLE_LABELS,
  getCardValuation,
} from '../item.model';

@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule, CurrencyPipe],
  templateUrl: './item-form.html',
  styleUrl: './item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemForm {
  private fb = inject(FormBuilder);
  protected store = inject(ItemStore);

  readonly item = input<Item | null>(null);
  readonly done = output<void>();
  readonly saved = output<void>();

  protected readonly isEdit = computed(() => this.item() !== null);
  protected readonly isDraft = computed(() => this.item()?.draft ?? false);
  protected readonly types = MEDIA_TYPES;
  protected readonly statuses = ITEM_STATUSES;

  // type-specific fields
  protected readonly currentType = signal<MediaType>('book');
  protected readonly detailFields = signal<DetailField[]>([]);
  protected readonly titleLabel = computed(() => TITLE_LABELS[this.currentType()]);
  protected readonly detailsGroup = new FormGroup<Record<string, AbstractControl>>({});

  // eBay valuation state for cards
  protected readonly valuation = signal<CardValuation | null>(null);
  protected readonly estimating = signal(false);
  protected readonly estimateNotice = signal<string | null>(null);

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
      this.estimateNotice.set(null);

      if (item) {
        this.form.reset(
          {
            type: item.type,
            title: item.draft && item.title.startsWith('Untitled') ? '' : item.title,
            status: item.status,
            condition: item.condition ?? '',
            purchase_price: item.purchase_price,
            notes: item.notes ?? '',
          },
          { emitEvent: false },
        );
        this.buildDetails(item.type, item.details);
        this.valuation.set(getCardValuation(item.details));
      } else {
        this.form.reset(undefined, { emitEvent: false });
        this.buildDetails(this.form.controls.type.value);
        this.valuation.set(null);
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

    if (this.currentType() === 'card' && this.valuation()) {
      out['valuation'] = this.valuation();
    }

    return out;
  }

  async checkEbayPrice() {
    const title = this.form.controls.title.value.trim();
    if (!title) {
      this.estimateNotice.set('Enter the player name first to check eBay prices.');
      return;
    }

    this.estimating.set(true);
    this.estimateNotice.set(null);

    const rawDetails = this.detailsGroup.getRawValue();
    const { valuation, notice } = await this.store.estimateCardPrice({
      title,
      year: rawDetails['year'] ? String(rawDetails['year']).trim() : undefined,
      set: rawDetails['set'] ? String(rawDetails['set']).trim() : undefined,
      card_number: rawDetails['card_number'] ? String(rawDetails['card_number']).trim() : undefined,
      grade:
        (rawDetails['grade'] ? String(rawDetails['grade']).trim() : '') ||
        this.form.controls.condition.value.trim() ||
        undefined,
      sport: rawDetails['sport'] ? String(rawDetails['sport']).trim() : undefined,
    });

    if (valuation) {
      this.valuation.set(valuation);
    } else {
      this.estimateNotice.set(notice ?? 'No matching eBay listings found.');
    }
    this.estimating.set(false);
  }

  applyEstimateToPrice() {
    const val = this.valuation();
    if (val) {
      this.form.controls.purchase_price.setValue(val.medianPrice);
    }
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
      draft: false, // saving details turns a draft into a normal item
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
    this.valuation.set(null);
    if (current) this.saved.emit();
    else this.form.reset({ type: v.type });
    this.saving.set(false);
  }

  cancel() {
    this.done.emit();
  }

  async discard() {
    const current = this.item();
    if (!current) return;
    if (!confirm('Discard this draft and its photo?')) return;

    await this.store.remove(current.id);
    if (!this.store.error()) this.saved.emit();
  }
}
