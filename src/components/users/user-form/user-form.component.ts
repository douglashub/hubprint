
import { ChangeDetectionStrategy, Component, effect, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '../../../services/data.service';

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
})
export class UserFormComponent {
  // FIX: Add explicit type to fb to fix type inference issue.
  fb: FormBuilder = inject(FormBuilder);

  user = input<User | null>(null);
  save = output<User>();
  cancel = output<void>();
  
  userForm = this.fb.group({
    id: [''],
    full_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    department: [''],
    role: ['user' as User['role'], Validators.required],
  });

  constructor() {
    effect(() => {
      const userToEdit = this.user();
      if (userToEdit) {
        this.userForm.patchValue(userToEdit);
      } else {
        this.userForm.reset({
          id: '',
          full_name: '',
          email: '',
          department: '',
          role: 'user',
        });
      }
    });
  }

  onSubmit(): void {
    if (this.userForm.valid) {
      this.save.emit(this.userForm.getRawValue() as User);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
