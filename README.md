# white-label-mediator

[![Build Status](https://travis-ci.org/bshack/white-label-mediator.svg?branch=master)](https://travis-ci.org/bshack/white-label-mediator) [![Coverage Status](https://coveralls.io/repos/github/bshack/white-label-mediator/badge.svg?branch=master)](https://coveralls.io/github/bshack/white-label-mediator?branch=master)

A simple JS mediator that allows communication between views.

Based on Node.js' events module: https://nodejs.org/api/events.html

Install the node module:

```
npm install white-label-mediator --save
```

## Require

```
var Mediator = require('white-label-mediator');
```

## Instantiate

```
var mediator = new Mediator();
```

## Subscribe

In a separate view you subscribe to a message that the mediator will publish from another view. The first argument is the name of the message you want to subscribe to. The second argument in the callback.

```
mediator.subscribe('main-menu', function(data){
    window.console.log(data);
});
```

## Publish

In a separate view you publish message that other views are subscribed too. The first argument is the name of the message you want to publish. The second argument is data you can pass along with your message event and is optional.

```
mediator.publish('main-menu', {
    state: 'open'
});
```

Nothing will happen if you publish a message that no other views are subscribed to.
