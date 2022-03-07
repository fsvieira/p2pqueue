import {P2P} from './src/p2p.mjs'
import Queue from './src/p2pqueue.mjs'
import crypto from 'crypto'

class RemoteCall {
    constructor (queue, maxConcurrentCalls = 1) {
        this.queue = queue;
        this.fns = {};
        this.ids = 1;
        this.calls = {};
        this.maxConcurrentCalls = maxConcurrentCalls;

        this.callerID = this.queue.conn.node.peerId.toB58String();
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
                    if (value) {
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
            this.queue.push({
                id,
                tag,
                args,
                caller: this.queue.conn.address,
                callerID: this.callerID
            });

            if (values) {
                values[argsHash] = {id};
            }

            return new Promise((resolve, reject) => {
                this.calls[id] = [{resolve, reject}];
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
        }
        else {
            console.log("TODO: Remote call, send results!!", data, data.caller[0]);
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
                            delete memoization[argsHash];
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

async function main () {
    try {

        const [_node, _js, n=0] = process.argv;

        const nodeP2P = new P2P({bootstrap: []});
        const node = await nodeP2P.start();

        const addr = node.multiaddrs.map(
            ma => `${ma.toString()}/p2p/${node.peerId.toB58String()}`
        );

        console.log(addr);
        const q = new Queue(nodeP2P);

        const rc = new RemoteCall(q);

        const fib = rc.register(async (n, done) => {            
            if (n <= 1) {
                return n;
            }

            Promise.all([fib(n - 1), fib(n - 2)]).then(([a, b]) => {
                done(a + b);
            });
        }, true);

        rc.process();
        
        if (n > 0) {
            const r = await fib(n);
            console.log("Result", n, r);
        }
    }
    catch (e) {
        console.log(e);
    }
}

main();

