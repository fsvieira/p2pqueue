const {Foglet} = require('foglet-core');
const wrtc = require('wrtc');

const { Queue } = require("./queue");

function p2pQueue () {
    const fog = new Foglet({
        // id: 'myfogletid', // default we use uuid/v4 generated id
        rps: {
            type: 'spray-wrtc', // we choose Spray as a our RPS,
            options: {
                protocol: 'network', // the name of the protocol run by our app
                webrtc: { // some WebRTC options
                wrtc,
                trickle: true, // enable trickle
                iceServers : [] // define iceServers here if you want to run this code outside localhost
                },
                signaling: { // configure the signaling server
                // address: 'http://signaling.herokuapp.com', // put the URL of the signaling server here
                address: 'http://localhost:3000',
                room: 'network' // the name of the room for the peers of our application
                }
            }
        }
    });
    
    fog.share();
    
    const queue = new Queue();

    fog.connection().then(async () => {
        const get = (max, receiver=fog.id) => {
            const neighbours = fog.getNeighbours(4).filter(p => p != receiver);
            const maxPerNode = Math.ceil(max / neighbours.length);

            console.log(`This node (${fog.id}) requested to ${neighbours.join(", ")} ${maxPerNode} for each node.`);

            return fog.sendMulticast(neighbours, {
                action: 'pop', 
                max: maxPerNode,
                receiver
            });
        };
            
        fog.onUnicast((id, message) => {
            const cmd = message;

            switch (cmd.action) {
                case 'pop': {
                    const max = cmd.max;
                    const items = queue.requestPop(max || 10) || [];
                    console.log(`Node ${id} requested ${max} items, sending ${items.length} items!!`);
                    if (items.length > 0) {
                        fog.sendUnicast(id, {action: 'push', items});
                    }

                    if (items.length < max*0.8) {
                        // send request to peers,
                        console.log(`Ask peers to send to receiver!`)
                        get(max-items.length, id);
                    }

                    break;
                }
                
                case 'push': {
                    console.log(`Node ${id} sent ${cmd.items.length} items!`);
                    queue.push(...cmd.items);
                    break;
                }
            }
        });
      
        console.log("ID", fog.id);
      
        queue.setGet(get);
    });

    return queue;
}

module.exports = {p2pQueue};

