import type { WebSearchSource } from "../../../types/WebSearch";
import type { Message } from "../../../types/Message";
import type { Assistant } from "../../../types/Assistant";
import { getWebSearchProvider, searchWeb } from "./endpoints";
import { generateQuery } from "./generateQuery";
import { isURLStringLocal } from "../../isURLLocal";
import { isURL } from "../../../utils/isUrl";

import z from "zod";
import JSON5 from "json5";
import { env } from "$env/dynamic/private";
import { makeGeneralUpdate } from "../update";
import type { MessageWebSearchUpdate, MessageWebSearchGeneralUpdate } from "../../../types/MessageUpdate";

const listSchema = z.array(z.string()).default([]);
const allowList = listSchema.parse(JSON5.parse(env.WEBSEARCH_ALLOWLIST));
const blockList = listSchema.parse(JSON5.parse(env.WEBSEARCH_BLOCKLIST));

export async function* search(
	messages: Message[],
	ragSettings?: Assistant["rag"],
	query?: string,
	conversationId?: string
): AsyncGenerator<
	MessageWebSearchUpdate,
	{ searchQuery: string; pages: WebSearchSource[] },
	undefined
> {
	if (ragSettings && ragSettings?.allowedLinks.length > 0) {
		yield makeGeneralUpdate({ message: "Using links specified in Assistant", args: [] });
		return {
			searchQuery: "",
			pages: await directLinksToSource(ragSettings.allowedLinks).then(filterByBlockList),
		};
	}

	const searchQuery = query ?? (await generateQuery(messages, conversationId || 'default'));
	yield makeGeneralUpdate({ message: `Searching ${getWebSearchProvider()}`, args: [searchQuery] });

	// handle the global and (optional) rag lists
	if (ragSettings && ragSettings?.allowedDomains.length > 0) {
		yield makeGeneralUpdate({ message: "Filtering on specified domains", args: [] });
	}
	const filters = buildQueryFromSiteFilters(
		[...(ragSettings?.allowedDomains ?? []), ...allowList],
		blockList
	);

	const searchQueryWithFilters = `${filters} ${searchQuery}`;
	const searchResults = await searchWeb(searchQueryWithFilters).then(filterByBlockList);

	return {
		searchQuery: searchQueryWithFilters,
		pages: searchResults,
	};
}

// ----------
// Utils
function filterByBlockList(results: WebSearchSource[]): WebSearchSource[] {
	return results.filter((result) => !blockList.some((blocked: string) => result.link.includes(blocked)));
}

function buildQueryFromSiteFilters(allow: string[], block: string[]) {
	return (
		allow.map((item) => "site:" + item).join(" OR ") +
		" " +
		block.map((item) => "-site:" + item).join(" ")
	);
}

async function directLinksToSource(links: string[]): Promise<WebSearchSource[]> {
	if (env.ENABLE_LOCAL_FETCH !== "true") {
		const localLinks = await Promise.all(links.map(isURLStringLocal));
		links = links.filter((_, index) => !localLinks[index]);
	}

	return links.filter(isURL).map((link) => ({
		link,
		title: "",
		text: [""],
	}));
}
