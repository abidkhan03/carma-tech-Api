import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { Hash } from '@app/utils/hash.util';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@modules/user/user.service';
import { User } from '@modules/user/user.entity';
import { SigninDto } from '@modules/auth/dto/signin.dto';
import { CognitoUserAttribute, CognitoUserPool } from 'amazon-cognito-identity-js';
import { RegisterRequestDto } from '@modules/auth/dto/register.dto';
import { checkUserExists } from '@app/utils/helper.util';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

import cognito, {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'crypto';

@Injectable()
export class AuthService {
  // private userPool: CognitoUserPool;
  private cognitoIdentity: CognitoIdentityProviderClient;
  private snsClient: SNSClient;
  private snsTopicArn: string;
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
  ) {
    // this.userPool = new CognitoUserPool({
    //   UserPoolId: this.configService.get('USER_POOL_ID') || 'us-east-2_0Pitx53J7',
    //   ClientId: this.configService.get('COGNITO_USER_CLIENT_ID') || '5l1nf7orlu8lai7dpu83rs9551',
    // });
    this.cognitoIdentity = new CognitoIdentityProviderClient({ region: 'us-east-2' });
    this.snsClient = new SNSClient({ region: 'us-east-2' });
    this.snsTopicArn = this.configService.get('SNS_TOPIC_ARN');
  }

  // Send SNS notification handler
  async sendSnsNotification(message: string): Promise<void> {
    try {
      const command = new PublishCommand({
        TopicArn: this.snsTopicArn,
        Message: message,
        Subject: "Cognito User Management Error",
      });
      await this.snsClient.send(command);
    } catch (error) {
      console.error("Failed to send SNS notification.", error);
    }
  }

  public async registerUser(registerDto: RegisterRequestDto) {
    // check if user exists in cognito
    const userExists = await checkUserExists(registerDto.email);
    if (userExists.length > 0) {
      throw new ConflictException('User email already exists');
    }
    // check if password and password confirmation match
    // if (registerDto.password !== registerDto.passwordConfirmation) {
    //   throw new ConflictException('Passwords do not match');
    // }

    let attributes = [
      { Name: 'name', Value: registerDto.name },
      { Name: 'username', Value: registerDto.username },
      { Name: 'email', Value: registerDto.email },
    ];
    // let customAttribute = {
    //   Name: 'custom:passwordConfirmation',
    //   Value: registerDto.passwordConfirmation
    // }
    // attributes.push(new CognitoUserAttribute(customAttribute));

    try {
      const input = {
        ClientId: this.configService.get('COGNITO_USER_CLIENT_ID'),
        Username: registerDto.username,
        Password: registerDto.password,
        UserAttributes: attributes,
        ValidationData: attributes,
      };
      const signupCommand = new SignUpCommand(input);
      const response = await this.cognitoIdentity.send(signupCommand);
      const email = registerDto.email;
      return {
        statusCode: response.$metadata.httpStatusCode,
        message: `User created successfully, check your email ${email} to confirm your account`,
      };
    } catch (error) {
      const awsError = error as AWSError;
      let message: string;
      switch (awsError.name) {
        case 'UsernameExistsException':
          message = 'User already exists.';
          break;
        case 'InvalidParameterException':
          message = `Invalid parameters provided ${awsError.message}`;
          break;
        case 'UserNotFoundException':
          break;
        case 'TooManyRequestsException':
          message = 'Too many requests, please try again later';
          break;
        default:
          message = `An unexpected error occurred ${awsError.message}`;
          break;
      }
      // Send SNS notification
      await this.sendSnsNotification(message);
      return { message: message, details: awsError };

    }
  }

  public async confirmSignUp(username: string, code: string) {
    try {
      const input = {
        ClientId: this.configService.get('COGNITO_USER_CLIENT_ID'),
        Username: username,
        ConfirmationCode: code
      };
      const confirmSignUpCommand = new ConfirmSignUpCommand(input);
      const response = await this.cognitoIdentity.send(confirmSignUpCommand);
      return {
        statusCode: response.$metadata.httpStatusCode,
        message: 'User confirmed successfully',
      };

    } catch (error) {
      const awsError = error as AWSError;
      let message: string;
      switch (awsError.name) {
        case 'UserNotFoundException':
          message = 'User not found.';
          break;
        case 'CodeMismatchException':
          message = 'Code mismatch.';
          break;
        case 'NotAuthorizedException':
          message = 'Not authorized.';
          break;
        case 'ExpiredCodeException':
          message = 'Expired code.';
          break;
        default:
          message = `An unexpected error occurred ${awsError.message}`;
          break;
      }
      // Send SNS notification
      await this.sendSnsNotification(message);
      return { message: message, details: awsError };
    }
  }

  async createToken(user: User) {
    return {
      expiresIn: this.configService.get('JWT_EXPIRATION_TIME'),
      accessToken: this.jwtService.sign({ id: user.id }),
      user,
    };
  }

  async validateUser(signinDto: SigninDto): Promise<any> {
    const user = await this.userService.getByEmail(signinDto.email);
    if (!user || !Hash.compare(signinDto.password, user.password)) {
      throw new UnauthorizedException('Invalid credentials!');
    }
    return user;
  }
}

interface AWSError extends Error {
  name: string; // Name of the exception
  $metadata: { httpStatusCode: number };
}
