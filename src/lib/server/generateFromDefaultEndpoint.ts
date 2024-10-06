import { smallModel } from "./models";
import type { EndpointMessage } from "./endpoints/endpoints";
import { getCachedKeyValues, setCachedKeyValues } from "./kvCache";

export async function generateFromDefaultEndpoint({
	messages,
	preprompt,
	generateSettings,
	contextId,
}: {
	messages: EndpointMessage[];
	preprompt?: string;
	generateSettings?: Record<string, unknown>;
	contextId?: string;
}): Promise<string> {
	const endpoint = await smallModel.getEndpoint();

	let endpointParams: any = { messages, preprompt, generateSettings };

	// Use KV cache if contextId is provided
	if (contextId) {
		const cachedKeyValues = getCachedKeyValues(contextId);
		if (cachedKeyValues) {
			endpointParams.past_key_values = cachedKeyValues;
		}
	}

	const tokenStream = await endpoint(endpointParams);

	let lastOutput: any;

	for await (const output of tokenStream) {
		lastOutput = output;
		// if generated_text is here it means the generation is done
		if (output.generated_text) {
			let generated_text = output.generated_text;
			for (const stop of [...(smallModel.parameters?.stop ?? []), "<|endoftext|>"]) {
				if (generated_text.endsWith(stop)) {
					generated_text = generated_text.slice(0, -stop.length).trimEnd();
				}
			}

			// Store the new key-values in the cache if contextId is provided
			if (contextId && output.past_key_values) {
				setCachedKeyValues(contextId, output.past_key_values);
			}

			return generated_text;
		}
	}

	// If the loop completes without returning, check the last output
	if (contextId && lastOutput && lastOutput.past_key_values) {
		setCachedKeyValues(contextId, lastOutput.past_key_values);
	}

	throw new Error("Generation failed");
}
