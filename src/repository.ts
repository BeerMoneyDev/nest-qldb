import { QldbDriver, Result } from 'amazon-qldb-driver-nodejs';
import { QldbQuery, getQueryFilter } from './query';
import { Logger } from '@nestjs/common';

export class Repository<T> {
  private readonly logger: Logger;
  constructor(private readonly driver: QldbDriver, readonly tableName: string) {
    this.logger = new Logger(`Repository_${tableName}`);
  }

  /**
   * Queries for records
   * @param query A QlDB Query. Note that if your filter is a string, you're responsible for prefixing fields with 'tbl.'
   *
   */

  async query(query: QldbQuery<T>): Promise<Array<T & { id: string }>> {
    const fields = !!query.fields
      ? query.fields.map(x => `tbl.${x}`).join(', ')
      : 'tbl.*';
    const filter = !!query.filter ? getQueryFilter<T>(query.filter) : '1 = 1';
    const formattedQuery = `SELECT id, ${fields} FROM ${this.tableName} as tbl by id WHERE ${filter}`;
    this.logger.log(`Running query: ${formattedQuery}`);
    const result = await this.execute(formattedQuery);
    return this.mapResultsToObjects<T & { id: string }>(result);
  }

  /**
   * Writes a record into the table.
   * @param data The object to be created. Will return the object and the id created by QLDB.
   */

  async create(data: T): Promise<T & { id: string }> {
    const result = await this.execute(`INSERT INTO ${this.tableName} ?`, [
      data,
    ]);

    const createResult = this.mapResultsToObjects<{ documentId: string }>(
      result,
    )?.[0];

    return {
      ...data,
      id: createResult.documentId,
    };
  }

  /**
   * Retrieves a record based on the QLDB id.
   * @param id The QLDB ID of the object.
   */

  async retrieve(id: string): Promise<T & { id: string }> {
    const result = await this.execute(
      [
        `SELECT id, t.*`,
        `FROM ${this.tableName} AS t`,
        `BY id WHERE id = ?`,
      ].join(' '),
      id,
    );

    return this.mapResultsToObjects<T & { id: string }>(result)?.[0];
  }

  /**
   * Replaces a record based on qldb id.
   * @param id The QLDB Id of the object to be modified
   * @param data The data to replace the corresponding id with. This is full replacement.
   */

  async replace(id: string, data: T): Promise<void> {
    await this.execute(
      [
        `UPDATE ${this.tableName} AS tblrow BY id`,
        `SET tblrow = ?`,
        `WHERE id = '${id}'`,
      ].join(' '),
      data,
    );
  }

  /**
   * Destroys a record from the table view. Note: no data is ever permanantly deleted from the underlying ledger.
   * @param id THe QLDB id you want to delete from the table.
   */

  async destroy(id: string): Promise<void> {
    await this.execute(`DELETE FROM ${this.tableName} BY id WHERE id = ?`, id);
  }

  async history(id: string): Promise<T[]> {
    const result = await this.execute(
      [
        `SELECT *`,
        `FROM history(${this.tableName}) AS h`,
        `WHERE h.metadata.id = ?`,
      ].join(' '),
      id,
    );

    return this.mapResultsToObjects<T>(result, 'data');
  }

  /**
   * Creates a table. Hidden from interface.
   */

  private async createTable(): Promise<number> {
    const result = await this.execute(`CREATE TABLE ${this.tableName}`);

    return result.getResultList().length;
  }

  /**
   * Creates the index fields. Hidden from interface.
   * @param indexFields The index fields to create.
   */

  private async createIndexes(indexFields: string[]) {
    const results: Result[] = [];
    for (const field of indexFields) {
      try {
        const result = await this.execute(
          `CREATE INDEX ON ${this.tableName} (${field})`,
        );
        results.push(result);
      } catch (err) {
        this.logger.warn(err);
      }
    }
    return results.length;
  }

  /**
   * This method is used in instantiation of the repository, if createTablesAndIndexes is true. Not intended to be called inside of framework.
   * @param indexFields The fields to be indexed on.
   */

  async createTableAndIndexes(indexFields: string[]) {
    this.logger.log(
      `Setting up table ${
        this.tableName
      } with field indexes ${indexFields?.join(', ')}`,
    );
    try {
      await this.createTable();
    } catch (err) {
      this.logger.warn(err);
    }

    if (indexFields && indexFields.length) {
      try {
        await this.createIndexes(indexFields);
      } catch (err) {
        this.logger.warn(err);
      }
    }
  }

  private async execute(statement: string, ...parameters: any[]) {
    const result: Result = await this.driver.executeLambda(
      async txn => await txn.execute(statement, ...parameters),
    );

    return result;
  }

  private mapResultsToObjects<T>(result: Result, subproperty?: string): T[] {
    const resultList = result.getResultList();

    return resultList.map(value => {
      const parsedJson = JSON.parse(JSON.stringify(value));

      return subproperty ? parsedJson[subproperty] : parsedJson;
    });
  }
}
