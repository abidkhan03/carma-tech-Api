import {
  Controller,
  Body,
  Post,
  UseGuards,
  Get,
  Request,
  BadRequestException,
  NotAcceptableException,
  BadGatewayException,
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
import { TextEncoder, TextDecoder } from 'util';
import * as AWS from 'aws-sdk';
import axios from 'axios';

@Controller('api/auth')
@ApiTags('authentication')
export class AuthController {
  private readonly lambdaClient: LambdaClient;
  private readonly logger = new Logger();
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UsersService,

  ) {
    this.lambdaClient = new LambdaClient({
      region: 'us-east-2',
    });
  }
  
  private async invokeLambda(lambdaFunctionName: string, data: any): Promise<any> {
    this.logger.info(`Invoking lambda: ${lambdaFunctionName}`);
    this.logger.info(`Payload to Lambda email: ${JSON.stringify(data.email)}`);
    this.logger.info(`Buffer payload lambda email: ${Buffer.from(JSON.stringify(data.email), 'utf8')}`);

    const payload = new TextEncoder().encode(JSON.stringify(data.email));
    const command = new InvokeCommand({
      FunctionName: lambdaFunctionName,
      Payload: payload,
      
    });


    const response = await this.lambdaClient.send(command);

    if (!response.Payload) {
      throw new Error(`Lambda ${lambdaFunctionName} did not return a valid response.`);
    }

    const lambdaResponseString = new TextDecoder().decode(response.Payload as Uint8Array);
    this.logger.info(`Lambda response string before calling: ${JSON.stringify(lambdaResponseString)}`);
    const lambdaResponse = JSON.parse(lambdaResponseString);

    this.logger.info(`Received response from lambda ${lambdaFunctionName}: ${JSON.stringify(lambdaResponse)}`);
    return lambdaResponse;
  }
  
  // private async invokeCreateUserLambda(data: SignupDto): Promise<any> {

  //   if (!data.email) {
  //     this.logger.error("Email is not provided or is null");
  //     throw new Error('Email is required');
  //   }

  //   const payload = new TextEncoder().encode(JSON.stringify(data));
  //   const command = new InvokeCommand({
  //     FunctionName: 'UserManagementStack-CreateUserLambda0154A2EB-5ufMqT4E5ntw',
  //     Payload: payload,
  //   });
  //   this.logger.info(`command for lambda client: ${JSON.stringify(command)}`);
  //   try {
  //     const response = await this.lambdaClient.send(command);
  //     this.logger.info(`response for lambda client: ${JSON.stringify(response)}`);
  //     this.logger.info(`Raw Lambda response payload: ${response.Payload}`);

  //     const lambdaResponseString = new TextDecoder().decode(response.Payload as Uint8Array);
  //     const lambdaResponse = JSON.parse(lambdaResponseString);
  //     this.logger.info(`Lambda response: ${JSON.stringify(lambdaResponse)}`);
  //     if (!lambdaResponse.user) {
  //       throw new BadRequestException('User email not returned from Lambda or is undefined.');
  //     }
  //     if (lambdaResponse.error) {
  //       throw new ConflictException(lambdaResponse.errorMessage || 'Error creating user in Cognito.');
  //     }
  //     return lambdaResponse;
  //   } catch (error) {
  //     this.logger.error(`Error invoking CreateUserLambda via lambdaClient: ${error.message}`);
  //     throw new BadGatewayException('Failed to invoke CreateUserLambda');
  //   }
  // }

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
    const user = await this.userService.getByEmail(signupDto.email);
    if (user) {
      throw new ConflictException(
        'User with provided email already exists.',
      );
    }
    const lambdaFunctionName = 'UserManagementStack-CreateUserLambda0154A2EB-5ufMqT4E5ntw';
    try {
      const lambdaResponse = await this.invokeLambda(lambdaFunctionName, signupDto);
      // decode the response
      this.logger.info(`Raw Lambda response payload: ${lambdaResponse.Payload}`);
      const lambdaResponseString = new TextDecoder().decode(lambdaResponse.Payload as Uint8Array);
      this.logger.info(`Lambda response string: ${JSON.stringify(lambdaResponseString)}`);
      this.logger.info(`Lambda response signup: ${JSON.stringify(lambdaResponse)}`);
      const lambdaResponseBody = JSON.parse(lambdaResponse.body);
      this.logger.info(`Lambda response body: ${JSON.stringify(lambdaResponseBody)}`);
      const emailToCheck = lambdaResponse.email;
      this.logger.info(`Email to check: ${JSON.stringify(emailToCheck)}`);
      if (!emailToCheck) {
        this.logger.error(`Email is not provided or is null: ${JSON.stringify(emailToCheck)}`);
        throw new Error(`Email not returned from Lambda or is undefined: ${JSON.stringify(emailToCheck)}`);
      }
      if (lambdaResponse.statusCode === 400 && lambdaResponseBody.error) {
        throw new ConflictException(lambdaResponse.errorMessage || 'Error creating user in Cognito.');
      }
      
      const newUser = await this.userService.create({
        ...signupDto,
        email: emailToCheck // Override with the email received from Lambda, if necessary
      });
      this.logger.info(`New user created: ${JSON.stringify(newUser)}`);
      return await this.authService.createToken(newUser);
    } catch (error) {
      this.logger.error(`Error invoking CreateUserLambda: ${error.message}`);
      // if (error instanceof BadRequestException) {
      //   throw new BadRequestException(error.message);
      // }
      // if (error instanceof ConflictException) {
      //   throw error;
      // }
      throw new BadGatewayException('Failed to invoke CreateUserLambda');
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
