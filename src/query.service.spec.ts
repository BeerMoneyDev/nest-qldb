import { Test, TestingModule } from '@nestjs/testing';
import { QldbQueryService } from './query.service';
import { QldbDriver } from 'amazon-qldb-driver-nodejs';
import { QLDB_DRIVER_TOKEN } from './tokens';

describe('QldbQueryService', () => {
  let service: QldbQueryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QldbQueryService,
        {
          provide: QLDB_DRIVER_TOKEN,
          useValue: ({
            executeLambda: () => null,
          } as any) as QldbDriver,
        },
      ],
    }).compile();

    service = module.get<QldbQueryService>(QldbQueryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // the repository.spec.ts file covers all the code.
});
