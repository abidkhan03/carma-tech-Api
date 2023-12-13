import { Test, TestingModule } from '@nestjs/testing';
import { ServicesCostController } from './services-cost.controller';

describe('ServicesCostController', () => {
  let controller: ServicesCostController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesCostController],
    }).compile();

    controller = module.get<ServicesCostController>(ServicesCostController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
