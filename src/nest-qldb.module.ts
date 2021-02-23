import { DynamicModule, FactoryProvider, Module, Type } from '@nestjs/common';
import { QldbDriver } from 'amazon-qldb-driver-nodejs';
import { TableRegistrations } from './decorators';
import { QldbQueryServiceFactoryService } from './qldb-query-service-factory.service';
import { QldbQueryService } from './query.service';
import { Repository } from './repository';
import { createQldbRepositoryToken, QLDB_DRIVER_TOKEN } from './tokens';
import { AsyncProvider, ImportableFactoryProvider } from './types';

@Module({})
export class NestQldbModule {
  static forRoot(moduleOptions: {
    qldbDriver?: QldbDriver;
    createTablesAndIndexes?: boolean;
    tables?: Type<any>[];
  }): DynamicModule {
    return this.forRootAsync({
      qldbDriver: {
        useValue: moduleOptions.qldbDriver,
      },
      createTablesAndIndexes: !!moduleOptions.createTablesAndIndexes,
      tables: moduleOptions.tables,
    });
  }

  static forRootAsync(moduleOptions: {
    qldbDriver?: AsyncProvider<QldbDriver | Promise<QldbDriver>>;
    createTablesAndIndexes: boolean;
    tables?: Type<any>[];
  }): DynamicModule {
    const module: DynamicModule = {
      global: true,
      module: NestQldbModule,
      imports: [],
      providers: [QldbQueryService, QldbQueryServiceFactoryService],
      exports: [QldbQueryService, QldbQueryServiceFactoryService],
    };

    this.addAsyncProvider(
      module,
      QLDB_DRIVER_TOKEN,
      moduleOptions.qldbDriver,
      true,
    );

    this.createRepositoryProviders(
      moduleOptions.createTablesAndIndexes,
    ).forEach(cp => {
      module.providers.push(cp);
      module.exports.push(cp.provide);
    });

    return module;
  }

  private static addAsyncProvider<T>(
    module: DynamicModule,
    provide: string,
    asyncProvider: AsyncProvider<T>,
    exportable: boolean,
  ) {
    const imports = (asyncProvider as ImportableFactoryProvider<T>).imports;
    if (imports?.length) {
      imports.forEach(i => module.imports.push(i));
    }
    delete (asyncProvider as ImportableFactoryProvider<T>).imports;

    module.providers.push({
      ...asyncProvider,
      provide,
    });

    if (exportable) {
      module.exports.push(provide);
    }
  }

  private static createRepositoryProviders = (
    createTablesAndIndexes: boolean,
  ): FactoryProvider<Promise<Repository<any>>>[] => {
    return TableRegistrations.keys().map(key => {
      const registration = TableRegistrations.get(key);
      const tableName = registration?.tableName?.length
        ? registration.tableName
        : `${key.name.toLowerCase()}s`;

      const indexes = registration?.tableIndexes as string[];

      return {
        provide: createQldbRepositoryToken(key),
        useFactory: async (queryService: QldbQueryService) => {
          const repository = new Repository(queryService, {
            useMetadataKey: true,
            keyField: 'id',
            ...registration,
            tableName,
          });

          if (createTablesAndIndexes) {
            await repository.createTableAndIndexes(indexes);
          }

          return repository;
        },
        inject: [QldbQueryService],
      };
    });
  };
}
