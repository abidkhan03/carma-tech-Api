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
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'crypto';

@Injectable()
export class AuthService {
  private userPool: CognitoUserPool;
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
          message = 'An unexpected error occurred';
      }
      return { message: message, details: awsError };

    }
  }

  async register(authRegisterRequest: RegisterRequestDto) {
    const { name, email, password } = authRegisterRequest;
    console.log("UserPoolId: ", this.configService.get('USER_POOL_ID'));
    console.log("ClientId: ", this.configService.get('COGNITO_USER_CLIENT_ID'));
    const userPoolId = this.configService.get('USER_POOL_ID');
    const clientId = this.configService.get('COGNITO_USER_CLIENT_ID');
    if (!userPoolId || !clientId) {
      throw new Error("UserPoolId or ClientId is not defined.");
    }
    // check email is existed
    const existedUser = await fetchListUsers(email);
    if (existedUser.length > 0) throw new Error('The email is duplicated.');

    this.userPool = new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
    });

    return new Promise((resolve, reject) => {
      return this.userPool.signUp(
        name,
        password,
        [new CognitoUserAttribute({ Name: 'email', Value: email })],
        null,
        (err, result) => {
          if (!result) {
            reject(err);
          } else {
            resolve(result.user);
          }
        },
      );
    });
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
