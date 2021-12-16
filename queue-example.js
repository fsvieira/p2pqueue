const {p2pQueue} = require('./src/p2pqueue');

function quadraticTime(n) { // n^2
    let sum = 0;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            sum = i+j;
        }
    }

    return sum;
}

async function compute (number) {

    console.log("Start Number ", number);

    const queue = p2pQueue();

    if (number) {
        for (let i=0; i<number; i++) {
            queue.push(Math.random() * 10000);
        }
    }

    const wait = time => new Promise(resolve => setTimeout(resolve, time));

    // setInterval(() => console.log("L => ", queue.queue.length), 1000);

    const run = async () => { 
        for (;;) {
            const data = queue.pop();

            if (data !== undefined) {
                const n = data;
                const r = quadraticTime(n);
                // console.log("Quad Time", n, r);
            }

            console.log(`Queue Size`, queue.queue.length);
            await wait(1000);
        }
    }

    run();
}

const [node, script, number] = process.argv;
compute(+number);

