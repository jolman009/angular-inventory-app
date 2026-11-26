import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ItemStore } from '../item-store';
import { ItemList } from './item-list';

describe('ItemList', () => {
  let component: ItemList;
  let fixture: ComponentFixture<ItemList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemList],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open and close the workspace drawer when adding an item', () => {
    component.openAdd();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.drawer')).toBeTruthy();

    component.closeDrawer();
    fixture.detectChanges();
    expect(compiled.querySelector('.drawer')).toBeNull();
  });

  it('should toggle mobile profile popup, switch theme, and open membership pricing', () => {
    component.togglePopup('profile');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.bottom-popup')).toBeTruthy();

    component.setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    component.openPricing();
    fixture.detectChanges();
    expect(compiled.querySelector('app-plan-panel')).toBeTruthy();
    expect(compiled.querySelector('.bottom-popup')).toBeNull();

    component.setTheme('system');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('tells apart an empty collection from filters that hide every item', () => {
    const store = TestBed.inject(ItemStore);
    const el = fixture.nativeElement as HTMLElement;

    store.loading.set(false); // the real load() is still waiting on the network in tests
    store.items.set([]);
    fixture.detectChanges();
    expect(el.querySelector('.items li.empty')?.textContent).toContain('Your collection is empty');

    store.items.set([
      {
        id: '1',
        type: 'book',
        title: 'Dune',
        status: 'owned',
        condition: null,
        purchase_price: null,
        notes: null,
        details: {},
        image_path: null,
        draft: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    store.search.set('zzz');
    fixture.detectChanges();
    const empty = el.querySelector('.items li.empty');
    expect(empty?.textContent).toContain('No items match');

    (empty?.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(store.search()).toBe('');
    expect(el.querySelector('.items li.empty')).toBeNull();
  });

  it('closes the top-most layer with Escape: pop-up first, then drawer', () => {
    const el = fixture.nativeElement as HTMLElement;
    component.openImport();
    component.togglePopup('profile');
    fixture.detectChanges();
    expect(el.querySelector('.bottom-popup')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.bottom-popup')).toBeNull();
    expect(el.querySelector('.drawer')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.drawer')).toBeNull();
  });

  it('gives every item a keyboard-reachable button that opens the inspector', () => {
    const store = TestBed.inject(ItemStore);
    store.loading.set(false);
    store.items.set([
      {
        id: '1',
        type: 'book',
        title: 'Dune',
        status: 'owned',
        condition: null,
        purchase_price: null,
        notes: null,
        details: {},
        image_path: null,
        draft: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const open = el.querySelector<HTMLButtonElement>('.item-open');
    expect(open).toBeTruthy();
    open!.click();
    fixture.detectChanges();
    expect(el.querySelector('.inspector h2')?.textContent).toContain('Dune');
    // no misused ARIA roles
    expect(el.querySelector('[role=menu], [role=menuitem], [role=tab], [role=tablist]')).toBeNull();
  });

  it('puts the open panel and filters in the address bar', async () => {
    const router = TestBed.inject(Router);
    const store = TestBed.inject(ItemStore);
    component.openAdd();
    store.statusFilter.set('for_sale');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).toBe('/?panel=add&status=for_sale');
  });

  it('asks before leaving the page with unsaved edits', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(component.canLeave()).toBe(true); // nothing open: no question
    expect(confirmSpy).not.toHaveBeenCalled();

    component.openAdd();
    fixture.detectChanges();
    const form = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[formcontrolname=title]',
    )!;
    form.value = 'Half typed';
    form.dispatchEvent(new Event('input'));

    expect(component.canLeave()).toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith('Discard your unsaved changes?');
    confirmSpy.mockRestore();
  });
});
