import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SharedIniFileCredentials } from 'aws-sdk';
import {
  NestQldbModule,
  QldbDriver,
  QldbQueryServiceFactoryService,
} from '../src';

/* USERS */
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
/* END USERS */

// Setup Module
const driver = new QldbDriver('test-ledger', {
  region: 'us-east-1',
  credentials: new SharedIniFileCredentials({
    profile: 'test-profile',
  }),
});
@Module({
  imports: [NestQldbModule.forRoot({})],
})
class TestRootModule {}

@Module({
  imports: [NestQldbModule.forRootAsync({})],
})
class TestRootAsyncModule {}

describe('NestQldbModule.forRoot()', () => {
  it('should work', async () => {
    jest.setTimeout(30000);

    const module = await NestFactory.createApplicationContext(TestRootModule);
    const factoryService = module.get(QldbQueryServiceFactoryService);
    const queryService = factoryService.create(driver);

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
    try {
      await queryService.execute('CREATE TABLE app_users');
    } catch {
      // table already exists, throw away this error
    }
    await queryService.execute('INSERT INTO app_users ?', user);

    // custom query
    const result = await queryService.query<User>(
      `
      SELECT a.*
      FROM app_users AS a,
          a.groups AS m
      WHERE m.name = ?
    `,
      'best_golfers_ever',
    );
    expect(result.find((r) => r.name === 'Billy Madison')).toBeDefined();

    await queryService.execute('DROP TABLE app_users');
  });
});

describe('NestQldbModule.forRootAsync()', () => {
  it('should work', async () => {
    jest.setTimeout(30000);

    const module = await NestFactory.createApplicationContext(
      TestRootAsyncModule,
    );
    const factoryService = module.get(QldbQueryServiceFactoryService);
    const queryService = factoryService.create(driver);

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
    try {
      await queryService.execute('CREATE TABLE app_users');
    } catch {
      // table already exists, throw away this error
    }
    await queryService.execute('INSERT INTO app_users ?', user);

    // custom query
    const result = await queryService.query<User>(
      `
      SELECT a.*
      FROM app_users AS a,
          a.groups AS m
      WHERE m.name = ?
    `,
      'best_golfers_ever',
    );
    expect(result.find((r) => r.name === 'Billy Madison')).toBeDefined();

    await queryService.execute('DROP TABLE app_users');
  });
});
