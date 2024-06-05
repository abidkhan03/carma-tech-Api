import { Get, Controller, HttpStatus, Res, Render, Post, Body, HttpException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from '@modules/main/app.service';
import { Response } from 'express';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Controller()
@ApiTags('healthcheck')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) { }

  @Get()
  root() {
    return HttpStatus.OK;
  }

  @Get('ddb_testing')
  ddb_test() {
    this.appService.ddb_test();
    return HttpStatus.OK;
  }

  @Get('config')
  @Render('config') // this is the config.ejs template. Omit .ejs when rendering
  getConfig() {
    return {
      jwt_expiration_time: this.configService.get<string>('JWT_EXPIRATION_TIME'),
      cognito_user_mgmt_lambda: this.configService.get<string>('COGNITO_USER_MGMT_LAMBDA'),
      user_pool_id: this.configService.get<string>('USER_POOL_ID'),
      cognito_user_client_id: this.configService.get<string>('COGNITO_USER_CLIENT_ID'),
      translator_lambda_name: this.configService.get<string>('TRANSLATOR_LAMBDA_NAME'),
      identity_pool_id: this.configService.get<string>('IDENTITY_POOL_ID'),
      sns_topic_name: this.configService.get<string>('SNS_TOPIC_NAME'),
      sns_topic_arn: this.configService.get<string>('SNS_TOPIC_ARN'),
      region: this.configService.get<string>('REGION'),
      school_api: this.configService.get<string>('DAILY_SCHOOL_FOOD_API_URL'),
    };
  }

  @Get('eng-chinese-translator')
  @Render('translator')  // renders the translator.ejs file
  getTranslator() {
    return {
      lambdaFunctionName: this.configService.get<string>('TRANSLATOR_LAMBDA_NAME'),
      identityPoolId: this.configService.get<string>('IDENTITY_POOL_ID'),
      region: this.configService.get<string>('REGION'),
    };
  }

  // @Get('ssm-parameters')
  // @Render('ssm-parameters') // renders the ssm-parameters.ejs file
  // createOrUpdateParams() {
  //   return {
  //     school_api: this.configService.get<string>('DAILY_SCHOOL_FOOD_API_URL'),
  //     region: this.configService.get<string>('REGION'),
  //   }
  // }

  @Post('ssm-params')
  async createOrUpdateParams(@Body() params: Record<string, any>) {
    const apiUrl = this.configService.get<string>('DAILY_SCHOOL_FOOD_API_URL');
    console.log('api url: ', apiUrl);
    try {
      // Use lastValueFrom to convert the Observable to a Promise
      const response = await lastValueFrom(this.httpService.post(apiUrl, params));
      console.log('response data: ',response.data)
      return response.data;
    } catch (error) {
      throw new HttpException('Failed to update parameters: ' + error.response?.data || error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}
