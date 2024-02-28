import { config } from 'dotenv';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { CognitoUser} from 'amazon-cognito-identity-js';
import { ConfigService } from '@nestjs/config';

const cognitoClient = new CognitoIdentityProviderClient({});

const configService = new ConfigService();
// fetchListUsers
export const checkUserExists = async (email: string, username: string) => {
  const command = new ListUsersCommand({
    UserPoolId: configService.get('USER_POOL_ID'),
    Filter: `email = "${email}" or username = "${username}"`,
    Limit: 1
  });
  const { Users: users } = await cognitoClient.send(command);
  return users;
};

