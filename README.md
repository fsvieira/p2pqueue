# p2pqueue
Distributed P2P Queue implemented with libp2p and a remote call implementation on top of p2p queue.



# Version/Stage
* Version: Alpha
* Stage: Propf-of-concept
* Working but there are still many things to be polished.

* [Install](#install)
* [API](#api)
  * [P2P](#p2p)
    * [start](#start)
  * [Queue](#queue)
    * [push](#push)
    * [pop](#pop)
    * [size](#size)
    * [close](#close)
  * [Remote Call](#remotecall)
    * [register](#register)
    * [process](#process)
  * [Examples](#examples)
    * [Queue Example](#queue-example)
    * [Remote Call Example](#remote-call-example)
    * [Monte-Carlo PI](#monte-carlo-pi)
  * [Limitations](#limitations)
  * [Queue Architecture](#queue-arquitecture)

# Install
At this stage, the only option is to clone the repo and run
`npm install` at the root of repo, node version must be >= 16.

# API

## P2P

File: ./src/p2p.mjs
Usage: `const node = new P2P(options)`

* Options:
* peerId, the node peerId. Automatically generated if none is provided,
* port, the node address port, default 0 (an available port is automatically selected),
* bootstrap, an array of known addresses to this node connects at start, default to [].

Ex. `const nodeP2P = new P2P({bootstrap});`

The node also uses libp2p-mdns to find peers on the same network, so even if you don't provide bootstrap, and you have your nodes
running on the same network, they still can connect.

### start
Start the node to start listening for connections. Ex. `node.start()`

## Queue

File: ./src/p2pqueue.mjs
Usage `const queue = new Queue(node)`

This creates a new Queue using the node handle communication with other nodes.

### push
Push n elements to the queue,
Usage `queue.push(1, 2, 4)`

### pop
Pop one element off the queue, since this is a distributed queue some elements may come from other nodes, and order is not granted.

Usage: `const el = await queue.pop()`

Pop also accepts a timeout in seconds like this `const el = await queue.pop(5000)` when queue is empty it will wait 5 seconds, if queue is still
empty after timeout, then it will throw a timeout exception.

### size
A variable with the current queue size `queue.size`.

### close
It will close the queue, and all related services on the node, but it will node close the node.


## RemoteCall

File: ./src/remotecall.mjs
This module uses the p2p queue to distribute the computing of functions on the network, the functions are not sent on the network they are already defined
on each node, meaning all nodes must be equal.

Usage: `const rc = new RemoteCall(q)`;

Constructor `constructor (queue, maxConcurrentCalls = 1)`

* queue, a queue object
* maxConcurrentCalls, it defines how many calls can be running concurrently (not parallel, calls will run on event loop), it can be useful for functions that do async operation like disc or network.

### register
`register (fn, memoization=false)`

It will register a function as a remote call, where:
* fn is a function
* memoization, when true function results are cached and returned when available. If false, function will always run to return results.

For example, fib functions is a good function for memoization because calling fib with the same arguments will always return the same results,

```javascript
const fib = rc.register(async (n, done) => {
if (n {
done(a + b);
});
}, true);
```

Functions that call other registered remote calls functions (dependencies) have to be written in a special way, or they will block the queue execution,
for example, if we rewrite fib functions as this:

```javascript
const fib = rc.register(async (n) => {
if (n 0) {
const pis = [];
for (let i=0; i acc + pi, 0) / pis.length;

console.log(`Pi = ${piNumber}, JS Pi=${Math.PI}, diff=${piNumber - Math.PI}`);
process.exit();
}
```
On this example, we register function pi that uses Monte Carlo method to approximate pi value, then push many calcPi simulations,
when all simulations are completed we calculate the average result, that would give us pi approximation.

`const piNumber = (await Promise.all(pis)).reduce((acc, pi) => acc + pi, 0) / pis.length;`

When registered functions are used, the processing can be distributed to other nodes for processing, and the result redirected to the caller node.

### process
After register all functions, we must call process to start processing the queue
Usage `rc.process();`



# Examples

## Queue Example

Run: `node queue-example.mjs`

This example demonstrates how to use the queue push and pop with a bunch of connected nodes.

## Remote Call Example


Run: `node rcall-example.mjs`
...
Run: `node rcall-example.mjs 1000` where 1000 is fib number to calculate.
...
Run: `node rcall-example.mjs`

In this example, the nodes will connect with each other and will assist to calculate the fib function.
We added a sleep in this function to slow it down. Otherwise, it would be too fast, and we wouldn't be able to see any distribution on other peers.

## Monte Carlo PI

Run: `node pi.mjs`
...
Run: `node pi.mjs 10000` where, 10000 is a number of simulations to do.
...
Run: `node pi.mjs`

In this example, the nodes will connect with each other and will assist to calculate the PI approximation using Monte Carlo simulations.

# Limitations
Queue and RemoteCall don't have any recover mechanism, this means that there is the risk of losing items when sending them to other peers. The problem is as its worst with remoteCall because if lost it will never return, which may cause program execution to block and create many zombie functions.

# Queue Architecture
* The queue architecture uses a very simple concept, all peers should finish simultaneously, this would mean that the work/items on peer's queue is well-balanced.
* Every 2 seconds, each peer sends their knowledge of the global stats (avg number of elements on network and avg estimated finish time), calculated using its own local stats and the received stats from other peers.
* To balance the work we use a simple rule: if a peer is above 10% global average finish time then it must send some of its items to balance the network workload.
* Each peer will slowly converge to the average estimated finish time.
