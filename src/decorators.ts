import { Inject } from '@nestjs/common';
import { createQldbRepositoryToken } from './tokens';
import { TableType, TableOptions } from './types';

export class TableRegistrations {
  static readonly map = new Map<TableType<any>, TableOptions<any>>();

  static add<T>(type: TableType<T>, options?: TableOptions<T>) {
    return TableRegistrations.map.set(type, options);
  }

  static get<T>(type: TableType<T>) {
    return TableRegistrations.map.get(type);
  }

  static keys() {
    return Array.from(TableRegistrations.map.keys());
  }
}

export function InjectRepository<T>(type: TableType<T>) {
  return Inject(createQldbRepositoryToken(type));
}

export function QldbTable<T>(options?: TableOptions<T>) {
  return function (target: TableType<T>) {
    TableRegistrations.add(target, options);
  };
}
