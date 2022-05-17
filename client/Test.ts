import { Gandalf } from '@tailwind/gandalf';
import { makeRequest } from './helpers/make-request';
import { getUser } from './requests/getUser';
import { createUser } from './requests/createUser';

export type TestOptions = {
	gandalf: Gandalf;
	maxRetryAttempts?: number;
};

export class Test {
	protected options: Required<TestOptions>;

	constructor({ gandalf, maxRetryAttempts = 4 }: TestOptions) {
		this.options = { gandalf, maxRetryAttempts };
	}

	public getUser = getUser;
	public createUser = createUser;

	protected makeRequest = makeRequest;
}
