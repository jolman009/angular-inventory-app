import { Component, OnDestroy, computed, inject, output, signal } from '@angular/core';
import { resizeImage } from '../../../core/resize-image';
import { ItemStore } from '../item-store';
import { MEDIA_TYPES, MediaType } from '../item.model';

interface Shot {
  id: number;
  type: MediaType;
  preview: string | null;
  status: 'saving' | 'saved' | 'failed';
  message?: string;
  note?: string;
}

@Component({
  selector: 'app-quick-capture',
  templateUrl: './quick-capture.html',
  styleUrl: './quick-capture.scss',
})
export class QuickCapture implements OnDestroy {
  private store = inject(ItemStore);

  readonly done = output<void>();
  readonly review = output<void>();

  protected readonly types = MEDIA_TYPES;
  protected readonly type = signal<MediaType>('card');
  protected readonly shots = signal<Shot[]>([]);
  protected readonly savedCount = computed(() => this.shots().filter(s => s.status === 'saved').length);
  protected readonly busy = computed(() => this.shots().some(s => s.status === 'saving'));

  private nextId = 1;
  // Photos are saved one at a time, in the order they were taken
  private chain: Promise<void> = Promise.resolve();

  onFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // lets you pick the same photo again
    for (const file of files) this.enqueue(file);
  }

  private enqueue(file: File) {
    const id = this.nextId++;
    const type = this.type(); // the type chosen at the moment of the tap
    this.shots.update(list => [{ id, type, preview: null, status: 'saving' }, ...list]);
    this.chain = this.chain.then(() => this.save(id, file, type));
  }

    private async save(id: number, file: File, type: MediaType) {
    try {
      const blob = await resizeImage(file);
      this.patch(id, { preview: URL.createObjectURL(blob), note: 'Reading photo…' });

      const { suggestion, notice } = await this.store.scanPhoto(type, blob);
      const ok = await this.store.addDraft(type, blob, suggestion);

      this.patch(
        id,
        ok
          ? { status: 'saved', note: suggestion?.title ?? notice ?? 'No suggestions' }
          : { status: 'failed', message: this.store.error() ?? 'Could not save.', note: undefined },
      );
    } catch {
      this.patch(id, { status: 'failed', message: 'Could not read that image. Try a JPEG or PNG.' });
    }
  }

  private patch(id: number, changes: Partial<Shot>) {
    this.shots.update(list => list.map(s => (s.id === id ? { ...s, ...changes } : s)));
  }

  ngOnDestroy() {
    for (const s of this.shots()) if (s.preview) URL.revokeObjectURL(s.preview);
  }
}
