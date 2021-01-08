import { DynamicModule, ValueProvider, FactoryProvider } from '@nestjs/common';

export type RepositoryOptions = {
  tableName: string;
  keyField: string;
  useMetadataKey: boolean;
};

export interface TableOptions<T> extends Partial<RepositoryOptions> {
  tableIndexes?: Array<keyof T>;
}

export interface TableType<T> extends Function, TableOptions<T> {
  new (...args: any[]): T;
}

export interface ImportableFactoryProvider<T>
  extends Omit<FactoryProvider<T>, 'provide'>,
    Pick<DynamicModule, 'imports'> {}

export type AsyncProvider<T> =
  | ImportableFactoryProvider<T>
  | Omit<ValueProvider<T>, 'provide'>;
