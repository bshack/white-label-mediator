// DOM-only check: Mediator's published listener types accept exactly what the DOM
// EventTarget listener types accept. tsconfig.consumer-node.json excludes this file
// because Node-only consumers do not have the DOM names.
import Mediator from '../dist/index.js';

type Assignable<From, To> = [From] extends [To] ? true : false;
type Expect<Value extends true> = Value;
type AddParameters = Parameters<Mediator<{ready: string}>['addEventListener']>;
type RemoveParameters = Parameters<Mediator<{ready: string}>['removeEventListener']>;
type ListenerObject = Exclude<AddParameters[1], null | ((event: CustomEvent<string>) => void)>;
type AddOptions = Exclude<AddParameters[2], boolean | undefined>;

export type Checks = [
    Expect<Assignable<EventListenerObject, ListenerObject>>,
    Expect<Assignable<ListenerObject, EventListenerObject>>,
    Expect<Assignable<AddEventListenerOptions, AddOptions>>,
    Expect<Assignable<AddOptions, AddEventListenerOptions>>,
    Expect<Assignable<EventListenerOptions, Exclude<RemoveParameters[2], boolean | undefined>>>,
    Expect<Assignable<EventListenerOrEventListenerObject, NonNullable<Parameters<Mediator['addEventListener']>[1]>>>
];

const mediator = new Mediator();
const domObject: EventListenerObject = {handleEvent: event => event.type};
const domOptions: AddEventListenerOptions = {once: true, signal: new AbortController().signal};
mediator.addEventListener('ready', domObject, domOptions);
mediator.removeEventListener('ready', domObject, domOptions);
