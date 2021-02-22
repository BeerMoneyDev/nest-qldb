import { Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SharedIniFileCredentials } from 'aws-sdk';
import {
  InjectRepository,
  NestQldbModule,
  QldbDriver,
  QldbQueryServiceFactoryService,
  QldbTable,
  Repository,
} from '../src';

/* USERS */
@QldbTable({
  tableName: 'app_users',
  tableIndexes: ['dob', 'sex'],
})
class User {
  dob: Date;
  name: string;
  gender: string;
  sex: 'M' | 'F';
  luckyNumber: number;
  groups: { name: string }[] = [];

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}

@Injectable()
class UserService {
  constructor(
    @InjectRepository(User) readonly usersRepository: Repository<User>,
  ) {}
}
/* END USERS */

// Setup Module
const driver = new QldbDriver('test-ledger', {
  region: 'us-east-1',
  credentials: new SharedIniFileCredentials({
    profile: 'test-profile',
  }),
});
@Module({
  imports: [
    NestQldbModule.forRoot({
      qldbDriver: driver,
      createTablesAndIndexes: true,
      tables: [User],
    }),
  ],
  providers: [UserService],
  exports: [UserService],
})
class TestRootModule {}

describe('NestQldbModule.forRoot()', () => {
  it('should work', async () => {
    jest.setTimeout(30000);

    const module = await NestFactory.createApplicationContext(TestRootModule);

    const userService = module.get(UserService);
    const name = 'Billy Madison';
    const luckyNumber = 69;
    const user = new User({
      dob: new Date('1980/07/19'),
      name,
      gender: 'man',
      sex: 'M',
      luckyNumber,
      groups: [{ name: 'best_golfers_ever' }],
    });

    // create
    const created = await userService.usersRepository.create(user);

    // custom query
    const factoryService = module.get(QldbQueryServiceFactoryService);
    const queryService = factoryService.create(driver);
    const result = await queryService.query<User>(
      `
      SELECT a.*
      FROM app_users AS a,
          a.groups AS m
      WHERE m.name = ?
    `,
      'best_golfers_ever',
    );
    expect(result.find(r => r.name === 'Billy Madison')).toBeDefined();
  });
});
