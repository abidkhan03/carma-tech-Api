import {
  Controller,
  Body,
  Post,
  UseGuards,
  Get,
  Request,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '@modules/auth/auth.service';
import { SigninDto } from '@modules/auth/dto/signin.dto';
import { SignupDto } from '@modules/auth/dto/signup.dto';
import { UsersService } from '@modules/user/user.service';
import { IRequest } from '@modules/user/user.interface';
import { Lambda } from 'aws-sdk';
import { Logger } from '@aws-lambda-powertools/logger';

@Controller('api/auth')
@ApiTags('authentication')
export class AuthController {
  private lambda: Lambda;
  private readonly logger = new Logger();
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UsersService,
  ) {
    this.lambda = new Lambda({
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

  @Post('signup')
  @ApiResponse({ status: 201, description: 'Successful Registration' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async signup(@Body() signupDto: SignupDto): Promise<any> {
    const existingUser = await this.userService.getByEmailOrPhone(signupDto.email, signupDto.phone);
    if (existingUser) {
      if (existingUser.email === signupDto.email && existingUser.phone === signupDto.phone) {
        this.logger.error(`User with provided email and phone number already exists: ${JSON.stringify(existingUser)}`);
        throw new ConflictException('User with provided email and phone number already exist');
      } else if (existingUser.email === signupDto.email) {
        this.logger.error(`User with provided email and phone number already exist: ${JSON.stringify(existingUser)}`);
        throw new ConflictException('User with provided email already exist');
      } else {
        this.logger.error(`User with provided phone number already exist: ${JSON.stringify(existingUser)}`);
        throw new ConflictException('User with provided phone number already exist');
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
      const lambdaParams = {
        FunctionName: 'UserManagementStack-CreateUserLambda0154A2EB-5ufMqT4E5ntw',
        Payload: JSON.stringify(lambdaPayload),
      };
      this.logger.info(`lambda function params: ${JSON.stringify(lambdaParams)}`)

      const lambdaResponse = await this.lambda.invoke(lambdaParams).promise();
      this.logger.info(`lambda response payload: ${JSON.stringify(lambdaResponse)}`);
      this.logger.info(`lambda logs result: ${lambdaResponse.LogResult}`);
      const parsedPayload = JSON.parse(lambdaResponse.Payload as string);
      this.logger.info(`parsed payload: ${JSON.stringify(parsedPayload)}`);
      const cognitoUser = parsedPayload.body;
      this.logger.info(`cognito user: ${JSON.stringify(cognitoUser)}`);

      if (parsedPayload.statusCode === 400
        && parsedPayload.body.includes(
          'User with email already exists')) {
        throw new ConflictException('User with provided email already exists in Cognito.');
      } else if (parsedPayload.statusCode === 400
        && parsedPayload.body.includes(
          'User with phone number already exists')) {
        throw new ConflictException('User with provided phone number already exists in Cognito.');
      }
      // Handle any errors from the lambda function
      if (lambdaResponse.FunctionError) {
        this.logger.error(`Error creating cognito: ${lambdaResponse.Payload as string}`)
        throw new BadRequestException(lambdaResponse.Payload as string || 'Error creating user in cognito');
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