export interface QldbQuery<T> {
  fields?: Array<keyof T>;
  filter?: EqualityExpression<T> | string;
}

export type Query<T> = null;
export type EqualityExpression<T> = { [K in keyof T]?: EqualityValueSide };
export type EqualityValueSide = {
  operator: EqualityOperator;
  value: string | number | string[] | number[];
};
export type EqualityOperator =
  | '='
  | '>'
  | '<'
  | '>='
  | '<='
  | '<>'
  | 'IN'
  | 'BETWEEN';

export function getQueryFilter<T>(
  filter: EqualityExpression<T> | string,
): string {
  if (isFilterEqualityExpression(filter)) {
    const expressions: string[] = [];
    for (const key in filter as EqualityExpression<any>) {
      const val = filter[key];
      const value = getValue(val);
      expressions.push(`tbl.${key} ${val.operator} ${value}`);
    }
    return expressions.join(' AND ');
  } else {
    return filter as string;
  }
}

function getValue(val: EqualityValueSide): string {
  if (Array.isArray(val.value)) {
    if (val.value.every(item => typeof item === 'string')) {
      if (val.operator === 'IN') {
        return `( '${(val.value as string[]).join(`' , '`)}' )`;
      } else {
        return `'${val.value[0]}' AND '${val.value[1]}'`;
      }
    } else {
      if (val.operator === 'IN') {
        return `( ${(val.value as string[]).join(` , `)} )`;
      } else {
        return `${val.value[0]} AND ${val.value[1]}`;
      }
    }
  } else {
    if (typeof val.value === 'string') {
      return `'${val.value}'`;
    }
    return val.value.toString();
  }
}

function isFilterEqualityExpression<T>(
  filter: any,
): filter is EqualityExpression<T> {
  return typeof filter !== 'string';
}
