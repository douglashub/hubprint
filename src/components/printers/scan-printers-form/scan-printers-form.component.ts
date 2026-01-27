
import { ChangeDetectionStrategy, Component, output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-scan-printers-form',
  templateUrl: './scan-printers-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
})
export class ScanPrintersFormComponent {
  // FIX: Add explicit type to fb to fix type inference issue.
  fb: FormBuilder = inject(FormBuilder);
  scan = output<{ startIp: string; endIp: string }>();
  cancel = output<void>();

  isScanning = signal(false);

  scanForm = this.fb.group({
    startIp: ['192.168.0.1', [Validators.required, Validators.pattern(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)]],
    endIp: ['192.168.0.254', [Validators.required, Validators.pattern(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)]],
    subnet: ['255.255.255.0']
  });

  onSubmit(): void {
    if (this.scanForm.valid) {
      this.isScanning.set(true);
      const { startIp, endIp } = this.scanForm.value;
      // Simulate scan delay before emitting
      setTimeout(() => {
        this.scan.emit({ startIp: startIp!, endIp: endIp! });
        this.isScanning.set(false);
      }, 2000); // Give user feedback that scan is happening
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
