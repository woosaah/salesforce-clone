// SOQL Parser - Parses Salesforce Object Query Language into AST

export interface SOQLQuery {
  type: 'SELECT';
  fields: Field[];
  from: string;
  where?: WhereClause;
  orderBy?: OrderByClause[];
  limit?: number;
}

export interface Field {
  name: string;
  relationship?: string; // For relationship queries like Account.Name
}

export interface WhereClause {
  type: 'condition' | 'and' | 'or';
  field?: string;
  operator?: string;
  value?: any;
  left?: WhereClause;
  right?: WhereClause;
}

export interface OrderByClause {
  field: string;
  direction: 'ASC' | 'DESC';
}

export class SOQLParser {
  private tokens: string[] = [];
  private current = 0;

  parse(query: string): SOQLQuery {
    // Tokenize
    this.tokens = this.tokenize(query);
    this.current = 0;

    // Parse SELECT
    if (!this.match('SELECT')) {
      throw new Error('Query must start with SELECT');
    }

    const fields = this.parseFields();

    // Parse FROM
    if (!this.match('FROM')) {
      throw new Error('Expected FROM clause');
    }

    const from = this.advance();

    const result: SOQLQuery = {
      type: 'SELECT',
      fields,
      from,
    };

    // Parse WHERE (optional)
    if (this.match('WHERE')) {
      result.where = this.parseWhere();
    }

    // Parse ORDER BY (optional)
    if (this.match('ORDER')) {
      if (!this.match('BY')) {
        throw new Error('Expected BY after ORDER');
      }
      result.orderBy = this.parseOrderBy();
    }

    // Parse LIMIT (optional)
    if (this.match('LIMIT')) {
      const limitValue = this.advance();
      result.limit = parseInt(limitValue);
    }

    return result;
  }

  private tokenize(query: string): string[] {
    // Simple tokenization - split by spaces but preserve strings in quotes
    const tokens: string[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < query.length; i++) {
      const char = query[i];

      if ((char === "'" || char === '"') && !inString) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (char === stringChar && inString) {
        inString = false;
        current += char;
      } else if (char === ' ' && !inString) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else if (char === ',' && !inString) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        // Skip comma
      } else if ((char === '(' || char === ')') && !inString) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(char);
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  private parseFields(): Field[] {
    const fields: Field[] = [];

    while (this.current < this.tokens.length && this.peek().toUpperCase() !== 'FROM') {
      const token = this.advance();

      // Check for relationship field (Account.Name)
      if (token.includes('.')) {
        const parts = token.split('.');
        fields.push({
          relationship: parts[0],
          name: parts[1],
        });
      } else {
        fields.push({ name: token });
      }
    }

    return fields;
  }

  private parseWhere(): WhereClause {
    return this.parseOrExpression();
  }

  private parseOrExpression(): WhereClause {
    let left = this.parseAndExpression();

    while (this.match('OR')) {
      const right = this.parseAndExpression();
      left = {
        type: 'or',
        left,
        right,
      };
    }

    return left;
  }

  private parseAndExpression(): WhereClause {
    let left = this.parseCondition();

    while (this.match('AND')) {
      const right = this.parseCondition();
      left = {
        type: 'and',
        left,
        right,
      };
    }

    return left;
  }

  private parseCondition(): WhereClause {
    // Handle parentheses
    if (this.match('(')) {
      const expr = this.parseOrExpression();
      if (!this.match(')')) {
        throw new Error('Expected closing parenthesis');
      }
      return expr;
    }

    const field = this.advance();
    const operator = this.advance();
    let value: any;

    if (operator.toUpperCase() === 'IN') {
      // Parse IN clause: field IN ('val1', 'val2')
      if (!this.match('(')) {
        throw new Error('Expected ( after IN');
      }
      const values: any[] = [];
      while (!this.match(')')) {
        values.push(this.parseValue(this.advance()));
      }
      value = values;
    } else {
      value = this.parseValue(this.advance());
    }

    return {
      type: 'condition',
      field,
      operator: operator.toUpperCase(),
      value,
    };
  }

  private parseOrderBy(): OrderByClause[] {
    const clauses: OrderByClause[] = [];

    while (this.current < this.tokens.length &&
           this.peek().toUpperCase() !== 'LIMIT') {
      const field = this.advance();
      let direction: 'ASC' | 'DESC' = 'ASC';

      if (this.current < this.tokens.length) {
        const next = this.peek().toUpperCase();
        if (next === 'ASC' || next === 'DESC') {
          direction = this.advance().toUpperCase() as 'ASC' | 'DESC';
        }
      }

      clauses.push({ field, direction });
    }

    return clauses;
  }

  private parseValue(token: string): any {
    // Remove quotes from strings
    if ((token.startsWith("'") && token.endsWith("'")) ||
        (token.startsWith('"') && token.endsWith('"'))) {
      return token.slice(1, -1);
    }

    // Parse numbers
    if (!isNaN(Number(token))) {
      return Number(token);
    }

    // Parse booleans
    if (token.toLowerCase() === 'true') return true;
    if (token.toLowerCase() === 'false') return false;
    if (token.toLowerCase() === 'null') return null;

    return token;
  }

  private match(expected: string): boolean {
    if (this.current >= this.tokens.length) {
      return false;
    }

    if (this.tokens[this.current].toUpperCase() === expected.toUpperCase()) {
      this.current++;
      return true;
    }

    return false;
  }

  private peek(): string {
    if (this.current >= this.tokens.length) {
      return '';
    }
    return this.tokens[this.current];
  }

  private advance(): string {
    if (this.current >= this.tokens.length) {
      throw new Error('Unexpected end of query');
    }
    return this.tokens[this.current++];
  }
}

export function parseSOQL(query: string): SOQLQuery {
  const parser = new SOQLParser();
  return parser.parse(query);
}
