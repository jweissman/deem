export default function deepCopy(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {return obj;}
  if (obj instanceof Array) {return obj.map(item => deepCopy(item));}
  
  const copy: Record<string, unknown> = {};
  for (const key in obj) {
    // if (obj.hasOwnProperty(key)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepCopy(obj[key as keyof typeof obj]);
    }
  }
  return copy;
}