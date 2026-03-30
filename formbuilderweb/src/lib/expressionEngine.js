/**
 * A simple, secure recursive descent parser for boolean and arithmetic expressions.
 * Matches the logic in ExpressionEvaluator.java for consistency.
 */
export class ExpressionEvaluator {
  constructor(expression, context = {}) {
    this.expression = expression;
    this.context = context;
    this.pos = 0;
  }

  evaluate() {
    if (!this.expression || !this.expression.trim()) return true;
    try {
      return this.parseLogicalOr();
    } catch (e) {
      console.error('Expression evaluation failed:', e);
      return false;
    }
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.match('||')) {
      let right = this.parseLogicalAnd();
      left = this.toBoolean(left) || this.toBoolean(right);
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseComparison();
    while (this.match('&&')) {
      let right = this.parseComparison();
      left = this.toBoolean(left) && this.toBoolean(right);
    }
    return left;
  }

  parseComparison() {
    let left = this.parseAddition();
    this.consumeWhitespace();
    if (this.match('==')) return this.compare(left, this.parseAddition()) === 0;
    if (this.match('!=')) return this.compare(left, this.parseAddition()) !== 0;
    if (this.match('<=')) return this.compare(left, this.parseAddition()) <= 0;
    if (this.match('>=')) return this.compare(left, this.parseAddition()) >= 0;
    if (this.match('<')) return this.compare(left, this.parseAddition()) < 0;
    if (this.match('>')) return this.compare(left, this.parseAddition()) > 0;
    if (this.matchKeyword('contains')) {
      let right = this.parseAddition();
      return String(left).toLowerCase().includes(String(right).toLowerCase());
    }
    if (this.matchKeyword('starts_with')) {
      let right = this.parseAddition();
      return String(left).toLowerCase().startsWith(String(right).toLowerCase());
    }
    if (this.matchKeyword('ends_with')) {
      let right = this.parseAddition();
      return String(left).toLowerCase().endsWith(String(right).toLowerCase());
    }
    if (this.matchKeyword('matches')) {
      let right = this.parseAddition();
      try { return new RegExp(String(right)).test(String(left)); } catch (e) { return false; }
    }
    if (this.matchKeyword('not_matches')) {
      let right = this.parseAddition();
      try { return !new RegExp(String(right)).test(String(left)); } catch (e) { return false; }
    }
    if (this.matchKeyword('in')) {
      let right = this.parseAddition();
      const list = String(right).split(',').map(s => s.trim().toLowerCase());
      return list.includes(String(left).trim().toLowerCase());
    }
    if (this.matchKeyword('not_in')) {
      let right = this.parseAddition();
      const list = String(right).split(',').map(s => s.trim().toLowerCase());
      return !list.includes(String(left).trim().toLowerCase());
    }
    return left;
  }

  parseAddition() {
    let left = this.parseMultiplication();
    while (true) {
      if (this.match('+')) left = this.add(left, this.parseMultiplication());
      else if (this.match('-')) left = this.subtract(left, this.parseMultiplication());
      else break;
    }
    return left;
  }

  parseMultiplication() {
    let left = this.parseUnary();
    while (true) {
      if (this.match('*')) left = this.multiply(left, this.parseUnary());
      else if (this.match('/')) left = this.divide(left, this.parseUnary());
      else break;
    }
    return left;
  }

