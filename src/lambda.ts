import { configure as serverlessExpress } from '@vendia/serverless-express';
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { Callback, Context, Handler } from 'aws-lambda';
import { useContainer } from 'class-validator';
import { ReplaySubject, firstValueFrom } from 'rxjs';
import { TrimStringsPipe } from '@app/modules/common/transformer/trim-strings.pipe';
import { setupSwagger } from '@app/swagger';
import { AppModule } from '@app/modules/main/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';


//Declare a ReplaySubject to store the serverlessExpress instance.
const serverSubject = new ReplaySubject<Handler>()
const lambdaUrlPattern = /^https:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com(\/prod|\/staging|\/dev)?\/?$/;

function isAllowedOrigin(origin: string): boolean {
  return lambdaUrlPattern.test(origin);
}

async function bootstrap(): Promise<Handler> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  setupSwagger(app);
  app.enableCors({
    origin: (origin, callback) => {
      console.log(`Checking CORS for origin: ${origin}`);
      if (isAllowedOrigin(origin)) {
        console.log('Allowed CORS for:', origin);
        callback(null, true);
      } else {
        console.log('Blocked CORS for:', origin);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type, Accept",
    preflightContinue: false,
    optionsSuccessStatus: 204 // Some legacy browsers (IE11, various SmartTVs) choke on 204
  });

  app.use((req: any, res: any, next: any) => {
    res.header('access-control-allow-origin', '*');
    next();
  })
  app.useGlobalPipes(
    new TrimStringsPipe(),
    new ValidationPipe({ whitelist: true }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  // Set view engine
  app.setViewEngine('ejs');
  app.setBaseViewsDir(join(__dirname, '..', 'views'));

  await app.init();
  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

//Do not wait for lambdaHandler to be called before bootstraping Nest.
//Pass the result of bootstrap() into the ReplaySubject
bootstrap().then(server => serverSubject.next(server))


export const handler: Handler = async (event: any, context: Context, callback: Callback) => {
  //Convert the ReplaySubject to a Promise.
  //Wait for bootstrap to finish, then start handling requests.
  const server = await firstValueFrom(serverSubject)
  return server(event, context, callback);
};

