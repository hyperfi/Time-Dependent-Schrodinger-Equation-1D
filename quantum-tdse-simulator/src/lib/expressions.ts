/** A bounded mathematical grammar. No JavaScript evaluation or object access. */
import type { ParameterSet } from "./parameters";

export interface Complex {
  real: number;
  imag: number;
}
type Scope = Record<string, number>;
type Evaluator = (scope: Scope) => Complex;
const c = (real: number, imag = 0): Complex => ({ real, imag });
const add = (a: Complex, b: Complex) => c(a.real + b.real, a.imag + b.imag);
const mul = (a: Complex, b: Complex) =>
  c(a.real * b.real - a.imag * b.imag, a.real * b.imag + a.imag * b.real);
const div = (a: Complex, b: Complex) => {
  const d = b.real * b.real + b.imag * b.imag;
  return c(
    (a.real * b.real + a.imag * b.imag) / d,
    (a.imag * b.real - a.real * b.imag) / d,
  );
};
const exp = (a: Complex) =>
  c(Math.exp(a.real) * Math.cos(a.imag), Math.exp(a.real) * Math.sin(a.imag));
const log = (a: Complex) =>
  c(Math.log(Math.hypot(a.real, a.imag)), Math.atan2(a.imag, a.real));
const sin = (a: Complex) =>
  c(Math.sin(a.real) * Math.cosh(a.imag), Math.cos(a.real) * Math.sinh(a.imag));
const cos = (a: Complex) =>
  c(
    Math.cos(a.real) * Math.cosh(a.imag),
    -Math.sin(a.real) * Math.sinh(a.imag),
  );
const sinh = (a: Complex) =>
  c(Math.sinh(a.real) * Math.cos(a.imag), Math.cosh(a.real) * Math.sin(a.imag));
const cosh = (a: Complex) =>
  c(Math.cosh(a.real) * Math.cos(a.imag), Math.sinh(a.real) * Math.sin(a.imag));
const pow = (a: Complex, b: Complex) => {
  if (a.imag === 0 && b.imag === 0 && (a.real >= 0 || Number.isInteger(b.real)))
    return c(a.real ** b.real);
  return exp(mul(b, log(a)));
};
const functions: Record<string, (a: Complex) => Complex> = {
  sin,
  cos,
  tan: (a) => div(sin(a), cos(a)),
  sinh,
  cosh,
  tanh: (a) => div(sinh(a), cosh(a)),
  exp,
  log,
  ln: log,
  sqrt: (a) => pow(a, c(0.5)),
  abs: (a) => c(Math.hypot(a.real, a.imag)),
};
export const RESERVED = new Set([
  "x",
  "t",
  "i",
  "pi",
  "e",
  ...Object.keys(functions),
]);

export function expressionSymbols(expression: string): string[] {
  const names: string[] = [];
  for (const match of expression.matchAll(
    /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|([a-zA-Z][a-zA-Z0-9]*)/g,
  ))
    if (match[1] && !RESERVED.has(match[1])) names.push(match[1]);
  return [...new Set(names)];
}

export function compileExpression(
  expression: string,
  parameters: ParameterSet = {},
): (x: number, t?: number) => Complex {
  if (!expression.trim()) throw new Error("Enter a mathematical expression.");
  if (expression.length > 512)
    throw new Error("Keep expressions below 512 characters.");
  const tokens: string[] = [];
  const regex =
    /\s*((?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z][a-zA-Z0-9]*|[()+\-*/^,])/y;
  let offset = 0;
  while (offset < expression.length) {
    if (!expression.slice(offset).trim()) break;
    regex.lastIndex = offset;
    const match = regex.exec(expression);
    if (!match)
      throw new Error(
        `Unexpected character at column ${offset + 1}. Use mathematical operators and functions.`,
      );
    tokens.push(match[1]);
    offset = regex.lastIndex;
    if (tokens.length > 200)
      throw new Error("This expression is too complex. Simplify it.");
  }
  let index = 0,
    depth = 0;
  const take = () => tokens[index++];
  const peek = () => tokens[index];
  const parseSum = (): Evaluator => {
    let left = parseProduct();
    while (peek() === "+" || peek() === "-") {
      const op = take(),
        previous = left,
        right = parseProduct();
      left = (s) => add(previous(s), mul(c(op === "+" ? 1 : -1), right(s)));
    }
    return left;
  };
  const parseProduct = (): Evaluator => {
    let left = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = take(),
        previous = left,
        right = parseUnary();
      left = (s) =>
        op === "*" ? mul(previous(s), right(s)) : div(previous(s), right(s));
    }
    return left;
  };
  const parseUnary = (): Evaluator => {
    if (peek() === "+" || peek() === "-") {
      const sign = take() === "+" ? 1 : -1,
        value = parseUnary();
      return (s) => mul(c(sign), value(s));
    }
    let left = parseAtom();
    if (peek() === "^") {
      take();
      const previous = left,
        right = parseUnary();
      left = (s) => pow(previous(s), right(s));
    }
    return left;
  };
  const parseAtom = (): Evaluator => {
    if (++depth > 64) throw new Error("Too many nested expressions.");
    const token = take();
    let result: Evaluator;
    if (token === "(") {
      result = parseSum();
      if (take() !== ")") throw new Error("A closing parenthesis is missing.");
    } else if (token && /^(\d|\.)/.test(token)) {
      const value = Number(token);
      result = () => c(value);
    } else if (token && /^[a-zA-Z]/.test(token)) {
      if (peek() === "(") {
        if (!Object.prototype.hasOwnProperty.call(functions, token))
          throw new Error(`Unknown function “${token}”.`);
        take();
        const arg = parseSum();
        if (take() !== ")")
          throw new Error("Expected one argument and a closing parenthesis.");
        result = (s) => functions[token](arg(s));
      } else if (token === "i") result = () => c(0, 1);
      else if (token === "pi") result = () => c(Math.PI);
      else if (token === "e") result = () => c(Math.E);
      else if (
        token === "x" ||
        token === "t" ||
        Object.prototype.hasOwnProperty.call(parameters, token)
      )
        result = (s) => c(s[token]);
      else throw new Error(`Define parameter “${token}” before applying.`);
    } else
      throw new Error("Expected a number, variable, function, or parenthesis.");
    depth--;
    return result;
  };
  const evaluate = parseSum();
  if (index !== tokens.length)
    throw new Error(`Unexpected “${peek()}”. Use * for multiplication.`);
  const scope: Scope = {};
  Object.values(parameters).forEach((p) => {
    scope[p.name] = p.value;
  });
  return (x, t = 0) => {
    scope.x = x;
    scope.t = t;
    const value = evaluate(scope);
    if (!Number.isFinite(value.real) || !Number.isFinite(value.imag))
      throw new Error(`Expression is not finite at x=${x.toPrecision(5)}.`);
    return value;
  };
}

export function compileRealExpression(
  expression: string,
  parameters: ParameterSet = {},
) {
  const evaluate = compileExpression(expression, parameters);
  return (x: number, t = 0) => {
    const value = evaluate(x, t);
    if (Math.abs(value.imag) > 1e-12)
      throw new Error(
        "This field requires a real value. Use cos(k*x) and sin(k*x), or enter a complex state with an empty imaginary field.",
      );
    return value.real;
  };
}
