import { ISecurityGroup, IVpc, SubnetSelection } from 'aws-cdk-lib/aws-ec2';

type VpcSettingsDefined = {
	/** The VPC that the Lambda handlers should run in. */
	vpc: IVpc;
	/** The VPC subnets that the Lambda handlers should run in. */
	vpcSubnets: SubnetSelection;
	/** The security groups that apply to the Lambda handlers. */
	securityGroups: ISecurityGroup[];
};

type VpcSettingsUndefined = {
	vpc: undefined;
	vpcSubnets: undefined;
	securityGroups: undefined;
};

/** The VPC settings.
 *
 * If one of these settings are provided, all of them should
 * be provided for the VPC to work.
 */
export type VpcSettings = VpcSettingsDefined | VpcSettingsUndefined;
