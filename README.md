<h1 align="center">nest-qldb</h1>
<div align="center">
  <img src="https://miro.medium.com/max/5392/1*OvyWCTfnELrR3amCINM7SQ.png" width="320" alt="QLDB Logo" />
  <img src="https://nestjs.com/img/logo_text.svg" width="320" alt="Nest Logo" />
</div>
<br />
<div align="center">
  <strong>A <a href="https://github.com/nestjs">NestJS</a> module wrapping Amazon's Quantum Ledger Databse in a repository pattern with clean dependency injection.</strong>
</div>

# Features
* Extends the `amazon-qldb-driver-nodejs` work to add ODM functionality for QLDB common in NestJS.
* A simple dependency injection model with `NestQldbModule.forRoot()`, `NestQldbModule.forRootAsync()`.
* Simple auto-generated CRUD repositories for models, injectable by `@InjectRepository(model)`.

# How To Use

## Install

```bash
npm install --save nest-qldb
```

## Importing

### NestQldbModule.forRoot()

`NestQldbModule.forRoot()` is the simplest way to import the QLDB module and autowire `@QldbTable` decorators. We re-export the `QldbDriver` from `amazon-qldb-driver-nodejs`.<br/>
<strong>Note</strong>: It is necessary that the ledger be created before application initialization. 

```ts
import { NestQldbModule, QldbDriver } from 'nest-qldb';

// app.module.ts
@Module({
  imports: [
    NestQldbModule.forRoot({
      qldbDriver: new QldbDriver('fake-ledger')
      createTablesAndIndexes: true,
    }),
  ],
})
class AppRootModule {}
```

#### driver

`qldbDriver` is the driver to manage connections to Amazon's Quantum Ledger Database.

### NestQldbModule.forRootAsync()

`NestQldbModule.forRootAsync()` allows for a `FactoryProvider` or `ValueProvider` dependency declaration to import our module. Note that `ExistingProvider` and `ClassProvider` are not yet supported.

```ts
import { NestQldbModule, QldbDriver } from 'nest-qldb';
import { ConfigModule, ConfigService } from '@nestjs/config';

// app.module.ts
@Module({
  imports: [
    NestQldbModule.forRootAsync({
      qldbDriver: {
        useFactory: async (configService: ConfigService) => {
          return new QldbDriver(
            configService.qldbLedgerName, 
            { credentials: new SharedIniFileCredentials({ profile: config.qldbProfileName})},
          );
        },
        inject: [ConfigService],
      },
      createTablesAndIndexes: true,
    }),
    ConfigModule.forRoot(),
  ],
})
class AppRootModule {}
```

## Registering Models Binds them to QLDB tables

### Models

Model classes are the shape of the data in your QLDB tables. The `@QldbTable()` decorator is used to register your model as a table in Quantum Ledger Database. </br>
You can also define the tableName and indexes associated with that model. <strong>NOTE</strong>: You can only create index when tables are empty so in the module config.
There is config on the module to perform this action at startup createTablesAndIndexes, it gracefully handles tables/indexes already created, however, it'll cost you a few seconds on a cold start so
it is advised to turn it off in a production serverless scenario.

#### With decorator
```ts
import { QldbTable } from 'nest-qldb'
// user.model.ts

@QldbTable({
  tableName: 'users',
  tableIndexes: ['name', 'phoneNumber'],
})
class User {
  name: string;
  dateOfBirth: Date;
  email: string;
  phoneNumber: string;
}
```

##### tableName

This is the name of the collection stored in QLDB.

##### tableIndexes

These indexes will be created upon table creation. You cannot create indexes after records are inserted, so be aware.



## Repository injection

Repositories can be injected using the `@InjectRepository()` decorator. The repositories are created by `nest-qldb` and are a simple CRUD interface handy for quickly creating REST controllers.

* `query(query QldbQuery)` - Performs Partiql query against table.
* `create(data: T)` - Adds an object to the QLDB table
* `retrieve(id: string)` - Fetches a single document by it's QLDB assigned id.
* `replace(id: string, data: T)` - Replaces an entire document based on the id. 
* `destroy(id: string)` - Deletes an object from the table but not its change history from the ledger.
* `history(id: string)` - Fetches all versions of a document across history

```ts
@Controller()
class UserController {
  constructor(
    @InjectRepository(User) readonly usersRepository: Repository<User>,
  ) {}

  @Get(':id')
  async getById(id: string) {
    return await this.usersRepository.retrieve(id);
  }
}
```

# Stay In Touch

* Author - [Benjamin Main](https://twitter.com/Ben05920582) and BeerMoneyDev

## License

nest-qldb is MIT licensed.