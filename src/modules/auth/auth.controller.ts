import {
  Controller,
  Body,
  Post,
  UseGuards,
  Get,
  Request,
  BadRequestException,
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

  private async invokeCreateUserLambda(data: SignupDto): Promise<any> {
    const url = `https://0ycdi3goi5.execute-api.us-east-2.amazonaws.com/prod/createUser?email=${data.email}`;
    this.logger.info(`Constructed url: ${url}`);
    // try {
    const urlResponse = await axios.get(url);
    this.logger.info(`urlResponse: ${JSON.stringify(urlResponse)}`);
    this.logger.info(`urlResponse.data: ${JSON.stringify(urlResponse.data)}`);
    this.logger.info(`urlResponse.data.email: ${JSON.stringify(urlResponse.data.email)}`);
    const responseLambda = urlResponse.data;
    responseLambda.email = urlResponse.data.email;
    this.logger.info(`responseLambda API: ${JSON.stringify(responseLambda)}`);
    return responseLambda;
    // return responseLambda;
    // } catch (error) {
    //   this.logger.error(`Error invoking CreateUserLambda via API Gateway: ${error.message}`);
    //   if (error.response) {
    //     this.logger.error(`Error details: ${JSON.stringify(error.response.data)}`);
    //   }
    //   throw new Error('Failed to invoke CreateUserLambda');
    // }

    const payload = new TextEncoder().encode(JSON.stringify(data));
    const command = new InvokeCommand({
      FunctionName: 'UserManagementStack-CreateUserLambda0154A2EB-5ufMqT4E5ntw',
      Payload: payload,
    });
    const response = await this.lambdaClient.send(command);
    console.log('response', response);
    this.logger.info(`response for lambda client: ${JSON.stringify(response)}`);
    this.logger.info(`Raw Lambda response payload: ${response.Payload}`);
    // Decode the Uint8Array payload response from Lambda back to string
    const lambdaResponseString = new TextDecoder().decode(response.Payload as Uint8Array);
    this.logger.info(`Lambda response string: ${lambdaResponseString}`);
    const lambdaResponse = JSON.parse(lambdaResponseString);
    lambdaResponse.email = urlResponse.data.email;
    this.logger.info(`Lambda response: ${JSON.stringify(lambdaResponse)}`);
    return lambdaResponse;
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
    const user = await this.userService.getByEmail(signupDto.email);
    this.logger.info(`User email: ${JSON.stringify(user)}`);
    if (user) {
      throw new BadRequestException('User already exists');
    }
    const lambdaResponse = await this.invokeCreateUserLambda(signupDto);
    const parsedBody = typeof lambdaResponse.body === 'string' ? JSON.parse(lambdaResponse.body) : lambdaResponse.body;
    this.logger.info(`Parsed body: ${JSON.stringify(parsedBody)}`);
    const emailToCheck = parsedBody.email;

    // const emailToCheck = lambdaResponse.email;
    if (!emailToCheck) {
      throw new Error('Email not returned from Lambda or is undefined.');
    }
    this.logger.info(`Email to check: ${emailToCheck}`);

    console.log('lambdaResponse', lambdaResponse);
    this.logger.info(`Lambda response: ${JSON.stringify(lambdaResponse)}`);
    if (lambdaResponse.error) {
      throw new Error(lambdaResponse.errorMessage || 'Error creating user in Cognito.');
    }
    const existingUser = await this.userService.findByEmail(emailToCheck);
    this.logger.info(`Existing user: ${JSON.stringify(existingUser)}`);
    if (existingUser) {
      throw new Error(`${lambdaResponse.email} Email already exists in the system.`);
    } else {
      const newUser = await this.userService.create({
        ...signupDto,
        email: lambdaResponse.email
      });
      this.logger.info(`New user created: ${JSON.stringify(newUser)}`);
      return await this.authService.createToken(newUser);
    }

    // const existingUser = await this.userService.getByEmail(signupDto.email);
    // // If user's email exists in the database, throw an error
    // if (existingUser) {
    //   throw new Error(`${signupDto.email} Email already exists in the system.`);
    // }
    // // If the email does not exist, proceed with invoking the Lambda function
    // // Assuming lambdaResponse.email holds the newly created email from Cognito.
    // const lambdaResponse = await this.invokeCreateUserLambda(signupDto);
    // console.log('lambdaResponse', lambdaResponse);
    // this.logger.info(`Lambda response: ${JSON.stringify(lambdaResponse)}`);
    // if (lambdaResponse.error) {
    //   throw new Error(lambdaResponse.errorMessage || 'Error creating user in Cognito.');
    // }
    // // Now, save this new user data in your own database
    // const newUser = await this.userService.create({
    //   ...signupDto,
    //   email: lambdaResponse.email // Override with the email received from Lambda, if necessary
    // });
    // this.logger.info(`New user created: ${JSON.stringify(newUser)}`);
    // return await this.authService.createToken(newUser);
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



// import {
//   Controller,
//   Body,
//   Post,
//   UseGuards,
//   Get,
//   Request,
// } from '@nestjs/common';
// import { ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
// import { AuthGuard } from '@nestjs/passport';
// import { AuthService } from '@modules/auth/auth.service';
// import { SigninDto } from '@modules/auth/dto/signin.dto';
// import { SignupDto } from '@modules/auth/dto/signup.dto';
// import { UsersService } from '@modules/user/user.service';
// import { IRequest } from '@modules/user/user.interface';

// @Controller('api/auth')
// @ApiTags('authentication')
// export class AuthController {
//   constructor(
//     private readonly authService: AuthService,
//     private readonly userService: UsersService,
//   ) {}

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
//     const user = await this.userService.create(signupDto);
//     return await this.authService.createToken(user);
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