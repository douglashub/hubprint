
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CounterReaderComponent } from './counter-reader/counter-reader.component';

@Component({
  selector: 'app-counters',
  templateUrl: './counters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CounterReaderComponent],
  standalone: true,
})
export class CountersComponent {
}
