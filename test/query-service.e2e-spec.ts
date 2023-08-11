import { Module, Injectable } from '@nestjs/common';
import {
  NestQldbModule,
  QldbTable,
  QldbDriver,
  QldbQueryService,
} from '../src';
import { NestFactory } from '@nestjs/core';
import { SharedIniFileCredentials } from 'aws-sdk';
import { TransactionExecutor } from "amazon-qldb-driver-nodejs";

/* USERS */
@QldbTable({
  tableName: 'app_users',
  tableIndexes: ['dob', 'sex', 'luckyNumber'],
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
  constructor(private readonly queryService: QldbQueryService) {}

  async create(data: User): Promise<User & { id: string }> {
    const result = await this.queryService.querySingle<{ documentId: string }>(
      `INSERT INTO app_users ?`,
      [data],
    );

    return {
      ...data,
      id: result?.documentId,
    };
  }

  /**
   * Creates a record using the luckyNumber as unique index.
   * https://docs.aws.amazon.com/qldb/latest/developerguide/driver-cookbook-nodejs.html#cookbook-nodejs.crud.uniqueness-constraints
   * @param data The data to be inserted.
   */
  async createUniqueLuckyNumber(data: User): Promise<User & { id: string }> {
    const callback = async (txn: TransactionExecutor) => {
      // Check if the luckyNumber already exists.
      const results = (
        await txn.execute(
          `SELECT id FROM app_users AS u WHERE u.luckyNumber = ?`,
          data.luckyNumber,
        )
      ).getResultList();

      if (results.length != 0)
        throw new Error(`The luckyNumber ${data.luckyNumber} already exists.`);

      return await txn.execute(`INSERT INTO app_users ?`, [data]);
    };
    const result = (
      await this.queryService.queryTransactionally<{ documentId: string }>(
        callback,
      )
    )[0];

    return {
      ...data,
      id: result?.documentId,
    };
  }

  /**
   * Retrieves a record based on the QLDB id.
   * @param id The QLDB ID of the object.
   */

  async retrieve(id: string): Promise<User & { id: string }> {
    return await this.queryService.querySingle<User & { id: string }>(
      [`SELECT id, u.*`, `FROM app_users AS u`, `BY id WHERE id = ?`].join(' '),
      id,
    );
  }

  /*
   * Retrieves a record using them queryTransactionally method.
   * @param id The QLDB ID of the object.
   */

  async retrieveTransactionally(id: string): Promise<User & { id: string }> {
    const callback = async (txn: TransactionExecutor) => {
      return await txn.execute(
        [`SELECT id, u.*`, `FROM app_users AS u`, `BY id WHERE id = ?`].join(
          ' ',
        ),
        id,
      );
    };
    return (
      await this.queryService.queryTransactionally<User & { id: string }>(
        callback,
      )
    )[0];
  }
}
/* END USERS */

// Setup Module

@Module({
  imports: [
    NestQldbModule.forRoot({
      qldbDriver: new QldbDriver('test-ledger', {
        region: 'us-east-1',
        credentials: new SharedIniFileCredentials({
          profile: 'test-profile',
        }),
      }),
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
    const luckyNumber = 25;
    const user = new User({
      dob: new Date('1980/07/19'),
      name,
      gender: 'man',
      sex: 'M',
      luckyNumber,
      groups: [{ name: 'best_golfers_ever' }],
    });

    // create
    const created = await userService.create(user);
    expect(created.name).toStrictEqual(name);

    // retrieve
    const retrieved = await userService.retrieve(created.id);
    expect(retrieved.name).toStrictEqual(name);
  });

  it('should work with queryTransactionally', async () => {
    jest.setTimeout(30000);

    const module = await NestFactory.createApplicationContext(TestRootModule);

    const userService = module.get(UserService);
    const name = 'Billy Madison';
    // Create a random number, so the test can be run multiple times.
    const luckyNumber = Math.floor(Math.random() * 1000000);
    const user = new User({
      dob: new Date('1989/11/25'),
      name,
      gender: 'man',
      sex: 'M',
      luckyNumber,
      groups: [{ name: 'best_golfers_ever' }],
    });

    // create unique
    const created = await userService.createUniqueLuckyNumber(user);
    expect(created.name).toStrictEqual(name);
    expect(created.luckyNumber).toStrictEqual(luckyNumber);
    expect(created.id).toBeDefined();

    // Trying to create a second user with the same luckyNumber should fail.
    await expect(userService.createUniqueLuckyNumber(user)).rejects.toThrow(
      `The luckyNumber ${luckyNumber} already exists.`,
    );

    // retrieve transactionally
    const retrieved = await userService.retrieveTransactionally(created.id);
    expect(retrieved.name).toStrictEqual(name);
    expect(retrieved.luckyNumber).toStrictEqual(luckyNumber);
  });
});
