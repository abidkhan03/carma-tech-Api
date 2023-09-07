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
    // const url = `https://0ycdi3goi5.execute-api.us-east-2.amazonaws.com/prod/createUser?email=${data.email}`;
    const url = `https://0ycdi3goi5.execute-api.us-east-2.amazonaws.com/prod/createUser?email=${encodeURIComponent(data.email)}`;;
    this.logger.info(`Invoking URL: ${url}`);

    if (!data.email) {
      this.logger.error("Email is not provided or is null");
      throw new Error('Email is required');
    }
    try {

      // Send the email as part of the body in a POST request
      const urlResponse = await axios.post(url, {
        email: data.email
      },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        });

      const responseLambda = urlResponse.data;
      responseLambda.email = urlResponse.data.email;
      this.logger.info(`responseLambda API: ${JSON.stringify(responseLambda)}`);
      this.logger.info(`responseLambda.email API: ${JSON.stringify(responseLambda.user)}`);

      return responseLambda;
    } catch (error) {
      this.logger.error(`Error invoking CreateUserLambda via API Gateway: ${error.message}`);
      // this.logger.error(`Error details: ${JSON.stringify(error.response.data)}`);
      if (error.response) {
        this.logger.error(`Error details: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error('Failed to invoke CreateUserLambda');
    }

    // const payload = new TextEncoder().encode(JSON.stringify(data));
    // const command = new InvokeCommand({
    //   FunctionName: 'UserManagementStack-CreateUserLambda0154A2EB-5ufMqT4E5ntw',
    //   Payload: payload,
    // });
    // const response = await this.lambdaClient.send(command);
    // console.log('response', response);
    // this.logger.info(`response for lambda client: ${JSON.stringify(response)}`);
    // this.logger.info(`Raw Lambda response payload: ${response.Payload}`);
    // // Decode the Uint8Array payload response from Lambda back to string
    // const lambdaResponseString = new TextDecoder().decode(response.Payload as Uint8Array);
    // this.logger.info(`Lambda response string: ${lambdaResponseString}`);
    // const lambdaResponse = JSON.parse(lambdaResponseString);
    // // lambdaResponse.email = urlResponse.data.email;
    // this.logger.info(`Lambda response: ${JSON.stringify(lambdaResponse)}`);
    // return lambdaResponse;
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
    if (user) {
      throw new Error('User already exists');
    }
    try {
      const lambdaResponse = await this.invokeCreateUserLambda(signupDto);
      this.logger.info(`Lambda response: ${JSON.stringify(lambdaResponse)}`);
      const emailToCheck = lambdaResponse.user;
      if (!emailToCheck) {
        this.logger.error(`Email is not provided or is null: ${JSON.stringify(emailToCheck)}`);
        throw new Error(`Email not returned from Lambda or is undefined: ${JSON.stringify(emailToCheck)}`);
      }
      if (lambdaResponse.error) {
        throw new Error(lambdaResponse.errorMessage || 'Error creating user in Cognito.');
      }
      const user = await this.userService.getByEmail(emailToCheck);
      // Now, save this new user data in your own database
      const newUser = await this.userService.create({
        ...signupDto,
        email: emailToCheck // Override with the email received from Lambda, if necessary
      });
      this.logger.info(`New user created: ${JSON.stringify(newUser)}`);
      return await this.authService.createToken(newUser);
    } catch (error) {
      this.logger.error(`Error invoking CreateUserLambda: ${error.message}`);
      throw new Error('Failed to invoke CreateUserLambda');
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