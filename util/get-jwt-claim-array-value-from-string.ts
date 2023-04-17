/**
 * AWS returns array claims on a JWT in a strange way. If you have an array
 * like this
 *
 * ```json
 * ["864128384660228893", "698902573331070747", "240098361292620967"]
 * ```
 *
 * You'll get a string that looks like this
 * ```js
 * "[864128384660228893 698902573331070747 240098361292620967]"
 * ```
 *
 * with no commas or quotes around the items. This is a simple way to parse
 * out the values and turn them back into an array.
 *
 * It will always be an array of strings, even though the input could
 * theoretically be anything
 * @param value string
 */
export function getJwtClaimArrayValueFromString(value: string): string[] {
	const isProperFormat = value.match(/[\[].*[\]]/);

	if (!isProperFormat) {
		throw new Error('Claim is not the expected AWS array type');
	}

	let cleanedUpValue = value.replace(/[\[|\]]/g, '');
	return cleanedUpValue.split(' ');
}
