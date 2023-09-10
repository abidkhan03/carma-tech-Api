// import {
//   Controller,
//   Body,
//   Post,
//   UseGuards,
//   Get,
//   Request,
//   BadRequestException,
//   NotAcceptableException,
//   BadGatewayException,
//   ConflictException,
// } from '@nestjs/common';
// import { ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
// import { AuthGuard } from '@nestjs/passport';
// import { AuthService } from '@modules/auth/auth.service';
// import { SigninDto } from '@modules/auth/dto/signin.dto';
// import { SignupDto } from '@modules/auth/dto/signup.dto';
// import { UsersService } from '@modules/user/user.service';
// import { IRequest } from '@modules/user/user.interface';
// import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
// import { Logger } from '@aws-lambda-powertools/logger';
// import { TextEncoder, TextDecoder } from 'util';
// import * as AWS from 'aws-sdk';
// import axios from 'axios';
// import { error } from 'console';

// @Controller('api/auth')
// @ApiTags('authentication')
// export class AuthController {
//   private readonly lambdaClient: LambdaClient;
//   private readonly logger = new Logger();
//   constructor(
//     private readonly authService: AuthService,
//     private readonly userService: UsersService,

//   ) {
//     this.lambdaClient = new LambdaClient({
//       region: 'us-east-2',
//     });
//   }

//   private async invokeLambda(lambdaFunctionName: string, data: any): Promise<any> {
//     // this.logger.info(`Invoking lambda: ${lambdaFunctionName}`);
//     this.logger.info(`Payload to Lambda email: ${JSON.stringify(data.email)}`);
//     // this.logger.info(`Buffer payload lambda email: ${Buffer.from(JSON.stringify(data.email), 'utf8')}`);

//     const payloadData = {
//       queryStringParameters: {
//         email: data.email
//       }
//     };
//     try {
//       const payload = new TextEncoder().encode(JSON.stringify(payloadData));
//       const command = new InvokeCommand({
//         FunctionName: lambdaFunctionName,
//         InvocationType: 'RequestResponse' || 'Event' || 'DryRun',
//         LogType: 'Tail',
//         Payload: payload,

//       });

//       this.logger.info("Invoke command values: " + JSON.stringify(command.input.Payload ? command.input.Payload.toString() : 'undefined'));

//       const { Payload, LogResult } = await this.lambdaClient.send(command);
//       this.logger.info(`Raw Payload from lambda: ${Payload ? Payload.toString() : "Payload is empty or undefined"}`);

//       // const responseBody = JSON.parse(Payload.toString());
//       // const logResult = Buffer.from(LogResult, "base64").toString();
//       // this.logger.info(`Response body: ${JSON.stringify(responseBody)}`);
//       // this.logger.info(`Log result: ${JSON.stringify(logResult)}`);
//       // return responseBody;

//       const result = Buffer.from(Payload).toString();
//       const logResult = Buffer.from(LogResult, "base64").toString();
//       // const result = Payload;
//       if (!result) {
//         throw new Error("No payload received from lambda");
//       }

//       this.logger.info(`buffer lambda command: ${JSON.stringify(result)}`);
//       this.logger.info(`buffer lambda log result: ${JSON.stringify(logResult)}`);
//       const response = JSON.parse(result);
//       this.logger.info(`Response from lambda in invoke: ${JSON.stringify(response)}`);
//       if (!response || !response.Payload) {
//         this.logger.error(`Invalid response format received from Lambda: ${JSON.stringify(response)}`);
//         throw new Error("Invalid response format received from Lambda");
//       }this.logger.info(`Payload from lambda: ${JSON.stringify(Payload)}`);


//       const lambdaResponseString = new TextDecoder().decode(response.Payload as Uint8Array);
//       this.logger.info(`Lambda response string before calling: ${JSON.stringify(lambdaResponseString)}`);
//       const lambdaResponse = JSON.parse(lambdaResponseString);

//       this.logger.info(`Received response from lambda ${lambdaFunctionName}: ${JSON.stringify(lambdaResponse)}`);
//       return lambdaResponse;
//     } catch (error) {
//       this.logger.error(`Error invoking CreateUserLambda directly: ${error.message}`);
//       throw new BadGatewayException('Failed to directly invoke CreateUserLambda');
//     }
//   }

//   @Post('signin')
//   @ApiResponse({ status: 201, description: 'Successful Login' })
//   @ApiResponse({ status: 400, description: 'Bad Request' })
//   @ApiResponse({ status: 401, description: 'Unauthorized' })
//   async signin(@Body() signinDto: SigninDto): Promise<any> {
//     const user = await this.authService.validateUser(signinDto);
//     return await this.authService.createToken(user);
//   }

