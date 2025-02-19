import axios, { AxiosError } from "axios";

const DEFAULT_ENDPOINT = "https://www.infoflow.app";

interface Note {
	id: string;
	content: string;
	quotedText?: string;
	createdAt: string;
	metadata?: Record<string, any>;
}

interface ExportedItem {
	id: string;
	title: string;
	itemType: string;
	url?: string;
	content?: string;
	itemNote?: string;
	folderName?: string;
	previewImageUrl?: string;
	notes: Note[];
	tags: string[];
	metadata?: {
		source?: string;
		author?: string;
		readingProgress?: number;
	};
	createdAt: string;
	updatedAt: string;
}

interface PaginatedResponse {
	items: ExportedItem[];
	pagination: {
		currentPage: number;
		totalPages: number;
		totalItems: number;
		perPage: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	};
}

interface FetchItemsParams {
	from?: string;
	to?: string;
	tags?: string[];
	folders?: string[];
	updatedAt?: string;
	page?: number;
	perPage?: number;
}

async function fetchItems(
	endpoint: string = DEFAULT_ENDPOINT,
	apiToken: string,
	params: FetchItemsParams = {}
): Promise<PaginatedResponse> {
	try {
		const response = await axios.get<PaginatedResponse>(
			`${endpoint}/api/v1/external/export/items`,
			{
				headers: {
					Authorization: `Bearer ${apiToken}`,
				},
				params,
			}
		);
		return response.data;
	} catch (error) {
		if (error instanceof AxiosError) {
			if (error.response) {
				// Server responded with a status other than 200 range
				console.error("Error response:", error.response.data);
			} else if (error.request) {
				// Request was made but no response received
				console.error("Error request:", error.request);
			} else {
				// Something happened in setting up the request
				console.error("Error message:", error.message);
			}
		} else {
			// Something else happened
			console.error("Error:", error);
		}
		throw error;
	}
}

export { fetchItems };
export type { Note, ExportedItem, PaginatedResponse, FetchItemsParams };
