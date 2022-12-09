import { CronHandler } from '../../../handlers';

export const handler = CronHandler(
	{
		name: 'queue-pulls',
		schedule: {
			expressionString: 'cron(0 4 * * ? *)',
		},
	},
	async (event) => {
		console.log(event.time);
	},
);
