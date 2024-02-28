import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { Hash } from '@app/utils/hash.util';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@modules/user/user.service';
import { User } from '@modules/user/user.entity';
import { SigninDto } from '@modules/auth/dto/signin.dto';
import { CognitoUserAttribute, CognitoUserPool, CognitoUser, AuthenticationDetails, appendToCognitoUserAgent } from 'amazon-cognito-identity-js';
import { RegisterRequestDto } from '@modules/auth/dto/register.dto';
import { checkUserExists } from '@app/utils/helper.util';
import { Logger } from '@aws-lambda-powertools/logger';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

import cognito, {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  DeliveryMediumType,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'crypto';

@Injectable()
export class AuthService {
  private userPool: CognitoUserPool;
  private cognitoIdentity: CognitoIdentityProviderClient;
  private snsNotification: SNSClient;
  private snsTopicArn: string;
  private readonly logger = new Logger();
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
  ) {
    this.userPool = new CognitoUserPool({
      UserPoolId: this.configService.get<string>('USER_POOL_ID'),
      ClientId: this.configService.get<string>('COGNITO_USER_CLIENT_ID'),
    });
    this.cognitoIdentity = new CognitoIdentityProviderClient({ region: this.configService.get<string>('REGION') });
    this.snsTopicArn = this.configService.get<string>('SNS_TOPIC_ARN');
  }

  async sendSnsNotification(message: string) {
    this.logger.info(`SNS notification message: ${message}`);
    try {
      const command = new PublishCommand({
        TopicArn: this.snsTopicArn,
        Message: message,
        Subject: "Cognito User Management Error",
      });
      console.log(`Command: ${JSON.stringify(command)}`);
      await this.snsNotification.send(command);
    } catch (error) {
      this.logger.error("Failed to send SNS notification", error);
      throw error;
    }
  }

  async registerCognito(authRegisterRequest: RegisterRequestDto) {
    const { name, email, username, password } = authRegisterRequest;

    // Check if user already exists
    const userExists = await checkUserExists(email, username);
    if (userExists) {
      throw new ConflictException('User email already exists');
    }

    // Check if password and confirm password match
    // if (password !== passwordConfirmation) {
    //   throw new ConflictException('Passwords do not match');
    // }

    // Attempt to register the user in Cognito
    return new Promise((resolve, reject) => {
      this.userPool.signUp(
        username,
        password,
        [
          new CognitoUserAttribute({ Name: 'email', Value: email }),
          new CognitoUserAttribute({ Name: 'name', Value: name }),
          // new CognitoUserAttribute({ Name: 'custom:passwordConfirmation', Value: passwordConfirmation }),
        ],
        [],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result.user);
          }
        },
      );
    });
  }

  // Authenticate user (signin)
  async authenticate(user: SigninDto) {
    const { email, password } = user;
    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });
    const userData = {
      Username: email,
      Pool: this.userPool,
    };
    const newUser = new CognitoUser(userData);
    return new Promise((resolve, reject) => {
      return newUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          resolve(result);
        },
        onFailure: (err) => {
          reject(err);
        },
      });
    });
  }

  public async registerUser(registerDto: RegisterRequestDto) {
    // check if user exists in cognito
    const userExists = await checkUserExists(registerDto.email, registerDto.username);
    if (userExists.length > 0) {
      throw new ConflictException('User already exists');
    }
    // check if password and password confirmation match

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
      return {
        message: message, details: awsError,
        httpStatusCode: awsError.$metadata.httpStatusCode,
      };

    }
  }

  public async confirmSignUp(email: string, confirmCode: string) {
    try {
      const input = {
        ClientId: this.configService.get<string>('COGNITO_USER_CLIENT_ID'),
        Username: email,
        ConfirmationCode: confirmCode,
        DeliveryMediumType: 'Email' || 'SMS'
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

  async resendConfirmationCode(email: string) {
    try {
      const input = {
        ClientId: this.configService.get<string>('COGNITO_USER_CLIENT_ID'),
        Username: email,
      };
      const resendCommand = new ResendConfirmationCodeCommand(input);
      const response = await this.cognitoIdentity.send(resendCommand);
      return {
        statusCode: response.$metadata.httpStatusCode,
        message: 'Confirmation code resent successfully, please check your email',
      };
    } catch (error) {
      const awsError = error as AWSError;
      this.logger.error(`awsError: ${JSON.stringify(awsError)}`);
      return {
        message: awsError.name,
        statusCode: awsError.$metadata.httpStatusCode
      }
    }
  }

  public async forgotPassword(email: RegisterRequestDto['email']) {
    try {
      const input = {
        ClientId: this.configService.get<string>('COGNITO_USER_CLIENT_ID'),
        Username: email,
      }
      this.logger.info(`input: ${JSON.stringify(input)}`);

      const forgotCommand = new ForgotPasswordCommand(input);
      this.logger.info(`forgotCommand: ${JSON.stringify(forgotCommand)}`);
      const response = await this.cognitoIdentity.send(forgotCommand);
      this.logger.info(`response: ${JSON.stringify(response)}`);
      return {
        statusCode: response.$metadata.httpStatusCode,
        message: 'Password reset link sent successfully',
      };

    } catch (error) {
      const awsError = error as AWSError;
      let message: string;
      switch (awsError.name) {
        case 'UserNotFoundException':
          message = 'User not found.';
          break;
        case 'NotAuthorizedException':
          message = 'Not authorized.';
          break;
        default:
          message = `An unexpected error occurred ${awsError.message}`;
          break;
      }
      this.logger.error(`awsError: ${JSON.stringify(awsError)}`);
      // Send SNS notification
      await this.sendSnsNotification(message);
      return { message: message, details: awsError };
    }
  }


  async confirmForgotPassword(email: string, confirmCode: string, password: string) {
    try {
      const input = {
        ClientId: this.configService.get('COGNITO_USER_CLIENT_ID'),
        Username: email,
        ConfirmationCode: confirmCode,
        Password: password,
      }

      const confirmForgotPasswdCommand = new ConfirmForgotPasswordCommand(input);
      const response = await this.cognitoIdentity.send(confirmForgotPasswdCommand);
      return {
        statusCode: response.$metadata.httpStatusCode,
        message: 'Password reset successfully',
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
      return { message: message, details: awsError }
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
