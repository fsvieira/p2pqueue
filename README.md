# p2pqueue
Distributed P2P Queue

# Version/Stage
 * Version: Alpha
 * Stage: Prof-of-concept
   * Working but still have many things to be polished.

# Run 

  * Clone git repo,
  * run `npm install`
  * run `npm run start` (this will start the signeling server
  * Run Example:
    * `node queue-example.js 1000` (this will create a producer/consumer node, that will generate 1000 items to the queue),
    * `node queue-example.js` (this will create a consumer node)
    * You can run has many nodes you like (I think).
    
# Queue Arquitecture
  * The queue uses foglet-core (https://github.com/ran3d/foglet-core) to make a p2p webrtc network,
  * Each node has their internal queue,
  * Nodes can request their neighbours to give them items, by considering the following conditions:
    * Node estimates to finish their internal queue in X seconds (currently X=30 seconds),
    * Node asks for a max number of items that he can process in 30 seconds,
    * Node didn't ask for items in the last Y seconds (currently Y=2 seconds).
  * When a node receive a 'pop' request they can decide how many items to give, no more than the max asked:
    * Node will only give a number of items that are estimated to wait more then X seconds (currenty X=30 seconds) until they are processed,
    * If node can't return at least 80% of max items requested than it will ask their neighbours to send it to receiver.
  * Estimates:
    * The node internal queue have a internal avg time of the velocity items are pop (avgItemProcessTime)
    * To estimate finish time we just use queueSize * avgItemProcessTime
    


  
  
  
