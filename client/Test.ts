import { BritaBrowser, BritaServer } from '@fokal-art/brita';
import { makeRequest } from './helpers/make-request';
import { getUser } from './requests/getUser';
import { createUser } from './requests/createUser';

export type TestOptions = {
	brita: BritaBrowser | BritaServer;
	maxRetryAttempts?: number;
};

export class Test {
	protected options: Required<TestOptions>;

	constructor({ brita, maxRetryAttempts = 4 }: TestOptions) {
		this.options = { brita, maxRetryAttempts };
	}

	public getUser = getUser;
	public createUser = createUser;

	protected makeRequest = makeRequest;
}
