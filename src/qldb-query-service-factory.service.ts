import { Injectable } from '@nestjs/common';
import { QldbDriver } from 'amazon-qldb-driver-nodejs';
import { QldbQueryService } from './query.service';

@Injectable()
export class QldbQueryServiceFactoryService {
  create(driver: QldbDriver) {
    return new QldbQueryService(driver);
  }
}
