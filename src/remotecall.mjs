import crypto from 'crypto'
import {pipe} from 'it-pipe'


export default class RemoteCall {
    constructor (queue, maxConcurrentCalls = 1) {
        this.queue = queue;
        this.fns = {};
        this.ids = 1;
        this.calls = {};
        this.maxConcurrentCalls = maxConcurrentCalls;

        this.callerID = this.queue.conn.node.peerId.toB58String();

        this.queue.conn.node.handle('/rcall/1.0.0', async ({ connection, stream }) => {
            pipe(
              stream,
              source => (async () => {
                try {
                    for await (const msg of source) {
                        const data = JSON.parse(msg.toString());
                        this.result(data, data.result);
                    }
                }
                catch (e) {
                  console.log(e);
                }
              })()
            );
        });

    }

    hash (text) {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    register (fn, memoization=false) {
        const tag = this.hash(fn.toString());
        const values = memoization?{}:undefined;
        this.fns[tag] = {
            fn,
            memoization: values
        };

        return async (...args) => {

            let argsHash;
            if (values) {
                argsHash = this.hash(JSON.stringify(args));
                const data = values[argsHash];

                if (data !== undefined) {
                    const {value, id} = data;
                    if (value !== undefined) {
                        return value;
                    }
                    else {
                        return new Promise((resolve, reject) => {
                            this.calls[id].push({resolve, reject});
                        });
                    }
                }
            }

            const id = this.ids++;
            if (values) {
                values[argsHash] = {id};
            }

            return new Promise((resolve, reject) => {
                this.calls[id] = [{resolve, reject}];
                this.queue.push({
                    id,
                    tag,
                    args,
                    caller: this.queue.conn.address,
                    callerID: this.callerID
                });

            });
        };
    }

    async result (data, result) {
        if (data.callerID === this.callerID) {
            const promisses = this.calls[data.id];
            if (data.status === 'resolve') {
                for (let i=0; i<promisses.length; i++) {
                    const {resolve} = promisses[i];
                    resolve(result);
                }
            }
            else if (data.status === 'reject') {
                for (let i=0; i<promisses.length; i++) {
                    const {reject} = promisses[i];
                    reject(data.error);
                }
            }

            delete this.calls[data.id];
        }
        else {
            try {
                const { stream } = await this.queue.conn.node.dialProtocol(data.caller[0], '/rcall/1.0.0')

                data.result = result;
                await pipe(
                    [JSON.stringify(data)],
                    stream
                );        
            }
            catch (e) {
                console.log("Error Sending Result --> ", e);
            }
        }
    }

    process () {
        let running = 0;
        const next = async () => {
            if (running < this.maxConcurrentCalls) {
                const data = await this.queue.pop();
                const {
                    tag,
                    args
                } = data;

                const {fn, memoization} = this.fns[tag];

                if (fn) {
                    const done = (value, err) => {
                        if (err) {
                            data.status = 'reject';
                            data.error = err;
                            if (memoization) {
                                delete memoization[argsHash];
                            }
                        }
                        else {
                            data.status='resolve';
                            if (memoization) {
                                const argsHash = this.hash(JSON.stringify(args));
                                memoization[argsHash] = {value}
                            };
                        }

                        this.result(data, value);
                    };

                    running++;
                    try {
                        const result = await fn(...args, done);

                        if (result !== undefined) {
                            done(result);
                        }
                    }
                    catch(e) {
                        done(undefined, e);
                    }

                    running--;   
                    setTimeout(next, 0); // dont't put call on call stack ? 
                }
                else {
                    done(undefined, 'bad function!!');
                }
            }
        }

        next();
    }
}

