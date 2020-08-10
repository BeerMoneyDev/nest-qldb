import { TableType } from './types';

export function createQldbRepositoryToken(type: TableType<any>) {
  return `REPOSITORY_${type.name}`.toLocaleUpperCase();
}
export const QLDB_DRIVER_TOKEN = 'QLDB_DRIVER';
