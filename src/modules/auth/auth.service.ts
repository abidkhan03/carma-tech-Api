import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { Hash } from '@app/utils/hash.util';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@modules/user/user.service';
import { User } from '@modules/user/user.entity';
import { SigninDto } from '@modules/auth/dto/signin.dto';
import { CognitoUserAttribute, CognitoUserPool } from 'amazon-cognito-identity-js';
import { RegisterRequestDto } from '@modules/auth/dto/register.dto';
import { fetchListUsers } from '@app/utils/helper.util';

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
  }

  public async registerUser(registerDto: RegisterRequestDto) {
    try {
      const input = {
        ClientId: this.configService.get('COGNITO_USER_CLIENT_ID'),
        Username: registerDto.email,
        Password: registerDto.password,
        UserAttributes: [
          {
            Name: 'name',
            Value: registerDto.name
          },
          {
            Name: 'email',
            Value: registerDto.email
          }
        ],
      };
      const signupCommand = new SignUpCommand(input);
      const response = await this.cognitoIdentity.send(signupCommand);
      return {
        message: 'Success',
        detaisl: response,
      };
    } catch (error) {
      const awsError = error as AWSError;
      let message: string;
      switch (awsError.name) {
        case 'UsernameExistsException':
          message = 'User already exists.';
          break;
        case 'InvalidParameterException':
          message = 'Invalid parameters provided';
          break;
        case 'TooManyRequestsException':
          message = 'Too many requests, please try again later';
          break;
        default:
          message = `An unexpected error occurred ${awsError.message}`;
          break;
      }
      return { message: message, details: awsError };

    }
  }

  public async confirmSignUp(email: string, code: string) {
    try {
      const input = {
        ClientId: this.configService.get('COGNITO_USER_CLIENT_ID'),
        Username: email,
        ConfirmationCode: code
      };
      const confirmSignUpCommand = new ConfirmSignUpCommand(input);
      const response = await this.cognitoIdentity.send(confirmSignUpCommand);
      return response;
      
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
