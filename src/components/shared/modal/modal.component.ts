
import { ChangeDetectionStrategy, Component, output, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class ModalComponent {
  isOpen = input.required<boolean>();
  title = input<string>('');
  size = input<'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'>('lg');
  closeModal = output<void>();

  modalWidthClass = computed(() => {
    switch(this.size()) {
      case 'sm': return 'max-w-sm';
      case 'md': return 'max-w-sm sm:max-w-md';
      case 'lg': return 'max-w-sm sm:max-w-lg';
      case 'xl': return 'max-w-sm sm:max-w-xl';
      case '2xl': return 'max-w-sm sm:max-w-2xl';
      case '3xl': return 'max-w-sm sm:max-w-3xl';
      case '4xl': return 'max-w-sm sm:max-w-4xl';
      case '5xl': return 'max-w-sm sm:max-w-5xl';
      default: return 'max-w-sm sm:max-w-lg';
    }
  });

  onClose() {
    this.closeModal.emit();
  }
}
