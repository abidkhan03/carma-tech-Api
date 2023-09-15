import { Get, Controller, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from '@modules/main/app.service';
import { Response } from 'express';
import { join } from 'path';

@Controller()
@ApiTags('healthcheck')
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  root() {
    return HttpStatus.OK;
  }

  @Get('ddb_testing')
  ddb_test() {
    this.appService.ddb_test();
    return HttpStatus.OK;
  }

  @Get('eng-chinese-translator')
  serveTranslatorUI(@Res() res: Response) {
    res.sendFile(join(process.cwd(), 'public/index.html'));
  }


  // @Get('eng-chinese-translator')
  // serveTranslatorUI(@Res() res: Response) {
  //   res.render('index');
  // }

}
