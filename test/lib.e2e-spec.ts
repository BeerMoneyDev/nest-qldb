import { Module, Injectable } from '@nestjs/common';
import {
  NestQldbModule,
  QldbTable,
  Repository,
  InjectRepository,
  QldbDriver,
  QldbQueryService,
} from '../src';
import { NestFactory } from '@nestjs/core';
import { SharedIniFileCredentials } from 'aws-sdk';

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
    expect(created.name).toStrictEqual(name);

    // custom query
    const queryService = module.get(QldbQueryService);
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

    // retrieve
    const get = await userService.usersRepository.retrieve(created.id);
    expect(get.name).toStrictEqual(name);
    expect(get.id).toStrictEqual(created.id);
    const queryResult = await userService.usersRepository.query({
      fields: ['luckyNumber'],
      filter: { name: { operator: '=', value: name } },
    });
    expect(queryResult.some(x => x.luckyNumber === luckyNumber)).toBeTruthy();

    // updates
    user.luckyNumber = 68;
    await userService.usersRepository.replace(created.id, user);
    const updated = await userService.usersRepository.retrieve(created.id);
    expect(updated.luckyNumber).toEqual(68);

    // deletes
    await userService.usersRepository.destroy(created.id);

    // history
    const history = await userService.usersRepository.history(created.id);
    expect(history.length).toBe(3);
    expect(history[0].luckyNumber).toEqual(69);
    expect(history[1].luckyNumber).toEqual(68);
    expect(history[2]).toBe(undefined);

    // createMany
    const users: User[] = [
      {
        dob: new Date('1920-02-01'),
        name: 'John Doe',
        gender: 'male',
        sex: 'M',
        luckyNumber: 4,
        groups: null,
      },
      {
        dob: new Date('1924-02-01'),
        name: 'Jane Doe',
        gender: 'female',
        sex: 'F',
        luckyNumber: 54,
        groups: [],
      },
    ];
    await userService.usersRepository.createMany(users);
  });
});
