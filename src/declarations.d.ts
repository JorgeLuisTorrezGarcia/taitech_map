declare module 'rbush' {
  export default class RBush<T> {
    constructor(maxEntries?: number);
    insert(item: T): this;
    load(items: T[]): this;
    remove(item: T, equals?: (a: T, b: T) => boolean): this;
    clear(): this;
    search(bbox: { minX: number; minY: number; maxX: number; maxY: number }): T[];
    all(): T[];
    collides(bbox: { minX: number; minY: number; maxX: number; maxY: number }): boolean;
    toBBox(item: T): { minX: number; minY: number; maxX: number; maxY: number };
    compareMinX(a: T, b: T): number;
    compareMinY(a: T, b: T): number;
  }
}

declare module 'vt-pbf' {
  export function fromGeojsonVt(
    layers: Record<string, any>,
    options?: { version?: number }
  ): Uint8Array;
}
