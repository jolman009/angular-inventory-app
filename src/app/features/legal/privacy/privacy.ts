import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../../../core/brand';
import { Supabase } from '../../../core/supabase';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink, NgOptimizedImage],
  templateUrl: './privacy.html',
  styleUrl: './privacy.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Privacy {
  protected readonly supabase = inject(Supabase);
  protected readonly brand = BRAND;
  protected readonly year = new Date().getFullYear();
  protected readonly effectiveDate = 'November 5, 2026';
}
