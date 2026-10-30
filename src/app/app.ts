import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private swUpdate = inject(SwUpdate);
  protected readonly updateReady = signal(false);

  constructor() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(
          filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.updateReady.set(true));
    }
  }

  reload() {
    this.swUpdate.activateUpdate().then(() => document.location.reload());
  }
}
