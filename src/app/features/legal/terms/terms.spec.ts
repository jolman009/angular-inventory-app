import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Terms } from './terms';

describe('Terms', () => {
  let component: Terms;
  let fixture: ComponentFixture<Terms>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Terms],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Terms);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render terms and conditions heading and account deletion instructions', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Terms & Conditions');
    const deletionSection = compiled.querySelector('#account-deletion');
    expect(deletionSection).toBeTruthy();
    expect(deletionSection?.textContent).toContain('Account Termination and Stored Data Deletion');
    expect(deletionSection?.textContent).toContain('Delete account & data');
  });
});
