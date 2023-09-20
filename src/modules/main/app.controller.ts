import { Get, Controller, HttpStatus, Res, Render } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from '@modules/main/app.service';
import { Response } from 'express';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

@Controller()
@ApiTags('healthcheck')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService
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

  // @Get('eng-chinese-translator')
  // serveTranslatorUI(@Res() res: Response) {
  //   res.sendFile(join(process.cwd(), 'public/index.html'));
  // }

  @Get('config')
  @Render('config') // this is the config.ejs template. Omit .ejs when rendering
  getConfig() {
    return { 
      jwt_expiration_time: this.configService.get('JWT_EXPIRATION_TIME'),
      cognito_user_mgmt_lambda: this.configService.get('COGNITO_USER_MGMT_LAMBDA'), 
    };
  }

  @Get('eng-chinese-translator')
  @Render('translator')  // renders the translator.ejs file
  getTranslator() {
    return {
      lambdaFunctionName: this.configService.get('TRANSLATOR_LAMBDA_NAME'),
      identityPoolId: this.configService.get('IDENTITY_POOL_ID')
    };
  }

  @Get('app-config')
  getAppConfig() {
    return {
      identityPoolId: this.configService.get('TRANSLATOR_LAMBDA_NAME'),
      lambdaFunctionName: this.configService.get('IDENTITY_POOL_ID')
    }
  }

}
