# p2pqueue
Distributed P2P Queue implemented with libp2p and a remote call implementation on top of p2p queue.

# Version/Stage
 * Version: Alpha
 * Stage: Prof-of-concept
   * Working but still have many things to be polished.

# Install
  At this stage the only option is to clone the repo and run 
  `npm install` at the root of repo, node version must be >= 16.

# API

## P2P (./src/p2p.mjs)

Usage `const node = new P2P(options)`

* Options: 
  * peerId, the node peerId if none is given it will be generated, 
  * port, the node address port, default 0, where 0 means that an available port is selected,
  * bootstrap, an array of known address to this node connects at start, default to [].

Ex. `const nodeP2P = new P2P({bootstrap});`

The node also uses libp2p-mdns to find peers on the same network, so even if you don't provide bootstrap and you have your nodes 
running on the same network they still can connect.

### start
 Start the node to start listening to connections. ex. `node.start()`

## Queue (./src/p2pqueue.mjs)

Usage `const queue = new Queue(node)`

This creates a new Queue using the node handle comunication with other nodes.

### push 
 Push n elements to the queue,
 Usage `queue.push(1, 2, 4)`
 
### pop 
 Pop one element of the queue, since this is a distributed queue some elements may come from other nodes, and order is not garanted.
 
 Usage: `const el = await queue.pop()`
 
 Pop also acepts a timeout in seconds like this `const el = await queue.pop(5000)` when queue is empty it will wait 5 seconds, if queue still 
 empty after timeout then it will throw a timeout exception.
 
### size 
 A variable with the current queue size `queue.size`.

### close
 It will close the queue, and all related services on the node, but it will node close the node.


## RemoteCall (./src/remotecall.mjs)

This module uses the p2p queue to distrute the computing of functions on the network, the functions are not sent on the network they are alredy defined 
on each node, meaning all nodes must be equal. 

Usage: `const rc = new RemoteCall(q)`;

Contructor `constructor (queue, maxConcurrentCalls = 1)`

 * queue, a queue object 
 * maxConcurrentCalls, it defines how many calls can be running concurrently (not parallel, calls will run on event loop), it can be usefull for functions that do async operation like disc or network.
 
### register
 `register (fn, memoization=false)`

 It will register a function as a remote call, where:
 * fn is a function
 * memoization, if true function results will be cached, if false function will always run to return results.

For example fib functions is a good function for memoization because calling fib with the same args will always return same results,

 ```javascript
   const fib = rc.register(async (n, done) => {            
       if (n <= 1) {
                return n;
            }

            Promise.all([fib(n - 1), fib(n - 2)]).then(([a, b]) => {
                done(a + b);
            });
        }, true);
```

Functions that call other registered remote calls functions (dependencies) must be writed in a special way or they will block the queue execution,
for example if we rewrite fib functions as this:

```javascript
   const fib = rc.register(async (n) => {            
       if (n <= 1) {
                return n;
            }

          return await fib(n - 1) + await fib(n - 2);
   }, true);
```

Nothing will be processed because the function will wait for the results of fib(n - 1) and fib(n - 2), but this will only be processed after the parent function returns. So in this cases we need to return undefined and use the done argument to send the result. The done argument is always the last one. 

After the function is registered it can be called like this: `const f = await fib(10)` 

Recursive functions are not very good for distributed computing, since they will need a call stack or something similiar. 

A better example it would be a monte-carlo simulation, this should not use memoization, example:

```javascript
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
```
On this example, we register function pi that uses monte-carlo method to aproximate pi value, then push a lot of calcPi simulations, 
when all simulations are completed then the final aproximation of pi is calculated 
 
`const piNumber = (await Promise.all(pis)).reduce((acc, pi) => acc + pi, 0) / pis.length;`

When registered functions are used they may be distributed to other nodes for processing, and the result will be redirected to caller node.

### process
After register all functions we must call process to start processing the queue
Usage `rc.process();`



# Examples

## Queue Example: queue-example.mjs

Run: `node queue-example.mjs`

This example demonstrates how to use the queue push and pop with a bunch of connected nodes.

## Remote Call Example: rcall-example.mjs

Run: `node rcall-example.mjs`
...
Run: `node rcall-example.mjs 1000` where 1000 is fib number to calculate.
...
Run: `node rcall-example.mjs`

In this example the nodes will connect with each other and will help to calculate the fib function.
The example as "sleep" put on purpose to observe peers distribution. 

## Monte-Carlo PI: pi.mjs

Run: `node pi.mjs`
...
Run: `node pi.mjs 10000` where 10000 is number of simulations to do.
...
Run: `node pi.mjs`

In this example the nodes will connect with each other and will help to calculate the PI aproximation using monte-carlo simulations.

# Limitations
Queue and RemoteCall dont have any recover mecanism, so when an item is sent to other peer it can get lost, this is worst in case of remoteCall where a call that is not sent back may block the program execution and create a lot of zombie functions.


# Queue Arquitecture
  * The queue arquitecture uses a very simple concept, all peers should finish at the same time, this would mean that the work/items on peers queue is well balanced. 
  * So a simple rule is used, it a peer is above global avarage finish time then it must sends some of its items to balance the network workload.
  * Every peer on every 2 seconds sends their knoloage of the global stats (avg number of elements on network and avg estimated finish time), that is calculated using its own local stats and the received stats from other peeers.
  * If a peer is more than 10% above avarage finish time, then it will send elements to the network to get that value balanced.
  * Each peer will slowly converge to the avarage estimated finish time.  



  
  
  
