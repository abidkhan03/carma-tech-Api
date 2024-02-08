import { config } from 'dotenv';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { ConfigService } from '@nestjs/config';

const cognitoClient = new CognitoIdentityProviderClient({});

const configService = new ConfigService();
// fetchListUsers
export const checkUserExists = async (username: string, email: string) => {
  const command = new ListUsersCommand({
    UserPoolId: configService.get('USER_POOL_ID'),
    // filter by username or email
    Filter: `username = "${username}" OR email = "${email}"`,
  });
  const { Users: users } = await cognitoClient.send(command);
  return users;
};

