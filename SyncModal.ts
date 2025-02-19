import { App, Modal } from 'obsidian';

export default class SyncModal extends Modal {
	private progressEl: HTMLElement;
	private errorEl: HTMLElement;

	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.progressEl = contentEl.createEl('div', { text: 'Syncing...' });
		this.errorEl = contentEl.createEl('div', { cls: 'sync-error', text: '' });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	setProgress(message: string) {
		this.progressEl.setText(message);
	}

	setError(message: string) {
		this.errorEl.setText(message);
		this.errorEl.addClass('visible');
	}
}
