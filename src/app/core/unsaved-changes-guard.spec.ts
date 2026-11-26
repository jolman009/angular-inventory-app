import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes-guard';

describe('unsavedChangesGuard', () => {
  const run = (page: HasUnsavedChanges) =>
    unsavedChangesGuard(page, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot);

  it('lets the user leave when the page says so', () => {
    expect(run({ canLeave: () => true })).toBe(true);
  });

  it('keeps the user on the page when they cancel', () => {
    expect(run({ canLeave: () => false })).toBe(false);
  });
});
