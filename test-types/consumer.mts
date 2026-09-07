import Mediator from '../dist/index.js';
const mediator = new Mediator();
mediator.on('ready', (value: string) => value.toUpperCase());
mediator.emit('ready', 'Ada');
mediator.initialize().destroy();
