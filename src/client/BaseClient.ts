import EventEmitter from "node:events";
class BaseClient extends EventEmitter {
 public options: BaseClientOptions;

 constructor(options: BaseClientOptions = {}) {
  super({ captureRejections: true });
  if (typeof options !== "object" || options === null) {
   throw new Error("Invalid options! Options must be a non-null object.");
  }
  this.options = options;
 }

 public destroy(): void {
  this.removeAllListeners();
 }

 public incrementMaxListeners(): void {
  const currentMaxListeners = this.getMaxListeners();
  if (currentMaxListeners > 0) {
   this.setMaxListeners(currentMaxListeners + 1);
  }
 }

 public decrementMaxListeners(): void {
  const currentMaxListeners = this.getMaxListeners();
  if (currentMaxListeners > 1) {
   this.setMaxListeners(currentMaxListeners - 1);
  }
 }
}

export default BaseClient;
