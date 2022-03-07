# p2pqueue
Distributed P2P Queue, and a remote call implementation on top of p2p queue.

# Version/Stage
 * Version: Alpha
 * Stage: Prof-of-concept
   * Working but still have many things to be polished.

# Run 

  * Clone git repo,
  * run `npm install`
  * node queue-example.mjs
    * Will run a simple example of p2p queue with multiple nodes on same process.
  * Terminal 1: node rcall-example.mjs 100
  * Terminal 2: node rcall-example.mjs
    * Will run the remote call example to calculate fib numbers, the first parameter is the number to calc, if no number to calc is given then 
     the next processes are just going to help on the calculations
    
# Queue Arquitecture
  * The Queue uses the libp2p (https://libp2p.io/) to connect and comunicate,
  * Every 2 seconds nodes sends their stats to 4 random connected peers,
  * When a node receives the stats from other peers it will calculate the avg global number of elements on queue and avg estimation of finish time,
  * If a node is more than 10% above avarage finish time, then it will send elements to the network



  
  
  
