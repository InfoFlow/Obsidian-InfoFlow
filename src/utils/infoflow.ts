import { ExportedItem, FetchItemsParams, fetchItems } from '../infoflow-api';
import { Notice } from 'obsidian';
import TurndownService from 'turndown';

const turndown = new TurndownService({
	headingStyle: 'atx',
	codeBlockStyle: 'fenced'
});

export function convertHtmlToMarkdown(content: string): string {
	// Simple check if content looks like HTML
	if (content.includes('</') || content.includes('/>')) {
		try {
			return turndown.turndown(content);
		} catch (error) {
			console.error('Error converting HTML to Markdown:', error);
			return content;
		}
	}
	return content;
}

export async function fetchAllItems(
	endpoint: string,
	apiToken: string,
	params: FetchItemsParams = {},
	progressCallback?: (current: number, total: number) => void
): Promise<ExportedItem[]> {
	const allItems: ExportedItem[] = [];
	let currentPage = 1;
	let hasNextPage = true;

	try {
		while (hasNextPage) {
			const response = await fetchItems(endpoint, apiToken, {
				...params,
				page: currentPage,
				perPage: 100 // Use maximum allowed per page
			});

			allItems.push(...response.items);

			// Update progress if callback provided
			if (progressCallback) {
				progressCallback(allItems.length, response.pagination.totalItems);
			}

			hasNextPage = response.pagination.hasNextPage;
			currentPage++;
		}

		return allItems;
	} catch (error) {
		console.error('Error fetching all items:', error);
		throw error;
	}
} 