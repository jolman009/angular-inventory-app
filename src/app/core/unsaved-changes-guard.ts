import { CanDeactivateFn } from '@angular/router';

/** A page that may hold edits the user hasn't saved yet. */
export interface HasUnsavedChanges {
  /** Returns true when it's fine to leave, asking the user first if needed. */
  canLeave(): boolean;
}

/** Asks before navigating away from a page with unsaved edits. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = component =>
  component?.canLeave ? component.canLeave() : true;
