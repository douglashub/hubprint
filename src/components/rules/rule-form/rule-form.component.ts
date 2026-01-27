
import { ChangeDetectionStrategy, Component, effect, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PrintRule, DataService } from '../../../services/data.service';

@Component({
  selector: 'app-rule-form',
  templateUrl: './rule-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
})
export class RuleFormComponent {
  // FIX: Add explicit type to fb to fix type inference issue.
  fb: FormBuilder = inject(FormBuilder);
  dataService = inject(DataService);

  rule = input<PrintRule | null>(null);
  save = output<PrintRule>();
  cancel = output<void>();

  users = this.dataService.users;
  departments = this.dataService.getDepartments();
  
  ruleForm = this.fb.group({
    id: [''],
    description: ['', Validators.required],
    // Fix: Widen form control types to match the PrintRule interface.
    type: ['quota' as PrintRule['type'], Validators.required],
    scope: ['department' as PrintRule['scope'], Validators.required],
    target_id: ['', Validators.required],
    target_name: [''],
    limit_pages: [null as number | null],
    limit_cost: [null as number | null],
    action: ['alert' as PrintRule['action'], Validators.required],
    is_active: [true, Validators.required],
  });

  constructor() {
    effect(() => {
      const ruleToEdit = this.rule();
      if (ruleToEdit) {
        this.ruleForm.patchValue(ruleToEdit);
      } else {
        this.ruleForm.reset({
          id: '',
          description: '',
          type: 'quota',
          scope: 'department',
          target_id: '',
          target_name: '',
          limit_pages: 1000,
          limit_cost: null,
          action: 'alert',
          is_active: true
        });
      }
    });

    // Reset target when scope changes
    this.ruleForm.get('scope')?.valueChanges.subscribe(() => {
        this.ruleForm.get('target_id')?.setValue('');
    });
  }

  onSubmit(): void {
    if (this.ruleForm.valid) {
      const formValue = this.ruleForm.getRawValue();
      
      // Set target_name based on selection
      if (formValue.scope === 'user') {
          const selectedUser = this.users().find(u => u.id === formValue.target_id);
          formValue.target_name = selectedUser?.full_name || '';
      } else {
          formValue.target_name = formValue.target_id;
      }

      this.save.emit(formValue as PrintRule);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
