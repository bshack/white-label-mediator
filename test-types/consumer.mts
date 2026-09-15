import Mediator from '../dist/index.js';

const mediator = new Mediator();
mediator.addEventListener('ready', event => event.detail);
mediator.dispatchEvent(new CustomEvent('ready', {detail: 'Ada'}));
mediator.initialize().destroy();

type Events = {
    ready: {name: string};
    stopped: undefined;
};
const typed = new Mediator<Events>();
const readyListener = (event: CustomEvent<{name: string}>) => event.detail.name.toUpperCase();
typed.addEventListener('ready', readyListener);
typed.addEventListener('stopped', event => event.detail);
typed.dispatchEvent(new CustomEvent('ready', {detail: {name: 'Ada'}}));
typed.removeEventListener('ready', readyListener);
// @ts-expect-error unknown event names are rejected for typed listener registration.
typed.addEventListener('missing', () => {});
// @ts-expect-error listener detail must match the declared event map.
typed.addEventListener('ready', (event: CustomEvent<number>) => event.detail.toFixed());
