# white-label-mediator

[![Build Status](https://travis-ci.org/bshack/white-label-mediator.svg?branch=master)](https://travis-ci.org/bshack/white-label-mediator) [![Coverage Status](https://coveralls.io/repos/github/bshack/white-label-mediator/badge.svg?branch=master)](https://coveralls.io/github/bshack/white-label-mediator?branch=master)

A simple ES6 JS mediator that allows communication between views.

Learn more about ES6 classes here:

https://babeljs.io/docs/learn-es2015/

Events are emited using Node.js' events module. For more options on how to listen to events please look at the Node.js documentation:

https://nodejs.org/api/events.html

## Install

Install the node module:

```
npm install white-label-mediator --save
```

## Import

```
import Mediator from 'white-label-mediator';
```

## Instantiate

```
var myMediator = new Mediator();
```

## Extend

extend the Mediator class for your own needs:

```
const MyMediator = class extends Mediator {
    someGreatFeature() {
        console.log('this is great!');
    }
};

const myMediator = new MyMediator();

myMediator.someGreatFeature();
```

## On

In a separate view you subscribe to a message that the mediator will publish from another view. The first argument is the name of the message you want to subscribe to. The second argument in the callback.

```
myMediator.on('main-menu', (data) => {
    window.console.log(data);
});
```

## Emit

In a separate view you publish message that other views are subscribed too. The first argument is the name of the message you want to publish. The second argument is data you can pass along with your message event and is optional. The data passed can be any data type.

```
myMediator.emit('main-menu', {
    state: 'open'
});
```

Nothing will happen if you publish a message that no other views are subscribed to.