  parseUnary() {
    this.consumeWhitespace();
    if (this.match('!')) return !this.toBoolean(this.parseUnary());
    if (this.match('-')) {
      let val = this.parseUnary();
      return typeof val === 'number' ? -val : 0;
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    this.consumeWhitespace();
    if (this.match('(')) {
      let result = this.parseLogicalOr();
      if (!this.match(')')) throw new Error('Missing closing parenthesis');
      return result;
    }

    let char = this.peek();
    if (char === '\"' || char === '\'') return this.parseString();
    if (/[0-9.]/.test(char)) return this.parseNumber();

    if (this.expression.startsWith('true', this.pos)) {
      const nextChar = this.expression[this.pos + 4];
      if (!nextChar || !/[a-zA-Z0-9_-]/.test(nextChar)) {
        this.pos += 4; return true;
      }
    }
    if (this.expression.startsWith('false', this.pos)) {
      const nextChar = this.expression[this.pos + 5];
      if (!nextChar || !/[a-zA-Z0-9_-]/.test(nextChar)) {
        this.pos += 5; return false;
      }
    }

    return this.parseIdentifier();
  }

  parseString() {
    let quote = this.expression[this.pos++];
    let start = this.pos;
    while (this.pos < this.expression.length && this.expression[this.pos] !== quote) {
      if (this.expression[this.pos] === '\\') this.pos++;
      this.pos++;
    }
    let s = this.expression.substring(start, this.pos);
    this.pos++; // skip closing quote
    return s;
  }

  parseNumber() {
    let start = this.pos;
    while (this.pos < this.expression.length && /[0-9.]/.test(this.expression[this.pos])) {
      this.pos++;
    }
    return parseFloat(this.expression.substring(start, this.pos));
  }

  parseIdentifier() {
    let start = this.pos;
    while (this.pos < this.expression.length && /[a-zA-Z0-9_-]/.test(this.expression[this.pos])) {
      this.pos++;
    }
    let key = this.expression.substring(start, this.pos);
    if (!key) {
      throw new Error(`Unexpected character '${this.peek()}' at ${this.pos}`);
    }
    
    // Case-insensitive lookup
    if (this.context[key] !== undefined) return this.context[key];
    const actualKey = Object.keys(this.context).find(k => k.toLowerCase() === key.toLowerCase());
    return actualKey ? this.context[actualKey] : '';
  }

  // Helpers
  consumeWhitespace() {
    while (this.pos < this.expression.length && /\s/.test(this.expression[this.pos])) {
      this.pos++;
    }
  }

  peek() {
    return this.expression[this.pos];
  }

  match(s) {
    this.consumeWhitespace();
    if (this.expression.startsWith(s, this.pos)) {
      this.pos += s.length;
      return true;
    }
    return false;
  }

  matchKeyword(keyword) {
    this.consumeWhitespace();
    const sub = this.expression.substring(this.pos, this.pos + keyword.length);
    if (sub.toLowerCase() === keyword.toLowerCase()) {
      const nextChar = this.expression[this.pos + keyword.length];
      if (!nextChar || !/[a-zA-Z0-9_-]/.test(nextChar)) {
        this.pos += keyword.length;
        return true;
      }
    }
    return false;
  }

  toBoolean(val) {
    if (typeof val === 'boolean') return val;
    let s = String(val).toLowerCase();
    return s === 'true' || s === 'yes' || s === '1';
  }

  toDouble(val) {
    let n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }

  compare(a, b) {
    if (typeof a === 'number' || typeof b === 'number') {
      return this.toDouble(a) - this.toDouble(b);
    }
    const sa = String(a);
    const sb = String(b);
    if (sa !== '' && sb !== '' && !isNaN(sa) && !isNaN(sb)) {
      return parseFloat(sa) - parseFloat(sb);
    }
    return sa.localeCompare(sb);
  }

  add(a, b) { return this.toDouble(a) + this.toDouble(b); }
  subtract(a, b) { return this.toDouble(a) - this.toDouble(b); }
  multiply(a, b) { return this.toDouble(a) * this.toDouble(b); }
  divide(a, b) {
    let d = this.toDouble(b);
    return d === 0 ? 0 : this.toDouble(a) / d;
  }
}

export function convertLegacyToExpression(rule) {
  const { conditionField, conditionOperator, conditionValue } = rule;
  if (!conditionField || !conditionOperator || conditionOperator === 'ALWAYS') return 'true';

  const field = conditionField;
  const value = conditionValue || '';
  const escapedValue = `"${String(value).replace(/"/g, '\\"')}"`;

  switch (conditionOperator.toUpperCase()) {
    case 'EQUALS':            return `${field} == ${escapedValue}`;
    case 'NOT_EQUALS':        return `${field} != ${escapedValue}`;
    case 'CONTAINS':          return `${field} contains ${escapedValue}`;
    case 'STARTS_WITH':       return `${field} starts_with ${escapedValue}`;
    case 'ENDS_WITH':         return `${field} ends_with ${escapedValue}`;
    case 'GREATER_THAN':      return `${field} > ${value || 0}`;
    case 'LESS_THAN':         return `${field} < ${value || 0}`;
    case 'GREATER_THAN_EQUAL':return `${field} >= ${value || 0}`;
    case 'LESS_THAN_EQUAL':   return `${field} <= ${value || 0}`;
    case 'IS_EMPTY':          return `${field} == ""`;
    case 'IS_NOT_EMPTY':      return `${field} != ""`;
    case 'IS_TRUE':           return `(${field} == "true" || ${field} == "1" || ${field} == "yes" || ${field} == true)`;
    case 'IS_FALSE':          return `(${field} == "false" || ${field} == "0" || ${field} == "no" || ${field} == "" || ${field} == false)`;
    case 'IN_LIST':           return `${field} in ${escapedValue}`;
    case 'NOT_IN_LIST':       return `${field} not_in ${escapedValue}`;
    case 'MATCHES_REGEX':     return `${field} not_matches ${escapedValue}`; // Maps to "Does NOT Match" UI label
    default:                  return 'true';
  }
}

/**
 * Functional wrapper for easy use.
 */
export function evaluateExpression(expression, context) {
  return new ExpressionEvaluator(expression, context).evaluate();
}
