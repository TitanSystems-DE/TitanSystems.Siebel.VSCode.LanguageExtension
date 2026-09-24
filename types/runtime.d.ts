/// <reference no-default-lib="true"/>
/**
 * Conservative server eScript/ST runtime profile. No browser, Node, or ES2015+ library.
 * Primitive aliases model ST names with TypeScript primitives; they are not an ST interpreter.
 * See SOURCES.md for scope and documented compatibility limitations.
 */
type bool = boolean;
type chars = string;
type float = number;

interface Object {
    constructor: Function;
    toString(): string;
    valueOf(): Object;
    hasOwnProperty(name: string): boolean;
    isPrototypeOf(value: Object): boolean;
    propertyIsEnumerable(name: string): boolean;
}
interface ObjectConstructor { new(value?: any): Object; (value?: any): any; readonly prototype: Object; }
declare var Object: ObjectConstructor;
interface Function {
    apply(thisArg: any, args?: any): any;
    call(thisArg: any, ...args: any[]): any;
    readonly length: number;
    prototype: any;
    toString(): string;
}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface FunctionConstructor { new(...args: string[]): Function; (...args: string[]): Function; readonly prototype: Function; }
declare var Function: FunctionConstructor;
interface IArguments { [index: number]: any; length: number; callee: Function; }

interface String {
    readonly length: number;
    /** Character at the zero-based position. */
    charAt(position: number): string;
    /** Unicode value at the zero-based position. */
    charCodeAt(position: number): number;
    indexOf(search: string, position?: number): number;
    lastIndexOf(search: string, position?: number): number;
    substring(start: number, end?: number): string;
    substr(start: number, length?: number): string;
    split(separator: string | RegExp, limit?: number): string[];
    replace(search: string | RegExp, replacement: string): string;
    match(pattern: string | RegExp): RegExpMatchArray | null;
    toLowerCase(): string;
    toUpperCase(): string;
    toString(): string;
    valueOf(): string;
}
interface StringConstructor {
    new(value?: any): String;
    (value?: any): string;
    fromCharCode(...codes: number[]): string;
    readonly prototype: String;
}
declare var String: StringConstructor;
interface Boolean { valueOf(): boolean; toString(): string; }
interface BooleanConstructor { new(value?: any): Boolean; (value?: any): boolean; readonly prototype: Boolean; }
declare var Boolean: BooleanConstructor;
interface Number {
    toString(radix?: number): string;
    valueOf(): number;
    toFixed(digits?: number): string;
    toExponential(digits?: number): string;
    toPrecision(precision?: number): string;
}
interface NumberConstructor {
    new(value?: any): Number;
    (value?: any): number;
    readonly prototype: Number;
    readonly MAX_VALUE: number;
    readonly MIN_VALUE: number;
    readonly NaN: number;
    readonly NEGATIVE_INFINITY: number;
    readonly POSITIVE_INFINITY: number;
}
declare var Number: NumberConstructor;

interface Array<T = any> {
    [index: number]: T;
    length: number;
    /** Append elements and return the new array length. */
    push(...items: T[]): number;
    pop(): T | undefined;
    shift(): T | undefined;
    unshift(...items: T[]): number;
    join(separator?: string): string;
    slice(start?: number, end?: number): T[];
    splice(start: number, deleteCount: number, ...items: T[]): T[];
    reverse(): T[];
    sort(compare?: (left: T, right: T) => number): this;
    /** Oracle eScript reference documents concat() as comma-separated string conversion. */
    concat(): string;
    toString(): string;
    toLocaleString(): string;
}
interface ArrayConstructor {
    new(length?: number): any[];
    new<T = any>(...items: T[]): T[];
    (length?: number): any[];
    <T = any>(...items: T[]): T[];
    readonly prototype: any[];
}
declare var Array: ArrayConstructor;
/** Type-only support required by TypeScript; not a Siebel constructor. */
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }

interface RegExp {
    exec(value: string): RegExpExecArray | null;
    test(value: string): boolean;
    readonly source: string;
    readonly global: boolean;
    readonly ignoreCase: boolean;
    readonly multiline: boolean;
    lastIndex: number;
}
interface RegExpExecArray extends Array<string> { index: number; input: string; }
interface RegExpMatchArray extends Array<string> { index?: number; input?: string; }
interface RegExpConstructor {
    new(pattern: string | RegExp, flags?: string): RegExp;
    (pattern: string | RegExp, flags?: string): RegExp;
    readonly prototype: RegExp;
}
declare var RegExp: RegExpConstructor;

interface Date {
    toString(): string;
    toGMTString(): string;
    toUTCString(): string;
    valueOf(): number;
    getTime(): number;
    getTimezoneOffset(): number;
    getDate(): number;
    getDay(): number;
    getMonth(): number;
    getFullYear(): number;
    getYear(): number;
    getHours(): number;
    getMinutes(): number;
    getSeconds(): number;
    getMilliseconds(): number;
    getUTCDate(): number;
    getUTCDay(): number;
    getUTCMonth(): number;
    getUTCFullYear(): number;
    getUTCHours(): number;
    getUTCMinutes(): number;
    getUTCSeconds(): number;
    getUTCMilliseconds(): number;
    setTime(value: number): number;
    setDate(day: number): number;
    setMonth(month: number, day?: number): number;
    setFullYear(year: number, month?: number, day?: number): number;
    setYear(year: number): number;
    setHours(hours: number, minutes?: number, seconds?: number, ms?: number): number;
    setMinutes(minutes: number, seconds?: number, ms?: number): number;
    setSeconds(seconds: number, ms?: number): number;
    setMilliseconds(ms: number): number;
    setUTCDate(day: number): number;
    setUTCMonth(month: number, day?: number): number;
    setUTCFullYear(year: number, month?: number, day?: number): number;
    setUTCHours(hours: number, minutes?: number, seconds?: number, ms?: number): number;
    setUTCMinutes(minutes: number, seconds?: number, ms?: number): number;
    setUTCSeconds(seconds: number, ms?: number): number;
    setUTCMilliseconds(ms: number): number;
}
interface DateConstructor {
    new(): Date;
    new(value: number | string | String): Date;
    new(year: number, month: number, day?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): Date;
    (): string;
    parse(value: string): number;
    UTC(year: number, month: number, day?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): number;
    readonly prototype: Date;
}
declare var Date: DateConstructor;
interface Math {
    readonly E: number; readonly LN10: number; readonly LN2: number;
    readonly LOG2E: number; readonly LOG10E: number; readonly PI: number;
    readonly SQRT1_2: number; readonly SQRT2: number;
    abs(value: number): number; acos(value: number): number; asin(value: number): number;
    atan(value: number): number; atan2(y: number, x: number): number;
    ceil(value: number): number; cos(value: number): number; exp(value: number): number;
    floor(value: number): number; log(value: number): number;
    max(...values: number[]): number; min(...values: number[]): number;
    pow(base: number, exponent: number): number; random(): number;
    round(value: number): number; sin(value: number): number;
    sqrt(value: number): number; tan(value: number): number;
}
declare var Math: Math;
declare const NaN: number;
declare const Infinity: number;
declare function parseInt(value: SblStrIn, radix?: number): number;
declare function parseFloat(value: SblStrIn): number;
declare function isFinite(value: any): boolean;
declare function getArrayLength(value: any[]): number;
declare function setArrayLength(value: any[], length: number): void;
declare function undefine(value: any): void;
