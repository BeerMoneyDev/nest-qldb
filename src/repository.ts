import { Logger } from '@nestjs/common';
import { Result } from 'amazon-qldb-driver-nodejs';
import * as chunk from 'lodash.chunk';
import { getQueryFilter, QldbQuery } from './query';
import { QldbQueryService } from './query.service';
import { RepositoryOptions } from './types';

export class Repository<T> {
  private readonly logger: Logger;

  constructor(
    private readonly queryService: QldbQueryService,
    private readonly config: RepositoryOptions,
  ) {
    this.logger = new Logger(
      `Repository_${config.tableName}`.toLocaleUpperCase(),
    );
  }

  /**
   * Queries for records
   * @param query A QlDB Query. Note that if your filter is a string, you're responsible for prefixing fields with 'tbl.'
   *
   */
  async query(query: QldbQuery<T>): Promise<Array<T & { id: string }>> {
    const fields = !!query.fields
      ? query.fields
          .map((x) => {
            return `tbl.${String(x)}`;
          })
          .join(', ')
      : 'tbl.*';

    const filter = !!query.filter ? getQueryFilter<T>(query.filter) : '1 = 1';

    const formattedQuery = `SELECT ${this.config.keyField}, ${fields} FROM ${
      this.config.tableName
    } as tbl ${
      this.config.useMetadataKey ? 'BY ' + this.config.keyField : ''
    } WHERE ${filter}`;

    this.logger.log(`Running query: ${formattedQuery}`);

    return await this.queryService.query<T & { id: string }>(formattedQuery);
  }

  /**
   * Writes a record into the table.
   * @param data The object to be created. Will return the object and the id created by QLDB.
   */

  async create(data: T): Promise<T & { id: string }> {
    if (this.config.useMetadataKey) {
      delete data[this.config.keyField];
    }
    const result = await this.queryService.querySingle<{ documentId: string }>(
      `INSERT INTO ${this.config.tableName} ?`,
      [data],
    );

    return {
      ...data,
      id: this.config.useMetadataKey
        ? result?.documentId
        : data[this.config.keyField],
    };
  }

  async createMany(records: T[]): Promise<(T & { id: string })[]> {
    const updatedRecords = records.map((record) => {
      if (this.config.useMetadataKey) {
        delete record['id'];
      }
      return { ...record };
    });
    // 40 Documents is currently the most that can be modified in a single transaction
    const chunks = chunk(updatedRecords, 40);
    const finalResults: (T & { id: string })[] = [];
    for (const aChunk of chunks) {
      const count = aChunk.length;
      const repeated = ' ?,'.repeat(count).slice(0, -1);
      const results = await this.queryService.query<{ documentId: string }>(
        `INSERT INTO ${this.config.tableName} << ${repeated} >>`,
        ...aChunk,
      );
      finalResults.push(
        ...aChunk.map((x, i) => ({ ...x, id: results[i].documentId })),
      );
    }
    return finalResults;
  }

  /**
   * Retrieves a record based on the QLDB id.
   * @param id The QLDB ID of the object.
   */

  async retrieve(id: string): Promise<T & { id: string }> {
    return await this.queryService.querySingle<T & { id: string }>(
      [
        `SELECT ${this.config.keyField}, t.*`,
        `FROM ${this.config.tableName} AS t`,
        `${
          this.config.useMetadataKey ? 'BY ' + this.config.keyField : ''
        } WHERE ${this.config.keyField} = ?`,
      ].join(' '),
      id,
    );
  }

  /**
   * Replaces a record based on qldb id.
   * @param id The QLDB Id of the object to be modified
   * @param data The data to replace the corresponding id with. This is full replacement.
   */

  async replace(id: string, data: T): Promise<void> {
    if (this.config.useMetadataKey) {
      delete data[this.config.keyField];
    }
    await this.queryService.execute(
      [
        `UPDATE ${this.config.tableName} AS tblrow ${
          this.config.useMetadataKey ? 'BY ' + this.config.keyField : ''
        }`,
        `SET tblrow = ?`,
        `WHERE ${this.config.keyField} = '${id}'`,
      ].join(' '),
      data,
    );
  }

  /**
   * Destroys a record from the table view. Note: no data is ever permanantly deleted from the underlying ledger.
   * @param id THe QLDB id you want to delete from the table.
   */
  async destroy(id: string): Promise<void> {
    await this.queryService.execute(
      `DELETE FROM ${this.config.tableName} ${
        this.config.useMetadataKey ? 'BY ' + this.config.keyField : ''
      } WHERE ${this.config.keyField} = ?`,
      id,
    );
  }

  async history(id: string): Promise<T[]> {
    return await this.queryService.queryForSubdocument(
      [
        `SELECT *`,
        `FROM history(${this.config.tableName}) AS h`,
        `WHERE h.${this.config.useMetadataKey ? 'metadata' : 'data'}.${
          this.config.keyField
        } = ?`,
      ].join(' '),
      'data',
      id,
    );
  }

  /**
   * Creates a table. Hidden from interface.
   */

  private async createTable(): Promise<number> {
    const result = await this.queryService.execute(
      `CREATE TABLE ${this.config.tableName}`,
    );

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
        const result = await this.queryService.execute(
          `CREATE INDEX ON ${this.config.tableName} (${field})`,
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
        this.config.tableName
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
}
