// SOQL to PostgreSQL Translator
// Converts parsed SOQL queries to PostgreSQL queries

import { SOQLQuery, Field, WhereClause, OrderByClause } from './soql-parser';
import { query, queryWithTenant } from '../config/database';
import { ObjectMeta, FieldMeta } from '../types';

export interface TranslatedQuery {
  sql: string;
  params: any[];
}

export class SOQLTranslator {
  private tenantId: string;
  private paramCounter = 1;
  private params: any[] = [];

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async translate(soqlQuery: SOQLQuery): Promise<TranslatedQuery> {
    this.paramCounter = 1;
    this.params = [];

    // Get object metadata
    const objects = await queryWithTenant<ObjectMeta>(
      this.tenantId,
      'SELECT * FROM objects_meta WHERE object_name = $1',
      [soqlQuery.from]
    );

    if (objects.length === 0) {
      throw new Error(`Object '${soqlQuery.from}' not found`);
    }

    const object = objects[0];

    // Get fields metadata
    const fields = await queryWithTenant<FieldMeta>(
      this.tenantId,
      'SELECT * FROM fields_meta WHERE object_id = $1',
      [object.object_id]
    );

    // Build SELECT clause
    const selectClause = await this.buildSelectClause(soqlQuery.fields, object, fields);

    // Build FROM clause
    const fromClause = this.buildFromClause(object, soqlQuery.fields);

    // Build WHERE clause
    let whereClause = `od.object_id = $${this.addParam(object.object_id)} AND od.is_deleted = false`;
    if (soqlQuery.where) {
      const additionalWhere = this.buildWhereClause(soqlQuery.where, fields);
      whereClause += ` AND ${additionalWhere}`;
    }

    // Build ORDER BY clause
    const orderByClause = soqlQuery.orderBy
      ? this.buildOrderByClause(soqlQuery.orderBy)
      : '';

    // Build LIMIT clause
    const limitClause = soqlQuery.limit ? `LIMIT ${soqlQuery.limit}` : '';

    // Construct final SQL
    const sql = `
      SELECT ${selectClause}
      FROM ${fromClause}
      WHERE ${whereClause}
      ${orderByClause}
      ${limitClause}
    `.trim();

    return {
      sql,
      params: this.params,
    };
  }

  private async buildSelectClause(
    soqlFields: Field[],
    object: ObjectMeta,
    fields: FieldMeta[]
  ): Promise<string> {
    const selectParts: string[] = [];

    // Always include record_id
    selectParts.push('od.record_id');

    for (const soqlField of soqlFields) {
      if (soqlField.relationship) {
        // Relationship field (e.g., Account.Name)
        // Find the lookup field in current object
        const lookupField = fields.find(
          (f) =>
            f.field_name === `${soqlField.relationship}Id` ||
            f.field_name === soqlField.relationship
        );

        if (!lookupField || !lookupField.lookup_object_id) {
          throw new Error(
            `Relationship '${soqlField.relationship}' not found on ${object.object_name}`
          );
        }

        // Get the related object metadata
        const relatedObjects = await queryWithTenant<ObjectMeta>(
          this.tenantId,
          'SELECT * FROM objects_meta WHERE object_id = $1',
          [lookupField.lookup_object_id]
        );

        if (relatedObjects.length === 0) {
          throw new Error(`Related object not found for ${soqlField.relationship}`);
        }

        const relatedObject = relatedObjects[0];
        const alias = soqlField.relationship.toLowerCase();

        selectParts.push(
          `${alias}.data->>'${soqlField.name}' AS "${soqlField.relationship}.${soqlField.name}"`
        );
      } else {
        // Regular field from JSONB data
        selectParts.push(`od.data->>'${soqlField.name}' AS "${soqlField.name}"`);
      }
    }

    return selectParts.join(', ');
  }

  private buildFromClause(object: ObjectMeta, soqlFields: Field[]): string {
    let fromClause = 'object_data od';

    // Add JOINs for relationship fields
    const relationships = soqlFields.filter((f) => f.relationship);
    for (const rel of relationships) {
      const alias = rel.relationship?.toLowerCase() || "";
      fromClause += `
        LEFT JOIN object_data ${alias} ON
          ${alias}.record_id = (od.data->>'${rel.relationship}Id')::uuid
          AND ${alias}.is_deleted = false
      `;
    }

    return fromClause;
  }

  private buildWhereClause(where: WhereClause, fields: FieldMeta[]): string {
    if (where.type === 'and') {
      return `(${this.buildWhereClause(where.left!, fields)} AND ${this.buildWhereClause(where.right!, fields)})`;
    }

    if (where.type === 'or') {
      return `(${this.buildWhereClause(where.left!, fields)} OR ${this.buildWhereClause(where.right!, fields)})`;
    }

    // Condition
    const field = where.field!;
    const operator = where.operator!;
    const value = where.value;

    // Get field metadata to determine type
    const fieldMeta = fields.find((f) => f.field_name === field);
    const isNumeric = fieldMeta && ['number', 'currency', 'percent'].includes(fieldMeta.field_type);

    // Build condition based on operator
    switch (operator) {
      case '=':
        if (isNumeric) {
          return `(od.data->>'${field}')::numeric = $${this.addParam(value)}`;
        }
        return `od.data->>'${field}' = $${this.addParam(value)}`;

      case '!=':
      case '<>':
        if (isNumeric) {
          return `(od.data->>'${field}')::numeric != $${this.addParam(value)}`;
        }
        return `od.data->>'${field}' != $${this.addParam(value)}`;

      case '<':
        if (isNumeric) {
          return `(od.data->>'${field}')::numeric < $${this.addParam(value)}`;
        }
        return `od.data->>'${field}' < $${this.addParam(value)}`;

      case '>':
        if (isNumeric) {
          return `(od.data->>'${field}')::numeric > $${this.addParam(value)}`;
        }
        return `od.data->>'${field}' > $${this.addParam(value)}`;

      case '<=':
        if (isNumeric) {
          return `(od.data->>'${field}')::numeric <= $${this.addParam(value)}`;
        }
        return `od.data->>'${field}' <= $${this.addParam(value)}`;

      case '>=':
        if (isNumeric) {
          return `(od.data->>'${field}')::numeric >= $${this.addParam(value)}`;
        }
        return `od.data->>'${field}' >= $${this.addParam(value)}`;

      case 'LIKE':
        return `od.data->>'${field}' LIKE $${this.addParam(value)}`;

      case 'IN':
        const placeholders = (value as any[]).map((v) => `$${this.addParam(v)}`).join(', ');
        return `od.data->>'${field}' IN (${placeholders})`;

      case 'NOT IN':
        const notPlaceholders = (value as any[]).map((v) => `$${this.addParam(v)}`).join(', ');
        return `od.data->>'${field}' NOT IN (${notPlaceholders})`;

      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  private buildOrderByClause(orderBy: OrderByClause[]): string {
    const parts = orderBy.map((clause) => {
      return `od.data->>'${clause.field}' ${clause.direction}`;
    });

    return `ORDER BY ${parts.join(', ')}`;
  }

  private addParam(value: any): number {
    this.params.push(value);
    return this.paramCounter++;
  }
}

export async function translateSOQL(
  soqlQuery: SOQLQuery,
  tenantId: string
): Promise<TranslatedQuery> {
  const translator = new SOQLTranslator(tenantId);
  return translator.translate(soqlQuery);
}
