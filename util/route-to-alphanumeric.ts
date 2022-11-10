/**
 * Takes a route string, such as /users/{userId}/emails and removes non-alphanumeric characters, attempting to maintain string-uniqueness.
 * Since we DO want this to change if the actual route were to change, this addition of the "hash" in the logical id should be safe IN THIS CASE.
 *  This just helps us avoid cases where you'd end up with the same logical id otherwise, like /foo/bar and /foobar or /foo/{bar}.
 * @param route
 */
export const routeToAlphaNumeric = (route: string): string => {
	return `${route}${hashString(route).toString(16)}`.replace(
		// match all non-alphanumeric characters
		/[^A-Za-z0-9]/g,
		'',
	);
};

/**
 * Function found on stackoverflow that generates a 32 bit integer hash for our string
 * @param s
 * @returns
 */
function hashString(s: string) {
	let h: number = 0;
	for (let i = 0; i < s.length; i++)
		h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
	return h;
}
