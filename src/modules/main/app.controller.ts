import { Get, Controller, HttpStatus, Res, Render } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from '@modules/main/app.service';
import { Response } from 'express';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { CloudFormation } from 'aws-sdk';

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
  @Get('eng-chinese-translator')
  @Render('translator')
  async serveTranslatorUI() {
    const cloudFormation = new CloudFormation();
    const stackName = 'LambdaTranslatorChatGPTStack'; 

    // Fetch all exports
    const { Exports } = await cloudFormation.listExports().promise();

    const translatorLambdaName = Exports?.find(e => e.Name === 'TranslatorLambdaName')?.Value;
    const translatorIdentityPoolId = Exports?.find(e => e.Name === 'TranslatorIdentityPoolId')?.Value;

    return {
      translatorLambdaName,
      translatorIdentityPoolId,
    // const ssm = new SSM({ region: 'ap-south-1' });

    // const translatorLambdaName = await ssm.getParameter({ Name: '/config/translatorLambdaName' }).promise();
    // const translatorIdentityPoolId = await ssm.getParameter({ Name: '/config/translatorIdentityPoolId' }).promise();
    // return {
    //   translatorLambdaName: translatorLambdaName.Parameter?.Value,
    //   translatorIdentityPoolId: translatorIdentityPoolId.Parameter?.Value,
    };
  }


  // @Get('app-config')
  // getAppConfig() {
  //   return {
  //     identityPoolId: this.configService.get('IDENTITY_POOL_ID'),
  //     lambdaFunctionName: this.configService.get('LAMBDA_FUNCTION_NAME')
  //   }
  // }

}