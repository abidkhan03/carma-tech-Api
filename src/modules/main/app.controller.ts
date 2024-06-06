import { Get, Controller, HttpStatus, Res, Render, Post, Body, HttpException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from '@modules/main/app.service';
import { Response } from 'express';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { SSMClient, PutParameterCommand, ParameterType } from "@aws-sdk/client-ssm";

@Controller()
@ApiTags('healthcheck')
export class AppController {
  private ssmClient: SSMClient;
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {
    this.ssmClient = new SSMClient({ region: this.configService.get<string>('REGION') });
  }

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
    try {
      if (Object.keys(params).length === 0) {
        throw new HttpException(
          'No parameters provided. Please enter at least one parameter name and value.',
          HttpStatus.BAD_REQUEST
        );
      }
      // Iterate over the object keys and values to create/update parameters
      const results = [];
      for (const [key, value] of Object.entries(params)) {
        if (!key.trim() || !value.trim()) {
          throw new HttpException(
            'Both name and value are required for each parameter. Please enter both.',
            HttpStatus.BAD_REQUEST
          );
        }
        const input = {
          Name: key,
          Value: value,
          Type: 'String' as ParameterType,
          Overwrite: true,
        };
        const command = new PutParameterCommand(input);
        const response = await this.ssmClient.send(command);
        console.log('Updated Parameter:', response);
        results.push({ key, response });
      }
      return {
        message: 'Parameters created or updated successfully',
        details: results
      };
    } catch (error) {
      throw new HttpException(
        'Failed to create or update SSM parameters: ' +
        error.message, HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

