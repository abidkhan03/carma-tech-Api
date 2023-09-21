import { Module } from '@nestjs/common';
import { SnsController } from './sns/sns.controller';

@Module({
  controllers: [SnsController],
})
export class AwsModule {}
