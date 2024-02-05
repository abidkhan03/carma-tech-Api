import { User } from './../user/user.entity';
import {
  Controller,
  Body,
  Post,
  UseGuards,
  Get,
  Request,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '@modules/auth/auth.service';
import { SigninDto } from '@modules/auth/dto/signin.dto';
import { SignupDto } from '@modules/auth/dto/signup.dto';
import { UsersService } from '@modules/user/user.service';
import { IRequest } from '@modules/user/user.interface';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Lambda } from 'aws-sdk';
import { ConfigService } from '@nestjs/config';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from 'amazon-cognito-identity-js';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { sign } from 'crypto';

@Controller('api/auth')
@ApiTags('authentication')
export class AuthController {
  private lambdaClient: LambdaClient;
  private readonly userPool: CognitoUserPool;
  private readonly provideClient: CognitoIdentityProviderClient;
  private readonly logger = new Logger();
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UsersService,
    private readonly configService: ConfigService
  ) {

    this.lambdaClient = new LambdaClient({
      region: 'us-east-2',
    });

      this.userPool = new CognitoUserPool({
        UserPoolId: this.configService.get('USER_POOL_ID'),
        ClientId: this.configService.get('COGNITO_USER_CLIENT_ID'),
      });
    
      this.provideClient = new CognitoIdentityProviderClient({
        region: 'us-east-2',
      });
  }


  @Post('signin')
  @ApiResponse({ status: 201, description: 'Successful Login' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async signin(@Body() signinDto: SigninDto): Promise<any> {
    const user = await this.authService.validateUser(signinDto);
    return await this.authService.createToken(user);
  }

  @Post('register')
  @ApiResponse({ status: 201, description: 'Successful Registration' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async register(@Body() signupDto: SignupDto): Promise<any> {
    const existingUser = await this.userService.getByEmailOrPhone(signupDto.email, signupDto.phone);
    if (existingUser) {
      if (existingUser.email === signupDto.email && existingUser.phone === signupDto.phone) {
        this.logger.error(`User with provided email and phone number already exist: ${JSON.stringify(existingUser)}`);
        throw new ConflictException('User with provided email and phone number already exist');

      } else if (existingUser.email === signupDto.email) {
        this.logger.error(`User with provided email and phone number already exist: ${JSON.stringify(existingUser)}`);
        throw new ConflictException('User with provided email already exists');

      } else {
        this.logger.error(`User with provided phone number already exists: ${JSON.stringify(existingUser)}`);
        throw new ConflictException('User with provided phone number already exists');
      }
    }
    try {
      const authenticationDetails = new AuthenticationDetails({
        Username: signupDto.firstName + signupDto.lastName,
        Password: signupDto.password,
      });
      const userData = {
        Username: signupDto.firstName + signupDto.lastName,
        Pool: this.userPool,
      };

      const newUser = new CognitoUser(userData);

      newUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          return result;
        },
        onFailure: (err) => {
          throw new BadRequestException(err);
        },
      });
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Post('signup')
  @ApiResponse({ status: 201, description: 'Successful Registration' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async signup(@Body() signupDto: SignupDto): Promise<any> {
    const existingUser = await this.userService.getByEmailOrPhone(signupDto.email, signupDto.phone);
    if (existingUser) {
      if (existingUser.email === signupDto.email && existingUser.phone === signupDto.phone) {
        this.logger.error(`User with provided email and phone number already exist: ${JSON.stringify(existingUser)}`);
        throw new ConflictException('User with provided email and phone number already exist');

      } else if (existingUser.email === signupDto.email) {
        this.logger.error(`User with provided email and phone number already exist: ${JSON.stringify(existingUser)}`);
        throw new ConflictException('User with provided email already exists');

      } else {
        this.logger.error(`User with provided phone number already exists: ${JSON.stringify(existingUser)}`);
        throw new ConflictException('User with provided phone number already exists');
      }
    }
    try {
      const lambdaPayload = {
        queryStringParameters: {}
      };

      if (signupDto.email) {
        lambdaPayload.queryStringParameters['email'] = signupDto.email;
      } else if (signupDto.phone) {
        lambdaPayload.queryStringParameters['phone'] = signupDto.phone;
      };
      const invokeCommand = {
        FunctionName: this.configService.get('COGNITO_USER_MGMT_LAMBDA'),
        Payload: JSON.stringify(lambdaPayload),
      };
      this.logger.info(`lambda function invoke command: ${JSON.stringify(invokeCommand)}`);

      const lambdaResponse = await this.lambdaClient.send(new InvokeCommand(invokeCommand));

      this.logger.info(`lambda response payload: ${JSON.stringify(lambdaResponse)}`);

      const parsedPayload = JSON.parse(new TextDecoder().decode(lambdaResponse.Payload));

      this.logger.info(`parsed payload: ${JSON.stringify(parsedPayload)}`);

      if (parsedPayload.statusCode === 400
        && parsedPayload.body.includes(
          'User with email already exists')) {
        throw new ConflictException('User with provided email already exists in Cognito');
      } else if (parsedPayload.statusCode === 400
        && parsedPayload.body.includes(
          'User with phone number already exists')) {
        throw new ConflictException('User with provided phone number already exists in Cognito');
      }
      // Handle any errors from the lambda function
      if (lambdaResponse.FunctionError) {
        this.logger.error(`Error creating cognito: ${parsedPayload}`)
        throw new BadRequestException(parsedPayload || 'Error creating user in cognito');
      }
      const user = await this.userService.create(signupDto);
      return await this.authService.createToken(user);
    } catch (error) {
      this.logger.error(`Error invoking CreateUserLambda: ${error.message}`);
      throw new ConflictException(`Failed to invoke CreateUserLambda: ${error.message}`);
    }
  }

  // create a post handler of registerUser
  @Post('register')

  @ApiBearerAuth()
  @UseGuards(AuthGuard())
  @Get('me')
  @ApiResponse({ status: 200, description: 'Successful Response' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getLoggedInUser(@Request() request: IRequest): Promise<any> {
    return request.user;
  }
}