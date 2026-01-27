
import { Injectable, signal } from '@angular/core';

export interface Notification {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  notifications = signal<Notification[]>([]);

  show(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000) {
    const newNotification: Notification = {
      message,
      type,
      id: Date.now(),
    };

    this.notifications.update(current => [...current, newNotification]);

    setTimeout(() => {
      this.dismiss(newNotification.id);
    }, duration);
  }

  dismiss(id: number) {
    this.notifications.update(current => current.filter(n => n.id !== id));
  }
}
