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
// Contextual listeners infer the declared detail type.
typed.addEventListener('ready', event => {
    const name: string = event.detail.name;
    return name;
});
// @ts-expect-error inferred detail is not widened to an unrelated property type.
typed.addEventListener('ready', event => { const name: number = event.detail.name; return name; });
typed.addEventListener('stopped', event => {
    const detail: undefined = event.detail;
    return detail;
});
typed.addEventListener('ready', {handleEvent: (event: Event) => event.type});
const controller = new AbortController();
typed.addEventListener('ready', readyListener, {once: true, passive: true, capture: false, signal: controller.signal});
typed.addEventListener('ready', readyListener, true);
typed.removeEventListener('ready', readyListener, {capture: false});
// @ts-expect-error unknown event names are rejected for typed listener removal.
typed.removeEventListener('missing', () => {});
const notCanceled: boolean = typed.dispatchEvent(new CustomEvent('ready', {detail: {name: 'Ada'}}));
mediator.addEventListener('any:untyped:name', event => event.detail);

class Application extends Mediator<Events> {
    ready(name: string) {
        return this.dispatchEvent(new CustomEvent('ready', {detail: {name}}));
    }
}
const application: Application = new Application().initialize();
application.ready('Ada');
application.destroy();
