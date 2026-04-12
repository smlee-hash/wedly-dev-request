import { EventEmitter } from "events";

const globalForEmitter = globalThis as unknown as { updateEmitter?: EventEmitter };

if (!globalForEmitter.updateEmitter) {
  globalForEmitter.updateEmitter = new EventEmitter();
  globalForEmitter.updateEmitter.setMaxListeners(100);
}

export const updateEmitter = globalForEmitter.updateEmitter;
