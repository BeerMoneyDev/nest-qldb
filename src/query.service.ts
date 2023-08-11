import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  QldbDriver,
  Result,
  TransactionExecutor,
} from 'amazon-qldb-driver-nodejs';
import { QLDB_DRIVER_TOKEN } from './tokens';

@Injectable()
export class QldbQueryService {
  constructor(
    @Inject(QLDB_DRIVER_TOKEN)
    @Optional()
    private readonly driver: QldbDriver,
  ) {}

  async query<T>(statement: string, ...parameters: any[]): Promise<T[]> {
    const result = await this.execute(statement, ...parameters);

    return this.mapResultsToObjects<T>(result);
  }

  async queryTransactionally<T>(
    callback: (txn: TransactionExecutor) => Promise<Result>,
  ): Promise<T[]> {
    const result = await this.executeLambda(callback);

    return this.mapResultsToObjects<T>(result);
  }

  async querySingle<T>(statement: string, ...parameters: any[]): Promise<T> {
    const result = await this.execute(statement, ...parameters);

    return this.mapResultsToObjects<T>(result)?.[0];
  }

  async queryForSubdocument<T>(
    statement: string,
    subproperty: string,
    ...parameters: any[]
  ): Promise<T[]> {
    const result = await this.execute(statement, ...parameters);

    return this.mapResultsToObjects<T>(result, subproperty);
  }

  async querySingleForSubdocument<T>(
    statement: string,
    subproperty: string,
    ...parameters: any[]
  ): Promise<T> {
    const result = await this.execute(statement, ...parameters);

    return this.mapResultsToObjects<T>(result, subproperty)?.[0];
  }

  async execute(statement: string, ...parameters: any[]): Promise<Result> {
    return await this.driver.executeLambda(
      async (txn) => await txn.execute(statement, ...parameters),
    );
  }

  // A wrapper function called executeLambda where we take in the callback
  // and pass it to the driver's executeLambda function.
  async executeLambda(
    callback: (txn: TransactionExecutor) => Promise<Result>,
  ): Promise<Result> {
    return await this.driver.executeLambda(callback);
  }

  private mapResultsToObjects<T>(result: Result, subproperty?: string): T[] {
    if (!result) {
      return null;
    }

    const resultList = result.getResultList();

    if (!resultList?.length) {
      return null;
    }

    return resultList.map((value) => {
      const parsedJson = JSON.parse(JSON.stringify(value));

      return subproperty ? parsedJson[subproperty] : parsedJson;
    });
  }
}
