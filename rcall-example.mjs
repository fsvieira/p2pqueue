import {P2P} from './src/p2p.mjs'
import Queue from './src/p2pqueue.mjs'
import RemoteCall from './src/remotecall.mjs'

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

        setInterval(() => console.log(q.size), 5000);

        const rc = new RemoteCall(q);

        const fib = rc.register(async (n, done) => {            
            if (n <= 1) {
                return n;
            }

            Promise.all([fib(n - 1), fib(n - 2)]).then(([a, b]) => {
                done(a + b);
            });

            await new Promise(resolve => setTimeout(resolve, 1000 * 5));
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

