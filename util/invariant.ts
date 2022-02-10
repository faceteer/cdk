export function invariant(condition: unknown): asserts condition {
	if (condition) {
		return;
	}
	throw new Error('Invariant condition failed');
}
