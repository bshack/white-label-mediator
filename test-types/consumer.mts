import Mediator from '../dist/index.js';
const mediator = new Mediator();
mediator.on('ready', (value: string) => value.toUpperCase());
mediator.emit('ready', 'Ada');
mediator.initialize().destroy();
const typed = new Mediator<{ready: [name: string]; stopped: []}>();
typed.on('ready', name => name.toUpperCase());
typed.emit('ready', 'Ada');
typed.emit('stopped');
