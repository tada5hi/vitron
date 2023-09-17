import { inject } from 'vitron/renderer';

const foo = inject<string>('foo');
console.log(foo);
