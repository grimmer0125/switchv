console.log('server main');
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// import { PrismaService } from './services/prisma/prisma.service';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  console.log('server bootstrap1');

  const app = await NestFactory.create(AppModule);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  app.enableCors();
  await app.listen(55688);
  console.log('server bootstrap2');
}
bootstrap();
