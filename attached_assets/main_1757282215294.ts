import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as passport from 'passport';
import { DatabaseExceptionFilter } from './config/filters';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(passport.initialize());

  app.enableCors({
    allowedHeaders: '*',
    origin: '*',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  // app.useGlobalFilters(new DatabaseExceptionFilter());
  await app.listen(process.env.PORT || 3000, () => console.log('Listening on port: ' + process.env.PORT));
}
bootstrap();
