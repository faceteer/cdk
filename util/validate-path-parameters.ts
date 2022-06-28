const regex = /\{[a-zA-Z_$0-9+]+\}/g;

export const getParametersFromRoute = (route: string) => {
	const matched = route.match(regex);
	if (!matched) return [];
	const params = matched.map((param) =>
		param.substring(1, param.length - 1).replace('+', ''),
	);
	return params;
};

export const validatePathParameters = (route: string, parameters: string[]) => {
	const routeParameters = getParametersFromRoute(route);
	routeParameters.sort();
	parameters.sort();
	if (JSON.stringify(routeParameters) !== JSON.stringify(parameters)) {
		throw new Error(
			`The Api route ${route} does not have properly configured path parameters`,
		);
	}
};
