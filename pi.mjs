import {P2P} from './src/p2p.mjs'
import Queue from './src/p2pqueue.mjs'
import RemoteCall from './src/remotecall.mjs'

async function calcPi (samples) {
    let r = 5;
    let pointsTotal = 0;
    let pointsInside = 0;
    
    for (let i=0; i<samples; i++) {
      pointsTotal++;
    
      const x = Math.random() * r * 2 - r;
      const y = Math.random() * r * 2 - r;
      
        if (Math.pow(x, 2) + Math.pow(y, 2) < Math.pow(r, 2)) {
            pointsInside++;
        }    
    }    

    return 4 * pointsInside / pointsTotal;
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

        setInterval(() => console.log(q.size), 5000);

        const rc = new RemoteCall(q);

        const pi = rc.register(calcPi);

        rc.process();
        
        if (n > 0) {
            const pis = [];
            for (let i=0; i<n; i++) {
                pis.push(pi(30000));
            }

            const piNumber = (await Promise.all(pis)).reduce((acc, pi) => acc + pi, 0) / pis.length;

            console.log(`Pi = ${piNumber}, JS Pi=${Math.PI}, diff=${piNumber - Math.PI}`);
            process.exit();
        }
    }
    catch (e) {
        console.log(e);
        process.exit();
    }
}

main();

