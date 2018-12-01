function EventEmitter() {
  EventEmitter.init.call(this);
}

module.exports = EventEmitter;
EventEmitter.EventEmitter = EventEmitter;
