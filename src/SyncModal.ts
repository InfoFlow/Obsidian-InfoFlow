import { Modal, App } from 'obsidian';

export default class SyncModal extends Modal {
	private progressEl: HTMLElement;
	private errorEl: HTMLElement;

	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.progressEl = contentEl.createDiv('progress');
		this.progressEl.setText('Starting sync...');

		this.errorEl = contentEl.createDiv('error');
		this.errorEl.hide();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	setProgress(message: string) {
		this.progressEl.setText(message);
		this.errorEl.hide();
	}

	setError(message: string) {
		this.errorEl.setText(message);
		this.errorEl.show();
	}
} 