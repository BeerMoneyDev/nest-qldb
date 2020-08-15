import { Repository } from './repository';
import { QldbDriver, TransactionExecutor } from 'amazon-qldb-driver-nodejs';
import { QldbQueryService } from './query.service';

class TestClass {
  testerName: string;
  testerAge?: number;
}

describe('Repository', () => {
  let subject: Repository<TestClass>;
  const tableName = 'test_table';
  let executeLambdaSpy: jest.SpyInstance<
    Promise<any>,
    [
      (transactionExecutor: TransactionExecutor) => any,
      ((retryAttempt: number) => void)?,
    ]
  >;

  beforeEach(async () => {
    const driver = ({
      executeLambda: () => null,
    } as any) as QldbDriver;

    executeLambdaSpy = jest.spyOn(driver, 'executeLambda');
    subject = new Repository(new QldbQueryService(driver), tableName);
  });

  describe('query()', () => {
    it('should query string equality', async () => {
      const expectedResponse: TestClass = {
        testerName: 'Happy Gilmore',
        testerAge: 35,
      };
      const qldbResponse = {
        getResultList: () => [expectedResponse],
      };
      executeLambdaSpy.mockReturnValue(Promise.resolve(qldbResponse));
      const response = await subject.query({
        fields: ['testerAge'],
        filter: { testerName: { operator: '=', value: 'Happy Gilmore' } },
      });
      expect(executeLambdaSpy).toHaveBeenCalledTimes(1);
      expect(response[0]).toEqual(expectedResponse);
    });

    it('should query string range', async () => {
      const expectedResponse: TestClass = {
        testerName: 'Happy Gilmore',
        testerAge: 35,
      };
      const qldbResponse = {
        getResultList: () => [expectedResponse],
      };
      executeLambdaSpy.mockReturnValue(Promise.resolve(qldbResponse));
      const response = await subject.query({
        fields: ['testerAge'],
        filter: {
          testerName: { operator: 'IN', value: ['Billy Madison', 'Lil Nicky'] },
        },
      });
      expect(executeLambdaSpy).toHaveBeenCalledTimes(1);
      expect(response[0]).toEqual(expectedResponse);
    });

    it('should query number between', async () => {
      const expectedResponse: TestClass = {
        testerName: 'Happy Gilmore',
        testerAge: 35,
      };
      const qldbResponse = {
        getResultList: () => [expectedResponse],
      };
      executeLambdaSpy.mockReturnValue(Promise.resolve(qldbResponse));
      const response = await subject.query({
        fields: ['testerAge'],
        filter: { testerAge: { operator: 'BETWEEN', value: [30, 40] } },
      });
      expect(executeLambdaSpy).toHaveBeenCalledTimes(1);
      expect(response[0]).toEqual(expectedResponse);
    });

    it('should query number equality', async () => {
      const expectedResponse: TestClass = {
        testerName: 'Happy Gilmore',
        testerAge: 35,
      };
      const qldbResponse = {
        getResultList: () => [expectedResponse],
      };
      executeLambdaSpy.mockReturnValue(Promise.resolve(qldbResponse));
      const response = await subject.query({
        fields: ['testerAge'],
        filter: { testerAge: { operator: '=', value: 35 } },
      });
      expect(executeLambdaSpy).toHaveBeenCalledTimes(1);
      expect(response[0]).toEqual(expectedResponse);
    });
  });

  describe('create()', () => {
    it('should create', async () => {
      const expectedResponse: TestClass = {
        testerName: 'Happy Gilmore',
        testerAge: 35,
      };
      const qldbResponse = {
        getResultList: () => [{ ...expectedResponse, documentId: '1234' }],
      };
      executeLambdaSpy.mockReturnValue(Promise.resolve(qldbResponse));
      const response = await subject.create(expectedResponse);
      expect(executeLambdaSpy).toHaveBeenCalledTimes(1);
      expect(response.id).toEqual('1234');
    });
  });

  describe('retrieve()', () => {
    it('should retrieve', async () => {
      const expectedResponse: TestClass = {
        testerName: 'Happy Gilmore',
        testerAge: 35,
      };
      const documentId = '1234';
      const qldbResponse = {
        getResultList: () => [{ ...expectedResponse, id: documentId }],
      };
      executeLambdaSpy.mockReturnValue(Promise.resolve(qldbResponse));
      const response = await subject.retrieve(documentId);
      expect(executeLambdaSpy).toHaveBeenCalledTimes(1);
      expect(response.id).toEqual(documentId);
    });
  });

  describe('history()', () => {
    it('should get document history', async () => {
      const expectedResponse: TestClass = {
        testerName: 'Happy Gilmore',
        testerAge: 35,
      };
      const documentId = '1234';
      const qldbResponse = {
        getResultList: () => [{ data: { ...expectedResponse } }],
      };
      executeLambdaSpy.mockReturnValue(Promise.resolve(qldbResponse));
      const response = await subject.history(documentId);
      expect(executeLambdaSpy).toHaveBeenCalledTimes(1);
      expect(response[0]).toEqual(expectedResponse);
    });
  });

  describe('replace()', () => {
    it('should replace', async () => {
      const expectedResponse: TestClass = {
        testerName: 'Happy Gilmore',
        testerAge: 35,
      };
      const documentId = '1234';
      const qldbResponse = {
        getResultList: () => [{ ...expectedResponse, id: documentId }],
      };
      executeLambdaSpy.mockReturnValue(Promise.resolve(qldbResponse));
      await subject.replace(documentId, expectedResponse);
      expect(executeLambdaSpy).toHaveBeenCalledTimes(1);
    });
  });
  describe('destroy()', () => {
    it('should destroy', async () => {
      const documentId = '1234';
      executeLambdaSpy.mockReturnValue(Promise.resolve());
      await subject.destroy(documentId);
      expect(executeLambdaSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('createTableAndIndexes()', () => {
    it('should createTableAndIndexes', async () => {
      const indexes = ['testerName'];
      executeLambdaSpy.mockReturnValue(Promise.resolve());
      await subject.createTableAndIndexes(indexes);
      expect(executeLambdaSpy).toHaveBeenCalledTimes(2);
    });
    it('should handle table creation failure gracefully', async () => {
      const indexes = ['testerName'];
      executeLambdaSpy.mockReturnValueOnce(
        Promise.reject(new Error('Cannot make table')),
      );
      executeLambdaSpy.mockReturnValueOnce(Promise.resolve());
      await subject.createTableAndIndexes(indexes);
      expect(executeLambdaSpy).toHaveBeenCalledTimes(2);
    });
    it('should handle index creation failure gracefully', async () => {
      const indexes = ['testerName'];
      executeLambdaSpy.mockReturnValueOnce(Promise.resolve());
      executeLambdaSpy.mockReturnValueOnce(
        Promise.reject(new Error('Cannot make index')),
      );
      await subject.createTableAndIndexes(indexes);
      expect(executeLambdaSpy).toHaveBeenCalledTimes(2);
    });
  });
});
