import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

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
    expect(compiled.querySelector('.pricing-panel')).toBeTruthy();
    expect(compiled.querySelector('.bottom-popup')).toBeNull();

    component.setTheme('system');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });
});
