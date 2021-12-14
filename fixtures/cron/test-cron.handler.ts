import { CronHandler } from '../../handlers';
import { Schedule } from 'aws-cdk-lib/aws-events';

export const handler = CronHandler(
	{
		name: 'queue-pulls',
		schedule: Schedule.cron({
			hour: '4',
			minute: '0',
		}),
	},
	async (event) => {
		console.log(event.time);
	},
);