//   @Post('signup')
//   @ApiResponse({ status: 201, description: 'Successful Registration' })
//   @ApiResponse({ status: 400, description: 'Bad Request' })
//   @ApiResponse({ status: 401, description: 'Unauthorized' })
//   async signup(@Body() signupDto: SignupDto): Promise<any> {
//     if (!signupDto.email) {
//       throw new BadRequestException('Email is required');
//     }
//     const user = await this.userService.getByEmail(signupDto.email);
//     if (user) {
//       throw new ConflictException(
//         'User with provided email already exists.',
//       );
//     }
//     const lambdaFunctionName = 'UserManagementStack-CreateUserLambda0154A2EB-5ufMqT4E5ntw';
//     try {
//       const lambdaResponse = await this.invokeLambda(lambdaFunctionName, signupDto);
//       const parsedBody = JSON.parse(lambdaResponse.body);

//       // If necessary, parse the internal payload (only if it's a stringified JSON)
//       const responseBody = typeof parsedBody === 'string' ? JSON.parse(parsedBody) : parsedBody;

//       this.logger.info(`Response body: ${JSON.stringify(responseBody)}`);
//       if (responseBody.error) {
//         this.logger.error(`Error invoking CreateUserLambda response body: ${responseBody.error}`);
//         throw new BadRequestException(`Error invoking CreateUserLambda response body: ${responseBody.error}`);
//       }
//       // decode the response
//       // this.logger.info(`Raw Lambda response payload: ${lambdaResponse.Payload.toString()}`);
//       this.logger.info(`Lambda response signup: ${JSON.stringify(lambdaResponse)}`);
//       const emailToCheck = responseBody.user;
//       this.logger.info(`test test test ${JSON.stringify(lambdaResponse.email)}`)
//       this.logger.info(`Email to check: ${JSON.stringify(emailToCheck)}`);
//       if (!emailToCheck) {
//         this.logger.error(`Email is not provided or is null: ${JSON.stringify(emailToCheck)}`);
//         throw new Error(`Email not returned from Lambda or is undefined: ${JSON.stringify(emailToCheck)}`);
//       }

//       const newUser = await this.userService.create({
//         ...signupDto,
//         // email: emailToCheck // Override with the email received from Lambda, if necessary
//       });

//       this.logger.info(`New user created: ${JSON.stringify(newUser)}`);
//       return await this.authService.createToken(newUser);
//     } catch (error) {
//       this.logger.error(`Error invoking CreateUserLambda: ${error.message}`);
//       if (error instanceof BadRequestException) {
//         throw new BadRequestException(error.message);
//       }
//       if (error instanceof ConflictException) {
//         throw error;
//       }
//       throw new BadGatewayException('Failed to invoke CreateUserLambda');
//     }
//   }

//   @ApiBearerAuth()
//   @UseGuards(AuthGuard())
//   @Get('me')
//   @ApiResponse({ status: 200, description: 'Successful Response' })
//   @ApiResponse({ status: 401, description: 'Unauthorized' })
//   async getLoggedInUser(@Request() request: IRequest): Promise<any> {
//     return request.user;
//   }
// }

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
import { sign } from 'crypto';

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
    const existingUser = await this.userService.getByEmail(signupDto.email);
    if (existingUser) {
      this.logger.error(`User with provided email already exists: ${JSON.stringify(existingUser)}`);
      throw new ConflictException('User with provided email or phone number already exist');
    }
    try {

      const lambdaPayload = {
        queryStringParameters: {
          email: signupDto.email,
        }
      };

      // if (signupDto.email) {
      //   lambdaPayload.queryStringParameters['email'] = signupDto.email;
      // } else if (signupDto.phone) {
      //   lambdaPayload.queryStringParameters['phone'] = signupDto.phone;
      // };
      const lambdaParams = {
        FunctionName: 'CarmaTechAPIStack-CarmaTechInfraLambda9B8388EE-qMN8BBLzslEm',
        Payload: JSON.stringify(lambdaPayload),
      };
      this.logger.info(`lambda function params: ${JSON.stringify(lambdaParams)}`)

      const lambdaResponse = await this.lambda.invoke(lambdaParams).promise();
      this.logger.info(`lambda response payload: ${JSON.stringify(lambdaResponse)}`);
      this.logger.info(`lambda logs result: ${lambdaResponse.LogResult}`);
      const parsedPayload = JSON.parse(lambdaResponse.Payload as string);
      this.logger.info(`parsed payload: ${JSON.stringify(parsedPayload)}`);

      if (parsedPayload.statusCode === 400 && parsedPayload.body.includes('User with email or phone number already exists')) {
        throw new ConflictException('User with provided email or phone number already exists in Cognito.');
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