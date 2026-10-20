import { Deem } from '../index';

const source = "2d6 + #modifier + (dig(#target, 'isUndead') ? 3 : 0)";
const runtime = new Deem({ seed: 'ability-demo' });
const before = runtime.preview(source, { modifier: 4 });
if (before.status === 'error') { throw before.error; }
const after = runtime.preview(before.expression, { target: { isUndead: true } }, 'descriptive');
if (after.status === 'error') { throw after.error; }
console.log('Original:', source);
console.log('Before choosing target:', before.explanation.text);
console.log('Specialized tree:', JSON.stringify(after.expression, null, 2));
console.log('After choosing undead target:', after.explanation.text);
console.log('Bounds:', after.explanation.bounds);
console.log('Execution:', runtime.execute(after.expression));
console.log('Original with same seed:', new Deem({ seed: 'ability-demo' }).evaluate(source, {
  modifier: 4, target: { isUndead: true },
}));
