import {P2P} from './src/p2p.mjs'
import Queue from './src/p2pqueue.mjs'

async function test (q, finish) {
    try {
        for (let i=0; i<50 * (1 + Math.random()); i++) {
            q.push(i);
        }

        let e;

        while ((e = await q.pop(1000 * 5)) !== undefined) {
            console.log(`Pop Element ${e}`);
            await new Promise(resolve => setTimeout(resolve, 1000 *  Math.random()));
        }
    }
    catch (e) {
        console.log(e);
    }

    q.close();
    await q.conn.node.stop();       
    finish();

}

async function main () {
    let bootstrap;
    let nodes = 5;

    for (let i=0; i<nodes; i++) {
        const nodeP2P = new P2P({bootstrap});
        const node = await nodeP2P.start();

        bootstrap = node.multiaddrs.map(
            ma => `${ma.toString()}/p2p/${node.peerId.toB58String()}`
        );

        const n = new Queue(nodeP2P);

        test(n, () => {
            nodes--;

            if (nodes === 0) {
                console.log("All processes are done!");
                process.exit();
            }
        });
    }
}

main();

