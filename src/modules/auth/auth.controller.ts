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
import { RegisterRequestDto } from '@modules/auth/dto/register.dto';
import { SnsService } from '@modules/aws/sns/sns.service';

@Controller('api/auth')
@ApiTags('authentication')
export class AuthController {
  private lambdaClient: LambdaClient;
  private readonly userPool: CognitoUserPool;
  private readonly provideClient: CognitoIdentityProviderClient;
  private readonly logger = new Logger();
  private snsNotification: SnsService;
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UsersService,
    private readonly configService: ConfigService
  ) {

    this.lambdaClient = new LambdaClient({
      region: 'us-east-2',
    });

    this.userPool = new CognitoUserPool({
      UserPoolId: this.configService.get('USER_POOL_ID') || 'us-east-2_0Pitx53J7',
      ClientId: this.configService.get('COGNITO_USER_CLIENT_ID') || '5l1nf7orlu8lai7dpu83rs9551',
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
  async register(@Body() registerRequest: RegisterRequestDto): Promise<any> {
    return await this.authService.registerUser(registerRequest);
  }

  @Post('confirmSignup')
  @ApiResponse({ status: 201, description: 'Successful Registration' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async confirm(@Body('username') username: string, @Body('confirmCode') confirmCode: string): Promise<any> {
    try {
      return await this.authService.confirmSignUp(username, confirmCode);
    } catch (e) {
      throw new BadRequestException(e.message);
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
        try {
          this.logger.error("Error sending test SNS message: User with provided email and phone number already exist");
          await this.snsNotification.sendSnsNotification("Test message to verify SNS functionality");
        } catch (error) {
          this.logger.error("Error sending test SNS message:", error);
        }
        this.logger.error(`User with provided email and phone number already exist: ${JSON.stringify(existingUser)}`);
        throw new ConflictException('User with provided email and phone number already exist');

      } else if (existingUser.email === signupDto.email) {
        try {
          this.logger.info("Error Sending SNS Message: User with provided email already exists");
          await this.snsNotification.sendSnsNotification("Test message to verify SNS functionality");
        } catch (error) {
          this.logger.error("Error sending test SNS message:", error);
        }

        this.logger.error(`User with provided email already exists: ${JSON.stringify(existingUser)}`);
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

  @ApiBearerAuth()
  @UseGuards(AuthGuard())
  @Get('me')
  @ApiResponse({ status: 200, description: 'Successful Response' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getLoggedInUser(@Request() request: IRequest): Promise<any> {
    return request.user;
  }
}
