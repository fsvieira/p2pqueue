import Libp2p from 'libp2p'
import { NOISE } from 'libp2p-noise'
import  MPLEX  from 'libp2p-mplex'
import TCP from 'libp2p-tcp'
import Gossipsub from 'libp2p-gossipsub'
import  KadDHT from 'libp2p-kad-dht'
import Bootstrap from 'libp2p-bootstrap'

export class P2P {
    constructor (options={}) {
        this.options = options;
        this.connectedPeers = {};
    }

    async start() {
        const {peerId, port=0, bootstrap=[]} = this.options;

        const node = await Libp2p.create({
            peerId,
            addresses: {
                listen: [`/ip4/127.0.0.1/tcp/${port}`]
            },
            modules: {
            transport: [TCP],
                connEncryption: [NOISE],
                streamMuxer: [MPLEX],
                pubsub: Gossipsub,
                dht: KadDHT,
                peerDiscovery: [ Bootstrap ]
            },
            config: {
                dht: {
                    // dht must be enabled
                    enabled: true
                },
                peerDiscovery: {
                    [Bootstrap.tag]: {
                        list: bootstrap,
                        interval: 5000, // default is 10 ms,
                        enabled: bootstrap.length > 0
                    }
                }
            }
        });
    
        await node.start();
    
        node.connectionManager.on('peer:connect', (connection) => {
            const peerId = connection.remotePeer.toB58String();
            this.connectedPeers[peerId] = connection;

            // console.log('Connection established to:', peerId)
        })

        node.connectionManager.on('peer:disconnect', (connection) => {
            const peerId = connection.remotePeer.toB58String()

            delete  this.connectedPeers[peerId]

            // console.log('Disconnection from:', peerId)
        })

        this.node = node;
        return node;
    }

}

