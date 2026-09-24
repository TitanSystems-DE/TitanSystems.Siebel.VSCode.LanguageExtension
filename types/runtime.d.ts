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
    toString(): chars;
    valueOf(): Object;
    hasOwnProperty(name: chars): bool;
    isPrototypeOf(value: Object): bool;
    propertyIsEnumerable(name: chars): bool;
}
interface ObjectConstructor { new(value?: any): Object; (value?: any): any; readonly prototype: Object; }
declare var Object: ObjectConstructor;
interface Function {
    apply(thisArg: any, args?: any): any;
    call(thisArg: any, ...args: any[]): any;
    readonly length: float;
    prototype: any;
    toString(): chars;
}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface FunctionConstructor { new(...args: chars[]): Function; (...args: chars[]): Function; readonly prototype: Function; }
declare var Function: FunctionConstructor;
interface IArguments { [index: float]: any; length: float; callee: Function; }

interface String {
    readonly length: float;
    /** Character at the zero-based position. */
    charAt(position: float): chars;
    /** Unicode value at the zero-based position. */
    charCodeAt(position: float): float;
    indexOf(search: chars, position?: float): float;
    lastIndexOf(search: chars, position?: float): float;
    substring(start: float, end?: float): chars;
    substr(start: float, length?: float): chars;
    split(separator: chars | RegExp, limit?: float): chars[];
    replace(search: chars | RegExp, replacement: chars): chars;
    match(pattern: chars | RegExp): RegExpMatchArray | null;
    toLowerCase(): chars;
    toUpperCase(): chars;
    toString(): chars;
    valueOf(): chars;
}
interface StringConstructor {
    new(value?: any): String;
    (value?: any): chars;
    fromCharCode(...codes: float[]): chars;
    readonly prototype: String;
}
declare var String: StringConstructor;
interface Boolean { valueOf(): bool; toString(): chars; }
interface BooleanConstructor { new(value?: any): Boolean; (value?: any): bool; readonly prototype: Boolean; }
declare var Boolean: BooleanConstructor;
interface Number {
    toString(radix?: float): chars;
    valueOf(): float;
    toFixed(digits?: float): chars;
    toExponential(digits?: float): chars;
    toPrecision(precision?: float): chars;
}
interface NumberConstructor {
    new(value?: any): Number;
    (value?: any): float;
    readonly prototype: Number;
    readonly MAX_VALUE: float;
    readonly MIN_VALUE: float;
    readonly NaN: float;
    readonly NEGATIVE_INFINITY: float;
    readonly POSITIVE_INFINITY: float;
}
declare var Number: NumberConstructor;

interface Array<T = any> {
    [index: float]: T;
    length: float;
    /** Append elements and return the new array length. */
    push(...items: T[]): float;
    pop(): T | undefined;
    shift(): T | undefined;
    unshift(...items: T[]): float;
    join(separator?: chars): chars;
    slice(start?: float, end?: float): T[];
    splice(start: float, deleteCount: float, ...items: T[]): T[];
    reverse(): T[];
    sort(compare?: (left: T, right: T) => float): this;
    /** Oracle eScript reference documents concat() as comma-separated chars conversion. */
    concat(): chars;
    toString(): chars;
    toLocaleString(): chars;
}
interface ArrayConstructor {
    new(length?: float): any[];
    new<T = any>(...items: T[]): T[];
    (length?: float): any[];
    <T = any>(...items: T[]): T[];
    readonly prototype: any[];
}
declare var Array: ArrayConstructor;
/** Type-only support required by TypeScript; not a Siebel constructor. */
interface ReadonlyArray<T> { readonly [index: float]: T; readonly length: float; }

interface RegExp {
    exec(value: chars): RegExpExecArray | null;
    test(value: chars): bool;
    readonly source: chars;
    readonly global: bool;
    readonly ignoreCase: bool;
    readonly multiline: bool;
    lastIndex: float;
}
interface RegExpExecArray extends Array<chars> { index: float; input: chars; }
interface RegExpMatchArray extends Array<chars> { index?: float; input?: chars; }
interface RegExpConstructor {
    new(pattern: chars | RegExp, flags?: chars): RegExp;
    (pattern: chars | RegExp, flags?: chars): RegExp;
    readonly prototype: RegExp;
}
declare var RegExp: RegExpConstructor;

interface Date {
    toString(): chars;
    toGMTString(): chars;
    toUTCString(): chars;
    valueOf(): float;
    getTime(): float;
    getTimezoneOffset(): float;
    getDate(): float;
    getDay(): float;
    getMonth(): float;
    getFullYear(): float;
    getYear(): float;
    getHours(): float;
    getMinutes(): float;
    getSeconds(): float;
    getMilliseconds(): float;
    getUTCDate(): float;
    getUTCDay(): float;
    getUTCMonth(): float;
    getUTCFullYear(): float;
    getUTCHours(): float;
    getUTCMinutes(): float;
    getUTCSeconds(): float;
    getUTCMilliseconds(): float;
    setTime(value: float): float;
    setDate(day: float): float;
    setMonth(month: float, day?: float): float;
    setFullYear(year: float, month?: float, day?: float): float;
    setYear(year: float): float;
    setHours(hours: float, minutes?: float, seconds?: float, ms?: float): float;
    setMinutes(minutes: float, seconds?: float, ms?: float): float;
    setSeconds(seconds: float, ms?: float): float;
    setMilliseconds(ms: float): float;
    setUTCDate(day: float): float;
    setUTCMonth(month: float, day?: float): float;
    setUTCFullYear(year: float, month?: float, day?: float): float;
    setUTCHours(hours: float, minutes?: float, seconds?: float, ms?: float): float;
    setUTCMinutes(minutes: float, seconds?: float, ms?: float): float;
    setUTCSeconds(seconds: float, ms?: float): float;
    setUTCMilliseconds(ms: float): float;
}
interface DateConstructor {
    new(): Date;
    new(value: float | chars | String): Date;
    new(year: float, month: float, day?: float, hours?: float, minutes?: float, seconds?: float, ms?: float): Date;
    (): chars;
    parse(value: chars): float;
    UTC(year: float, month: float, day?: float, hours?: float, minutes?: float, seconds?: float, ms?: float): float;
    readonly prototype: Date;
}
declare var Date: DateConstructor;
interface Math {
    readonly E: float; readonly LN10: float; readonly LN2: float;
    readonly LOG2E: float; readonly LOG10E: float; readonly PI: float;
    readonly SQRT1_2: float; readonly SQRT2: float;
    abs(value: float): float; acos(value: float): float; asin(value: float): float;
    atan(value: float): float; atan2(y: float, x: float): float;
    ceil(value: float): float; cos(value: float): float; exp(value: float): float;
    floor(value: float): float; log(value: float): float;
    max(...values: float[]): float; min(...values: float[]): float;
    pow(base: float, exponent: float): float; random(): float;
    round(value: float): float; sin(value: float): float;
    sqrt(value: float): float; tan(value: float): float;
}
declare var Math: Math;
declare const NaN: float;
declare const Infinity: float;
declare function parseInt(value: chars, radix?: float): float;
declare function parseFloat(value: chars): float;
declare function isFinite(value: any): bool;
declare function getArrayLength(value: any[]): float;
declare function setArrayLength(value: any[], length: float): void;
declare function undefine(value: any): void;
