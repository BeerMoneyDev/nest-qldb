import { Module, Injectable } from '@nestjs/common';
import {
  NestQldbModule,
  QldbTable,
  Repository,
  InjectRepository,
  QldbDriver,
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
      createTablesAndIndexes: false,
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
    const user: User = {
      dob: new Date('1980/07/19'),
      name,
      gender: 'man',
      sex: 'M',
      luckyNumber,
    };
    const created = await userService.usersRepository.create(user);
    expect(created.name).toStrictEqual(name);

    const get = await userService.usersRepository.retrieve(created.id);
    expect(get.name).toStrictEqual(name);
    expect(get.id).toStrictEqual(created.id);
    const queryResult = await userService.usersRepository.query({
      fields: ['luckyNumber'],
      filter: { name: { operator: '=', value: name } },
    });
    expect(queryResult.some(x => x.luckyNumber === luckyNumber)).toBeTruthy();
    user.luckyNumber = 68;
    await userService.usersRepository.replace(created.id, user);
    const updated = await userService.usersRepository.retrieve(created.id);
    expect(updated.luckyNumber).toEqual(68);

    await userService.usersRepository.destroy(created.id);

    const history = await userService.usersRepository.history(created.id);
    expect(history.length).toBe(3);
    expect(history[0].luckyNumber).toEqual(69);
    expect(history[1].luckyNumber).toEqual(68);
    expect(history[2]).toBe(undefined);
  });
});
