import 'source-map-support/register';
import 'reflect-metadata';

if (!process.env.IS_TS_NODE) {
  require('module-alias/register');
}

import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { useContainer } from 'class-validator';

import { AppModule } from '@app/modules/main/app.module';
import { setupSwagger } from '@app/swagger';
import { TrimStringsPipe } from '@app/modules/common/transformer/trim-strings.pipe';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

declare const module: any;

const APP_PORT = 3000;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // app.useStaticAssets(join(__dirname, '..', 'public'));
  app.useStaticAssets(join(__dirname, '..', 'english-chinese-translator'), {
    prefix: '/eng-chinese-translator/', // This ensures it's only available at this specific route
  });
  // app.setViewEngine('html');
  setupSwagger(app);
  app.enableCors();
  app.useGlobalPipes(
    new TrimStringsPipe(),
    new ValidationPipe({ whitelist: true }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  await app.listen(APP_PORT);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}

bootstrap();
