import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuickCapture } from './quick-capture';

describe('QuickCapture', () => {
  let component: QuickCapture;
  let fixture: ComponentFixture<QuickCapture>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickCapture],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickCapture);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
