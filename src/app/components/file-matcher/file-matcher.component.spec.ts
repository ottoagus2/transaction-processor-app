import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileMatcherComponent } from './file-matcher.component';

describe('FileMatcherComponent', () => {
  let component: FileMatcherComponent;
  let fixture: ComponentFixture<FileMatcherComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileMatcherComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileMatcherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
