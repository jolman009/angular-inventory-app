import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Landing } from './landing';

describe('Landing', () => {
  let component: Landing;
  let fixture: ComponentFixture<Landing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Landing],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Landing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should switch preview card when selecting another media type', () => {
    component.selectType('vinyl');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.card .head')?.textContent).toContain('Abbey Road');
  });

  it('should link to Privacy Policy and Terms & Conditions in the footer', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const footerLinks = Array.from(compiled.querySelectorAll('footer a'));
    const hrefs = footerLinks.map(a => a.getAttribute('href'));
    expect(hrefs).toContain('/privacy');
    expect(hrefs).toContain('/terms');
  });
});
