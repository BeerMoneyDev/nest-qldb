import { Test, TestingModule } from '@nestjs/testing';
import { QldbDriver } from 'amazon-qldb-driver-nodejs';
import { QldbQueryServiceFactoryService } from './qldb-query-service-factory.service';
import { QldbQueryService } from './query.service';

describe('QldbQueryServiceFactoryService', () => {
  let service: QldbQueryServiceFactoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QldbQueryServiceFactoryService],
    }).compile();

    service = module.get<QldbQueryServiceFactoryService>(
      QldbQueryServiceFactoryService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should createNew', () => {
    // arrange
    const driver = new QldbDriver('something');

    // act
    const result = service.create(driver);

    // assert
    expect(result).toBeInstanceOf(QldbQueryService);
  });
});
