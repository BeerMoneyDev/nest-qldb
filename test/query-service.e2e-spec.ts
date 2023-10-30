import { fromIni } from '@aws-sdk/credential-providers';
import { Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  NestQldbModule,
  QldbDriver,
  QldbQueryService,
  QldbTable,
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
   * Retrieves a record based on the QLDB id.
   * @param id The QLDB ID of the object.
   */

  async retrieve(id: string): Promise<User & { id: string }> {
    return await this.queryService.querySingle<User & { id: string }>(
      [`SELECT id, u.*`, `FROM app_users AS u`, `BY id WHERE id = ?`].join(' '),
      id,
    );
  }
}
/* END USERS */

// Setup Module

@Module({
  imports: [
    NestQldbModule.forRoot({
      qldbDriver: new QldbDriver('test-ledger', {
        region: 'us-east-1',
        credentials: fromIni({
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
    const created = await userService.create(user);
    expect(created.name).toStrictEqual(name);

    // retrieve
    const retrieved = await userService.retrieve(created.id);
    expect(retrieved.name).toStrictEqual(name);
  });
});
