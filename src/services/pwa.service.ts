import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class PwaService {
    private promptEvent: any;

    constructor() {
        window.addEventListener('beforeinstallprompt', event => {
            this.promptEvent = event;
            event.preventDefault(); // Prevent immediate default prompt
        });
    }

    public get promptEventValue() {
        return this.promptEvent;
    }

    public async installPwa(): Promise<void> {
        if (this.promptEvent) {
            this.promptEvent.prompt();
            const { outcome } = await this.promptEvent.userChoice;
            if (outcome === 'accepted') {
                this.promptEvent = null;
            }
        }
    }
}
