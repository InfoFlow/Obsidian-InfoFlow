import { requestUrl } from "obsidian";

const DEFAULT_ENDPOINT = "https://www.infoflow.app";

export interface FetchItemsParams {
	from?: string;
	to?: string;
	tags?: string[];
	folders?: string[];
	updatedAt?: string;
	page?: number;
	perPage?: number;
}

export interface Note {
	content: string;
	quotedText?: string;
}

export interface ExportedItem {
	id: string;
	title: string;
	content?: string;
	url?: string;
	itemType: string;
	tags: string[];
	createdAt: string;
	updatedAt: string;
	metadata?: {
		author?: string;
	};
	notes: Note[];
}

export interface PaginatedResponse {
	items: ExportedItem[];
	pagination: {
		totalItems: number;
		hasNextPage: boolean;
	};
}

export async function fetchItems(endpoint: string, token: string, params: FetchItemsParams): Promise<PaginatedResponse> {
	const queryParams = new URLSearchParams();
	if (params.from) queryParams.append('from', params.from);
	if (params.to) queryParams.append('to', params.to);
	if (params.tags) params.tags.forEach(tag => queryParams.append('tags[]', tag));
	if (params.folders) params.folders.forEach(folder => queryParams.append('folders[]', folder));
	if (params.updatedAt) queryParams.append('updatedAt', params.updatedAt);
	if (params.page) queryParams.append('page', params.page.toString());
	if (params.perPage) queryParams.append('perPage', params.perPage.toString());

	const response = await requestUrl({
		url: `${endpoint}/api/v1/external/export/items?${queryParams.toString()}`,
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (response.status !== 200) {
		throw new Error(`Failed to fetch items: ${response.status}`);
	}

	return response.json;
}
